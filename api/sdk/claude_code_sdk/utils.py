"""Utility functions and helpers for Claude SDK."""

import asyncio
import time
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
from dataclasses import dataclass
from enum import Enum

from ._errors import RateLimitError, TimeoutError, ValidationError


class RetryStrategy(Enum):
    """Retry strategies for API calls."""
    EXPONENTIAL = "exponential"
    LINEAR = "linear"
    FIXED = "fixed"


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    initial_delay: float = 1.0
    max_delay: float = 60.0
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
    backoff_factor: float = 2.0
    jitter: bool = True
    retry_on: Optional[List[type[Exception]]] = None
    
    def __post_init__(self):
        if self.retry_on is None:
            self.retry_on = [RateLimitError, TimeoutError, ConnectionError]


class InputValidator:
    """Validates inputs for Claude SDK operations."""
    
    @staticmethod
    def validate_prompt(prompt: str, max_length: int = 100000) -> str:
        """Validate and sanitize a prompt string.
        
        Args:
            prompt: The prompt to validate
            max_length: Maximum allowed length
            
        Returns:
            Validated prompt
            
        Raises:
            ValidationError: If prompt is invalid
        """
        if not prompt:
            raise ValidationError("Prompt cannot be empty")
        
        if not isinstance(prompt, str):
            raise ValidationError(f"Prompt must be a string, got {type(prompt)}")
        
        prompt = prompt.strip()
        
        if len(prompt) > max_length:
            raise ValidationError(f"Prompt exceeds maximum length of {max_length} characters")
        
        # Check for potential injection attempts
        dangerous_patterns = [
            "```system",
            "<system>",
            "</system>",
            "IGNORE PREVIOUS INSTRUCTIONS",
            "DISREGARD ALL PRIOR",
        ]
        
        prompt_lower = prompt.lower()
        for pattern in dangerous_patterns:
            if pattern.lower() in prompt_lower:
                raise ValidationError(f"Prompt contains potentially dangerous pattern: {pattern}")
        
        return prompt
    
    @staticmethod
    def validate_session_id(session_id: str) -> str:
        """Validate a session ID.
        
        Args:
            session_id: The session ID to validate
            
        Returns:
            Validated session ID
            
        Raises:
            ValidationError: If session ID is invalid
        """
        if not session_id:
            raise ValidationError("Session ID cannot be empty")
        
        if not isinstance(session_id, str):
            raise ValidationError(f"Session ID must be a string, got {type(session_id)}")
        
        # Allow alphanumeric, underscore, hyphen
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', session_id):
            raise ValidationError("Session ID can only contain letters, numbers, underscores, and hyphens")
        
        if len(session_id) > 128:
            raise ValidationError("Session ID cannot exceed 128 characters")
        
        return session_id
    
    @staticmethod
    def validate_options(options: Dict[str, Any]) -> Dict[str, Any]:
        """Validate ClaudeCodeOptions dictionary.
        
        Args:
            options: Options dictionary to validate
            
        Returns:
            Validated options
            
        Raises:
            ValidationError: If options are invalid
        """
        valid_keys = {
            'system_prompt', 'cwd', 'permission_mode', 'mcp_servers',
            'allowed_tools', 'blocked_tools', 'can_use_tool', 'hooks',
            'permission_prompt_tool_name', 'output_style', 'timeout',
            'max_tokens', 'temperature', 'top_p', 'top_k'
        }
        
        invalid_keys = set(options.keys()) - valid_keys
        if invalid_keys:
            raise ValidationError(f"Invalid option keys: {invalid_keys}")
        
        # Validate specific option types
        if 'temperature' in options:
            temp = options['temperature']
            if not isinstance(temp, (int, float)) or temp < 0 or temp > 2:
                raise ValidationError("Temperature must be between 0 and 2")
        
        if 'max_tokens' in options:
            tokens = options['max_tokens']
            if not isinstance(tokens, int) or tokens < 1:
                raise ValidationError("max_tokens must be a positive integer")
        
        if 'timeout' in options:
            timeout = options['timeout']
            if not isinstance(timeout, (int, float)) or timeout <= 0:
                raise ValidationError("timeout must be a positive number")
        
        return options


T = TypeVar('T')


def with_retry(config: Optional[RetryConfig] = None):
    """Decorator to add retry logic to async functions.
    
    Args:
        config: Retry configuration. Uses default if not provided.
        
    Example:
        @with_retry(RetryConfig(max_attempts=5))
        async def api_call():
            return await make_request()
    """
    if config is None:
        config = RetryConfig()
    
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(config.max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    # Check if we should retry this exception
                    if config.retry_on and not any(isinstance(e, exc_type) for exc_type in config.retry_on):
                        raise
                    
                    # Don't retry on last attempt
                    if attempt == config.max_attempts - 1:
                        raise
                    
                    # Calculate delay
                    if config.strategy == RetryStrategy.EXPONENTIAL:
                        delay = min(config.initial_delay * (config.backoff_factor ** attempt), config.max_delay)
                    elif config.strategy == RetryStrategy.LINEAR:
                        delay = min(config.initial_delay * (attempt + 1), config.max_delay)
                    else:  # FIXED
                        delay = config.initial_delay
                    
                    # Add jitter if enabled
                    if config.jitter:
                        import random
                        delay *= (0.5 + random.random())
                    
                    await asyncio.sleep(delay)
            
            if last_exception:
                raise last_exception
        
        return wrapper
    return decorator


class CallbackManager:
    """Manages callbacks for various SDK events."""
    
    def __init__(self):
        self._callbacks: Dict[str, List[Callable]] = {}
    
    def register(self, event: str, callback: Callable) -> None:
        """Register a callback for an event.
        
        Args:
            event: Event name (e.g., 'message_received', 'error', 'rate_limit')
            callback: Callback function to execute
        """
        if event not in self._callbacks:
            self._callbacks[event] = []
        self._callbacks[event].append(callback)
    
    def unregister(self, event: str, callback: Callable) -> None:
        """Unregister a callback.
        
        Args:
            event: Event name
            callback: Callback to remove
        """
        if event in self._callbacks:
            self._callbacks[event].remove(callback)
    
    async def trigger(self, event: str, *args, **kwargs) -> None:
        """Trigger all callbacks for an event.
        
        Args:
            event: Event name
            *args: Positional arguments for callbacks
            **kwargs: Keyword arguments for callbacks
        """
        if event in self._callbacks:
            for callback in self._callbacks[event]:
                if asyncio.iscoroutinefunction(callback):
                    await callback(*args, **kwargs)
                else:
                    callback(*args, **kwargs)


class MetricsCollector:
    """Collects metrics for SDK operations."""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        """Reset all metrics."""
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.total_tokens = 0
        self.total_cost = 0.0
        self.request_durations: List[float] = []
        self.errors: Dict[str, int] = {}
        self.start_time = time.time()
    
    def record_request(self, success: bool, duration: float, tokens: int = 0, cost: float = 0.0):
        """Record a request.
        
        Args:
            success: Whether request was successful
            duration: Request duration in seconds
            tokens: Number of tokens used
            cost: Cost in USD
        """
        self.total_requests += 1
        if success:
            self.successful_requests += 1
        else:
            self.failed_requests += 1
        
        self.request_durations.append(duration)
        self.total_tokens += tokens
        self.total_cost += cost
    
    def record_error(self, error_type: str):
        """Record an error.
        
        Args:
            error_type: Type of error that occurred
        """
        if error_type not in self.errors:
            self.errors[error_type] = 0
        self.errors[error_type] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics.
        
        Returns:
            Dictionary with metrics
        """
        uptime = time.time() - self.start_time
        avg_duration = sum(self.request_durations) / len(self.request_durations) if self.request_durations else 0
        
        return {
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "success_rate": self.successful_requests / self.total_requests if self.total_requests > 0 else 0,
            "total_tokens": self.total_tokens,
            "total_cost_usd": self.total_cost,
            "average_duration_seconds": avg_duration,
            "errors": dict(self.errors),
            "uptime_seconds": uptime,
            "requests_per_minute": (self.total_requests / uptime) * 60 if uptime > 0 else 0
        }


class ResponseFormatter:
    """Formats Claude responses in various ways."""
    
    @staticmethod
    def to_markdown(response: str) -> str:
        """Convert response to markdown format.
        
        Args:
            response: Raw response text
            
        Returns:
            Markdown formatted response
        """
        # Add proper code block formatting
        import re
        
        # Find code blocks and ensure they have language hints
        def replace_code_block(match):
            code = match.group(1)
            # Try to detect language
            if 'import ' in code or 'def ' in code or 'class ' in code:
                return f"```python\n{code}\n```"
            elif 'function ' in code or 'const ' in code or 'let ' in code:
                return f"```javascript\n{code}\n```"
            elif 'SELECT ' in code.upper() or 'FROM ' in code.upper():
                return f"```sql\n{code}\n```"
            else:
                return f"```\n{code}\n```"
        
        response = re.sub(r'```\n(.*?)\n```', replace_code_block, response, flags=re.DOTALL)
        
        return response
    
    @staticmethod
    def to_json(response: str, indent: int = 2) -> str:
        """Convert response to JSON format.
        
        Args:
            response: Raw response text
            indent: JSON indentation level
            
        Returns:
            JSON formatted response
        """
        import json
        
        data = {
            "response": response,
            "timestamp": time.time(),
            "formatted": True
        }
        
        return json.dumps(data, indent=indent)
    
    @staticmethod
    def extract_code_blocks(response: str) -> List[Dict[str, str]]:
        """Extract code blocks from response.
        
        Args:
            response: Response containing code blocks
            
        Returns:
            List of dictionaries with 'language' and 'code' keys
        """
        import re
        
        pattern = r'```(\w+)?\n(.*?)\n```'
        matches = re.findall(pattern, response, re.DOTALL)
        
        return [
            {"language": lang or "plain", "code": code}
            for lang, code in matches
        ]


class ConversationMemory:
    """Manages conversation history and context."""
    
    def __init__(self, max_messages: int = 100):
        self.max_messages = max_messages
        self.messages: List[Dict[str, Any]] = []
        self.context: Dict[str, Any] = {}
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None):
        """Add a message to history.
        
        Args:
            role: Message role (user/assistant/system)
            content: Message content
            metadata: Optional metadata
        """
        message = {
            "role": role,
            "content": content,
            "timestamp": time.time(),
            "metadata": metadata or {}
        }
        
        self.messages.append(message)
        
        # Trim if exceeds max
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages:]
    
    def get_context_window(self, n: int = 10) -> List[Dict[str, Any]]:
        """Get last n messages for context.
        
        Args:
            n: Number of messages to retrieve
            
        Returns:
            List of recent messages
        """
        return self.messages[-n:] if self.messages else []
    
    def set_context(self, key: str, value: Any):
        """Set context variable.
        
        Args:
            key: Context key
            value: Context value
        """
        self.context[key] = value
    
    def get_context(self, key: str, default: Any = None) -> Any:
        """Get context variable.
        
        Args:
            key: Context key
            default: Default value if key not found
            
        Returns:
            Context value or default
        """
        return self.context.get(key, default)
    
    def clear(self):
        """Clear all messages and context."""
        self.messages.clear()
        self.context.clear()
    
    def summarize(self) -> Dict[str, Any]:
        """Get conversation summary.
        
        Returns:
            Summary dictionary
        """
        return {
            "message_count": len(self.messages),
            "context_keys": list(self.context.keys()),
            "oldest_message": self.messages[0]["timestamp"] if self.messages else None,
            "newest_message": self.messages[-1]["timestamp"] if self.messages else None,
            "roles": list(set(m["role"] for m in self.messages))
        }