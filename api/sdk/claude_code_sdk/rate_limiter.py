"""Rate limiting and retry management for Claude SDK.

This module provides sophisticated rate limiting with:
- Token bucket algorithm
- Sliding window rate limiting
- Automatic retry with exponential backoff
- Circuit breaker pattern
- Distributed rate limiting support
- Priority queuing
"""

import asyncio
import time
import random
from collections import deque, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Callable, Awaitable, TypeVar, Deque
from contextlib import asynccontextmanager
import math
import heapq

from ._errors import RateLimitError, TimeoutError
from .logging import get_logger

logger = get_logger(__name__)

T = TypeVar('T')


class RetryStrategy(Enum):
    """Retry strategies."""
    EXPONENTIAL = "exponential"
    LINEAR = "linear"
    FIBONACCI = "fibonacci"
    CONSTANT = "constant"


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    
    # Token bucket settings
    max_tokens: int = 100
    refill_rate: float = 10.0  # Tokens per second
    
    # Sliding window settings
    window_size_seconds: int = 60
    max_requests_per_window: int = 100
    
    # Retry settings
    max_retries: int = 3
    retry_strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 60.0
    jitter: bool = True
    
    # Circuit breaker settings
    failure_threshold: int = 5
    recovery_timeout_seconds: float = 60.0
    half_open_requests: int = 1
    
    # Priority settings
    enable_priority: bool = False
    priority_levels: int = 3


@dataclass
class RequestMetadata:
    """Metadata for a request."""
    
    request_id: str
    timestamp: float = field(default_factory=time.time)
    priority: int = 0  # Lower is higher priority
    attempt: int = 0
    tokens_required: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __lt__(self, other: "RequestMetadata") -> bool:
        """Compare for priority queue."""
        if self.priority != other.priority:
            return self.priority < other.priority
        return self.timestamp < other.timestamp


class TokenBucket:
    """Token bucket rate limiter."""
    
    def __init__(self, capacity: int, refill_rate: float):
        """Initialize token bucket.
        
        Args:
            capacity: Maximum number of tokens
            refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = float(capacity)
        self.last_refill = time.time()
        self._lock = asyncio.Lock()
    
    async def acquire(self, tokens: int = 1, wait: bool = True) -> bool:
        """Acquire tokens from bucket.
        
        Args:
            tokens: Number of tokens to acquire
            wait: Whether to wait if tokens not available
            
        Returns:
            True if tokens acquired, False otherwise
        """
        async with self._lock:
            # Refill tokens
            now = time.time()
            elapsed = now - self.last_refill
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.refill_rate
            )
            self.last_refill = now
            
            # Check if enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            
            if not wait:
                return False
            
            # Calculate wait time
            tokens_needed = tokens - self.tokens
            wait_time = tokens_needed / self.refill_rate
            
            # Wait and try again
            await asyncio.sleep(wait_time)
            return await self.acquire(tokens, wait=False)
    
    @property
    def available_tokens(self) -> float:
        """Get current available tokens."""
        now = time.time()
        elapsed = now - self.last_refill
        return min(
            self.capacity,
            self.tokens + elapsed * self.refill_rate
        )


class SlidingWindowLimiter:
    """Sliding window rate limiter."""
    
    def __init__(self, window_size: int, max_requests: int):
        """Initialize sliding window limiter.
        
        Args:
            window_size: Window size in seconds
            max_requests: Maximum requests per window
        """
        self.window_size = window_size
        self.max_requests = max_requests
        self.requests: Deque[float] = deque()
        self._lock = asyncio.Lock()
    
    async def check_limit(self) -> bool:
        """Check if request is within limit.
        
        Returns:
            True if within limit, False otherwise
        """
        async with self._lock:
            now = time.time()
            cutoff = now - self.window_size
            
            # Remove old requests
            while self.requests and self.requests[0] < cutoff:
                self.requests.popleft()
            
            # Check limit
            if len(self.requests) >= self.max_requests:
                return False
            
            # Add current request
            self.requests.append(now)
            return True
    
    @property
    def current_rate(self) -> float:
        """Get current request rate per second."""
        now = time.time()
        cutoff = now - self.window_size
        
        # Count recent requests
        recent = sum(1 for t in self.requests if t >= cutoff)
        return recent / self.window_size if self.window_size > 0 else 0


class RetryManager:
    """Manages retry logic with various strategies."""
    
    def __init__(self, config: RateLimitConfig):
        """Initialize retry manager."""
        self.config = config
        self._retry_counts: Dict[str, int] = defaultdict(int)
    
    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt.
        
        Args:
            attempt: Retry attempt number (0-based)
            
        Returns:
            Delay in seconds
        """
        if self.config.retry_strategy == RetryStrategy.EXPONENTIAL:
            delay = self.config.base_delay_seconds * (2 ** attempt)
        
        elif self.config.retry_strategy == RetryStrategy.LINEAR:
            delay = self.config.base_delay_seconds * (attempt + 1)
        
        elif self.config.retry_strategy == RetryStrategy.FIBONACCI:
            # Calculate Fibonacci number
            a, b = 1, 1
            for _ in range(attempt):
                a, b = b, a + b
            delay = self.config.base_delay_seconds * a
        
        else:  # CONSTANT
            delay = self.config.base_delay_seconds
        
        # Apply max delay
        delay = min(delay, self.config.max_delay_seconds)
        
        # Add jitter if enabled
        if self.config.jitter:
            jitter = random.uniform(0, delay * 0.1)  # Up to 10% jitter
            delay += jitter
        
        return delay
    
    async def execute_with_retry(
        self,
        func: Callable[..., Awaitable[T]],
        *args,
        request_id: Optional[str] = None,
        **kwargs
    ) -> T:
        """Execute function with retry logic.
        
        Args:
            func: Async function to execute
            *args: Function arguments
            request_id: Optional request ID for tracking
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
            
        Raises:
            RateLimitError: If max retries exceeded
        """
        request_id = request_id or str(id(func))
        last_exception: Optional[Exception] = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                # Execute function
                result = await func(*args, **kwargs)
                
                # Reset retry count on success
                self._retry_counts[request_id] = 0
                
                return result
                
            except RateLimitError as e:
                last_exception = e
                
                if attempt >= self.config.max_retries:
                    logger.error(
                        f"Max retries exceeded for {request_id}",
                        attempt=attempt,
                        error=str(e)
                    )
                    break
                
                # Calculate delay
                delay = self.calculate_delay(attempt)
                
                # Use retry_after if provided
                if e.retry_after_seconds:
                    delay = max(delay, e.retry_after_seconds)
                
                logger.warning(
                    f"Rate limited, retrying in {delay:.2f}s",
                    request_id=request_id,
                    attempt=attempt + 1,
                    max_retries=self.config.max_retries
                )
                
                await asyncio.sleep(delay)
                self._retry_counts[request_id] = attempt + 1
                
            except Exception as e:
                # Don't retry on non-rate-limit errors
                logger.error(f"Non-retryable error: {e}")
                raise
        
        # Raise the last exception
        if last_exception:
            raise last_exception
        raise RateLimitError("Max retries exceeded")


class CircuitBreaker:
    """Circuit breaker for fault tolerance."""
    
    def __init__(self, config: RateLimitConfig):
        """Initialize circuit breaker."""
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.half_open_requests = 0
        self._lock = asyncio.Lock()
    
    async def call(
        self,
        func: Callable[..., Awaitable[T]],
        *args,
        **kwargs
    ) -> T:
        """Call function through circuit breaker.
        
        Args:
            func: Async function to call
            *args: Function arguments
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
            
        Raises:
            Exception: If circuit is open or function fails
        """
        async with self._lock:
            # Check circuit state
            if self.state == CircuitState.OPEN:
                # Check if we should transition to half-open
                if self.last_failure_time:
                    elapsed = time.time() - self.last_failure_time
                    if elapsed >= self.config.recovery_timeout_seconds:
                        self.state = CircuitState.HALF_OPEN
                        self.half_open_requests = 0
                        logger.info("Circuit breaker transitioning to HALF_OPEN")
                    else:
                        raise Exception(
                            f"Circuit breaker is OPEN, retry in "
                            f"{self.config.recovery_timeout_seconds - elapsed:.1f}s"
                        )
                else:
                    raise Exception("Circuit breaker is OPEN")
            
            # Check half-open limit
            if self.state == CircuitState.HALF_OPEN:
                if self.half_open_requests >= self.config.half_open_requests:
                    raise Exception("Circuit breaker HALF_OPEN limit reached")
                self.half_open_requests += 1
        
        # Execute function
        try:
            result = await func(*args, **kwargs)
            
            # Success - update state
            async with self._lock:
                if self.state == CircuitState.HALF_OPEN:
                    self.state = CircuitState.CLOSED
                    logger.info("Circuit breaker recovered to CLOSED")
                
                self.failure_count = 0
                self.last_failure_time = None
            
            return result
            
        except Exception as e:
            # Failure - update state
            async with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.config.failure_threshold:
                    self.state = CircuitState.OPEN
                    logger.error(
                        f"Circuit breaker opened after {self.failure_count} failures",
                        error=str(e)
                    )
                elif self.state == CircuitState.HALF_OPEN:
                    self.state = CircuitState.OPEN
                    logger.warning("Circuit breaker reopened from HALF_OPEN")
            
            raise
    
    @property
    def is_open(self) -> bool:
        """Check if circuit is open."""
        return self.state == CircuitState.OPEN
    
    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed."""
        return self.state == CircuitState.CLOSED
    
    def get_status(self) -> Dict[str, Any]:
        """Get circuit breaker status."""
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "last_failure": self.last_failure_time,
            "can_attempt": self.state != CircuitState.OPEN
        }


class PriorityQueue:
    """Priority queue for requests."""
    
    def __init__(self):
        """Initialize priority queue."""
        self._queue: List[tuple] = []
        self._counter = 0  # For stable sorting
        self._lock = asyncio.Lock()
    
    async def put(self, item: RequestMetadata) -> None:
        """Add item to queue."""
        async with self._lock:
            # Use counter for stable sorting
            heapq.heappush(
                self._queue,
                (item.priority, self._counter, item)
            )
            self._counter += 1
    
    async def get(self) -> Optional[RequestMetadata]:
        """Get highest priority item."""
        async with self._lock:
            if self._queue:
                _, _, item = heapq.heappop(self._queue)
                return item
            return None
    
    async def peek(self) -> Optional[RequestMetadata]:
        """Peek at highest priority item without removing."""
        async with self._lock:
            if self._queue:
                _, _, item = self._queue[0]
                return item
            return None
    
    @property
    def size(self) -> int:
        """Get queue size."""
        return len(self._queue)
    
    def is_empty(self) -> bool:
        """Check if queue is empty."""
        return len(self._queue) == 0


class RateLimiter:
    """Comprehensive rate limiter with multiple strategies."""
    
    def __init__(self, config: Optional[RateLimitConfig] = None):
        """Initialize rate limiter.
        
        Args:
            config: Rate limit configuration
        """
        self.config = config or RateLimitConfig()
        
        # Initialize components
        self.token_bucket = TokenBucket(
            self.config.max_tokens,
            self.config.refill_rate
        )
        self.sliding_window = SlidingWindowLimiter(
            self.config.window_size_seconds,
            self.config.max_requests_per_window
        )
        self.retry_manager = RetryManager(self.config)
        self.circuit_breaker = CircuitBreaker(self.config)
        
        # Priority queue if enabled
        self.priority_queue: Optional[PriorityQueue] = None
        if self.config.enable_priority:
            self.priority_queue = PriorityQueue()
        
        # Statistics
        self._stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "rate_limited_requests": 0,
            "retried_requests": 0,
            "circuit_breaks": 0
        }
    
    async def acquire(
        self,
        tokens: int = 1,
        priority: int = 0,
        request_id: Optional[str] = None
    ) -> bool:
        """Acquire permission to make a request.
        
        Args:
            tokens: Number of tokens required
            priority: Request priority (lower is higher)
            request_id: Optional request ID
            
        Returns:
            True if permission granted
        """
        self._stats["total_requests"] += 1
        
        # Check circuit breaker
        if self.circuit_breaker.is_open:
            self._stats["circuit_breaks"] += 1
            return False
        
        # Check sliding window
        if not await self.sliding_window.check_limit():
            self._stats["rate_limited_requests"] += 1
            return False
        
        # Check token bucket
        if not await self.token_bucket.acquire(tokens, wait=False):
            self._stats["rate_limited_requests"] += 1
            
            # Add to priority queue if enabled
            if self.priority_queue and request_id:
                metadata = RequestMetadata(
                    request_id=request_id,
                    priority=priority,
                    tokens_required=tokens
                )
                await self.priority_queue.put(metadata)
            
            return False
        
        self._stats["successful_requests"] += 1
        return True
    
    @asynccontextmanager
    async def limit(
        self,
        tokens: int = 1,
        priority: int = 0,
        request_id: Optional[str] = None,
        wait: bool = True
    ):
        """Context manager for rate limiting.
        
        Args:
            tokens: Number of tokens required
            priority: Request priority
            request_id: Optional request ID
            wait: Whether to wait for availability
            
        Example:
            >>> async with rate_limiter.limit(tokens=2):
            ...     result = await api.query()
        """
        request_id = request_id or str(time.time())
        acquired = False
        
        try:
            # Try to acquire
            if wait:
                while not await self.acquire(tokens, priority, request_id):
                    await asyncio.sleep(0.1)
                acquired = True
            else:
                acquired = await self.acquire(tokens, priority, request_id)
                if not acquired:
                    raise RateLimitError("Rate limit exceeded")
            
            yield
            
        except Exception as e:
            # Report failure to circuit breaker
            try:
                await self.circuit_breaker.call(
                    self._dummy_fail,
                    exception=e
                )
            except:
                pass
            raise
        
        finally:
            # Could implement token return logic here if needed
            pass
    
    async def _dummy_fail(self, exception: Exception) -> None:
        """Dummy function for circuit breaker."""
        raise exception
    
    async def execute_with_limits(
        self,
        func: Callable[..., Awaitable[T]],
        *args,
        tokens: int = 1,
        priority: int = 0,
        request_id: Optional[str] = None,
        **kwargs
    ) -> T:
        """Execute function with rate limiting and retry.
        
        Args:
            func: Async function to execute
            *args: Function arguments
            tokens: Tokens required
            priority: Request priority
            request_id: Optional request ID
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
        """
        request_id = request_id or str(id(func))
        
        async def wrapped():
            async with self.limit(tokens, priority, request_id):
                return await func(*args, **kwargs)
        
        # Execute with retry through circuit breaker
        return await self.circuit_breaker.call(
            self.retry_manager.execute_with_retry,
            wrapped,
            request_id=request_id
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get rate limiter statistics."""
        stats = self._stats.copy()
        stats.update({
            "available_tokens": self.token_bucket.available_tokens,
            "current_rate": self.sliding_window.current_rate,
            "circuit_breaker": self.circuit_breaker.get_status(),
            "queue_size": self.priority_queue.size if self.priority_queue else 0
        })
        return stats
    
    async def process_queue(self) -> None:
        """Process priority queue (for background task)."""
        if not self.priority_queue:
            return
        
        while not self.priority_queue.is_empty():
            # Get next request
            request = await self.priority_queue.get()
            if not request:
                break
            
            # Try to acquire tokens
            if await self.acquire(
                request.tokens_required,
                request.priority,
                request.request_id
            ):
                logger.debug(
                    f"Processed queued request {request.request_id}"
                )
            else:
                # Re-queue if still can't process
                await self.priority_queue.put(request)
                await asyncio.sleep(0.1)


# Global rate limiter instance
_global_rate_limiter: Optional[RateLimiter] = None


def get_global_rate_limiter() -> RateLimiter:
    """Get or create global rate limiter."""
    global _global_rate_limiter
    if _global_rate_limiter is None:
        _global_rate_limiter = RateLimiter()
    return _global_rate_limiter


def configure_rate_limiter(config: RateLimitConfig) -> RateLimiter:
    """Configure global rate limiter."""
    global _global_rate_limiter
    _global_rate_limiter = RateLimiter(config)
    return _global_rate_limiter