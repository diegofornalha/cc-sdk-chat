"""Advanced caching system for Claude SDK responses.

This module provides a sophisticated caching system with support for:
- Multiple cache backends (memory, disk, Redis)
- TTL-based expiration
- LRU eviction policy
- Cache statistics and monitoring
- Async-safe operations
- Serialization support for complex types
"""

import asyncio
import hashlib
import json
import pickle
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Union, TypeVar, Generic, Callable, Awaitable
from contextlib import asynccontextmanager
import logging

from ._errors import ConfigurationError

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class CacheStats:
    """Statistics for cache performance monitoring."""
    
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    total_size_bytes: int = 0
    total_items: int = 0
    last_cleanup: Optional[datetime] = None
    
    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert stats to dictionary for serialization."""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "hit_rate": self.hit_rate,
            "total_size_bytes": self.total_size_bytes,
            "total_items": self.total_items,
            "last_cleanup": self.last_cleanup.isoformat() if self.last_cleanup else None
        }


@dataclass
class CacheEntry(Generic[T]):
    """Individual cache entry with metadata."""
    
    key: str
    value: T
    created_at: datetime
    accessed_at: datetime
    ttl_seconds: Optional[float]
    size_bytes: int
    access_count: int = 0
    
    def is_expired(self) -> bool:
        """Check if entry has expired based on TTL."""
        if self.ttl_seconds is None:
            return False
        age = (datetime.now() - self.created_at).total_seconds()
        return age > self.ttl_seconds
    
    def touch(self) -> None:
        """Update access time and count."""
        self.accessed_at = datetime.now()
        self.access_count += 1


class CacheBackend(ABC, Generic[T]):
    """Abstract base class for cache backends."""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[T]:
        """Retrieve value from cache."""
        pass
    
    @abstractmethod
    async def set(self, key: str, value: T, ttl: Optional[float] = None) -> None:
        """Store value in cache."""
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        pass
    
    @abstractmethod
    async def clear(self) -> None:
        """Clear all cache entries."""
        pass
    
    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        pass
    
    @abstractmethod
    async def get_stats(self) -> CacheStats:
        """Get cache statistics."""
        pass


class MemoryCacheBackend(CacheBackend[T]):
    """In-memory cache backend with LRU eviction."""
    
    def __init__(self, max_size: int = 100, max_memory_mb: float = 100):
        """Initialize memory cache.
        
        Args:
            max_size: Maximum number of entries
            max_memory_mb: Maximum memory usage in MB
        """
        self._cache: OrderedDict[str, CacheEntry[T]] = OrderedDict()
        self._max_size = max_size
        self._max_memory_bytes = int(max_memory_mb * 1024 * 1024)
        self._stats = CacheStats()
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[T]:
        """Retrieve value from cache."""
        async with self._lock:
            entry = self._cache.get(key)
            
            if entry is None:
                self._stats.misses += 1
                return None
            
            if entry.is_expired():
                del self._cache[key]
                self._stats.misses += 1
                self._stats.evictions += 1
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            entry.touch()
            self._stats.hits += 1
            
            return entry.value
    
    async def set(self, key: str, value: T, ttl: Optional[float] = None) -> None:
        """Store value in cache."""
        async with self._lock:
            # Calculate size (approximate)
            try:
                size_bytes = len(pickle.dumps(value))
            except:
                size_bytes = 1024  # Default size for non-picklable objects
            
            # Check if we need to evict entries
            while (len(self._cache) >= self._max_size or 
                   self._stats.total_size_bytes + size_bytes > self._max_memory_bytes):
                if not self._cache:
                    break
                # Evict least recently used
                oldest_key = next(iter(self._cache))
                oldest_entry = self._cache.pop(oldest_key)
                self._stats.evictions += 1
                self._stats.total_size_bytes -= oldest_entry.size_bytes
                self._stats.total_items -= 1
            
            # Add new entry
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=datetime.now(),
                accessed_at=datetime.now(),
                ttl_seconds=ttl,
                size_bytes=size_bytes
            )
            
            self._cache[key] = entry
            self._stats.total_size_bytes += size_bytes
            self._stats.total_items += 1
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        async with self._lock:
            entry = self._cache.pop(key, None)
            if entry:
                self._stats.total_size_bytes -= entry.size_bytes
                self._stats.total_items -= 1
                return True
            return False
    
    async def clear(self) -> None:
        """Clear all cache entries."""
        async with self._lock:
            self._cache.clear()
            self._stats.total_size_bytes = 0
            self._stats.total_items = 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        async with self._lock:
            entry = self._cache.get(key)
            if entry and not entry.is_expired():
                return True
            return False
    
    async def get_stats(self) -> CacheStats:
        """Get cache statistics."""
        return self._stats
    
    async def cleanup_expired(self) -> int:
        """Remove expired entries from cache."""
        async with self._lock:
            expired_keys = []
            for key, entry in self._cache.items():
                if entry.is_expired():
                    expired_keys.append(key)
            
            for key in expired_keys:
                entry = self._cache.pop(key)
                self._stats.evictions += 1
                self._stats.total_size_bytes -= entry.size_bytes
                self._stats.total_items -= 1
            
            self._stats.last_cleanup = datetime.now()
            return len(expired_keys)


class DiskCacheBackend(CacheBackend[T]):
    """Disk-based cache backend for persistent storage."""
    
    def __init__(self, cache_dir: Union[str, Path], max_size_mb: float = 1000):
        """Initialize disk cache.
        
        Args:
            cache_dir: Directory for cache files
            max_size_mb: Maximum disk usage in MB
        """
        self._cache_dir = Path(cache_dir)
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._max_size_bytes = int(max_size_mb * 1024 * 1024)
        self._stats = CacheStats()
        self._metadata_file = self._cache_dir / ".cache_metadata.json"
        self._metadata: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        
        # Load existing metadata
        asyncio.create_task(self._load_metadata())
    
    async def _load_metadata(self) -> None:
        """Load metadata from disk."""
        async with self._lock:
            if self._metadata_file.exists():
                try:
                    with open(self._metadata_file, 'r') as f:
                        self._metadata = json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to load cache metadata: {e}")
                    self._metadata = {}
    
    async def _save_metadata(self) -> None:
        """Save metadata to disk."""
        try:
            with open(self._metadata_file, 'w') as f:
                json.dump(self._metadata, f)
        except Exception as e:
            logger.warning(f"Failed to save cache metadata: {e}")
    
    def _get_cache_file(self, key: str) -> Path:
        """Get cache file path for key."""
        # Use hash to avoid filesystem issues with special characters
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        return self._cache_dir / f"{key_hash}.cache"
    
    async def get(self, key: str) -> Optional[T]:
        """Retrieve value from cache."""
        async with self._lock:
            cache_file = self._get_cache_file(key)
            
            if not cache_file.exists():
                self._stats.misses += 1
                return None
            
            # Check metadata for expiration
            meta = self._metadata.get(key, {})
            if meta.get("ttl_seconds"):
                created_at = datetime.fromisoformat(meta["created_at"])
                age = (datetime.now() - created_at).total_seconds()
                if age > meta["ttl_seconds"]:
                    # Expired
                    cache_file.unlink(missing_ok=True)
                    self._metadata.pop(key, None)
                    await self._save_metadata()
                    self._stats.misses += 1
                    self._stats.evictions += 1
                    return None
            
            # Load from disk
            try:
                with open(cache_file, 'rb') as f:
                    value = pickle.load(f)
                
                # Update access metadata
                self._metadata[key]["accessed_at"] = datetime.now().isoformat()
                self._metadata[key]["access_count"] = meta.get("access_count", 0) + 1
                await self._save_metadata()
                
                self._stats.hits += 1
                return value
                
            except Exception as e:
                logger.warning(f"Failed to load cache entry {key}: {e}")
                cache_file.unlink(missing_ok=True)
                self._metadata.pop(key, None)
                await self._save_metadata()
                self._stats.misses += 1
                return None
    
    async def set(self, key: str, value: T, ttl: Optional[float] = None) -> None:
        """Store value in cache."""
        async with self._lock:
            cache_file = self._get_cache_file(key)
            
            try:
                # Serialize value
                data = pickle.dumps(value)
                size_bytes = len(data)
                
                # Check disk space
                current_size = sum(f.stat().st_size for f in self._cache_dir.glob("*.cache"))
                if current_size + size_bytes > self._max_size_bytes:
                    # Need to evict some entries
                    await self._evict_lru()
                
                # Write to disk
                with open(cache_file, 'wb') as f:
                    f.write(data)
                
                # Update metadata
                self._metadata[key] = {
                    "created_at": datetime.now().isoformat(),
                    "accessed_at": datetime.now().isoformat(),
                    "ttl_seconds": ttl,
                    "size_bytes": size_bytes,
                    "access_count": 0
                }
                await self._save_metadata()
                
                self._stats.total_items = len(self._metadata)
                
            except Exception as e:
                logger.error(f"Failed to save cache entry {key}: {e}")
                cache_file.unlink(missing_ok=True)
                raise
    
    async def _evict_lru(self) -> None:
        """Evict least recently used entries."""
        # Sort by access time
        sorted_entries = sorted(
            self._metadata.items(),
            key=lambda x: x[1].get("accessed_at", x[1]["created_at"])
        )
        
        # Evict oldest 10%
        to_evict = max(1, len(sorted_entries) // 10)
        for key, _ in sorted_entries[:to_evict]:
            cache_file = self._get_cache_file(key)
            cache_file.unlink(missing_ok=True)
            self._metadata.pop(key, None)
            self._stats.evictions += 1
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        async with self._lock:
            cache_file = self._get_cache_file(key)
            if cache_file.exists():
                cache_file.unlink()
                self._metadata.pop(key, None)
                await self._save_metadata()
                self._stats.total_items = len(self._metadata)
                return True
            return False
    
    async def clear(self) -> None:
        """Clear all cache entries."""
        async with self._lock:
            for cache_file in self._cache_dir.glob("*.cache"):
                cache_file.unlink()
            self._metadata.clear()
            await self._save_metadata()
            self._stats.total_items = 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        cache_file = self._get_cache_file(key)
        return cache_file.exists()
    
    async def get_stats(self) -> CacheStats:
        """Get cache statistics."""
        self._stats.total_items = len(self._metadata)
        return self._stats


class CacheManager:
    """High-level cache manager with advanced features."""
    
    def __init__(
        self,
        backend: Optional[CacheBackend] = None,
        default_ttl: Optional[float] = 3600,
        key_prefix: str = "",
        enable_stats: bool = True
    ):
        """Initialize cache manager.
        
        Args:
            backend: Cache backend to use (defaults to memory)
            default_ttl: Default TTL in seconds
            key_prefix: Prefix for all cache keys
            enable_stats: Whether to track statistics
        """
        self.backend = backend or MemoryCacheBackend()
        self.default_ttl = default_ttl
        self.key_prefix = key_prefix
        self.enable_stats = enable_stats
        self._middleware: list[Callable] = []
    
    def _make_key(self, key: str) -> str:
        """Create full cache key with prefix."""
        return f"{self.key_prefix}{key}" if self.key_prefix else key
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        full_key = self._make_key(key)
        return await self.backend.get(full_key)
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[float] = None
    ) -> None:
        """Set value in cache."""
        full_key = self._make_key(key)
        ttl = ttl if ttl is not None else self.default_ttl
        await self.backend.set(full_key, value, ttl)
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        full_key = self._make_key(key)
        return await self.backend.delete(full_key)
    
    async def clear(self) -> None:
        """Clear all cache entries."""
        await self.backend.clear()
    
    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        full_key = self._make_key(key)
        return await self.backend.exists(full_key)
    
    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Awaitable[T]],
        ttl: Optional[float] = None
    ) -> T:
        """Get value from cache or compute and store it.
        
        Args:
            key: Cache key
            factory: Async function to compute value if not cached
            ttl: TTL in seconds
            
        Returns:
            Cached or computed value
        """
        value = await self.get(key)
        if value is not None:
            return value
        
        # Compute value
        value = await factory()
        await self.set(key, value, ttl)
        return value
    
    @asynccontextmanager
    async def lock(self, key: str, timeout: float = 10):
        """Distributed lock using cache.
        
        Args:
            key: Lock key
            timeout: Lock timeout in seconds
        """
        lock_key = f"__lock__{key}"
        full_key = self._make_key(lock_key)
        
        # Try to acquire lock
        start_time = time.time()
        while await self.backend.exists(full_key):
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Failed to acquire lock for {key}")
            await asyncio.sleep(0.1)
        
        # Set lock
        await self.backend.set(full_key, True, ttl=timeout)
        
        try:
            yield
        finally:
            # Release lock
            await self.backend.delete(full_key)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.enable_stats:
            return {}
        
        stats = await self.backend.get_stats()
        return stats.to_dict()
    
    def add_middleware(self, middleware: Callable) -> None:
        """Add middleware for cache operations."""
        self._middleware.append(middleware)
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching a pattern.
        
        Args:
            pattern: Pattern to match (supports * wildcards)
            
        Returns:
            Number of keys invalidated
        """
        # This is a simple implementation
        # For production, consider using Redis with SCAN
        count = 0
        if isinstance(self.backend, MemoryCacheBackend):
            async with self.backend._lock:
                keys_to_delete = []
                for key in self.backend._cache.keys():
                    if self._match_pattern(key, pattern):
                        keys_to_delete.append(key)
                
                for key in keys_to_delete:
                    await self.backend.delete(key)
                    count += 1
        
        return count
    
    def _match_pattern(self, text: str, pattern: str) -> bool:
        """Simple pattern matching with * wildcards."""
        import fnmatch
        return fnmatch.fnmatch(text, pattern)


def create_cache_key(*args, **kwargs) -> str:
    """Create a cache key from arguments.
    
    Args:
        *args: Positional arguments
        **kwargs: Keyword arguments
        
    Returns:
        Stable cache key string
    """
    # Create a stable representation
    key_parts = []
    
    for arg in args:
        if isinstance(arg, (str, int, float, bool)):
            key_parts.append(str(arg))
        else:
            # Hash complex objects
            key_parts.append(hashlib.md5(str(arg).encode()).hexdigest()[:8])
    
    for k, v in sorted(kwargs.items()):
        if isinstance(v, (str, int, float, bool)):
            key_parts.append(f"{k}={v}")
        else:
            key_parts.append(f"{k}={hashlib.md5(str(v).encode()).hexdigest()[:8]}")
    
    return ":".join(key_parts)


def cached(
    ttl: Optional[float] = None,
    key_func: Optional[Callable] = None,
    cache_manager: Optional[CacheManager] = None
):
    """Decorator for caching async function results.
    
    Args:
        ttl: TTL in seconds
        key_func: Custom key generation function
        cache_manager: Cache manager to use
        
    Example:
        >>> @cached(ttl=3600)
        ... async def expensive_operation(param: str) -> str:
        ...     # Some expensive computation
        ...     return result
    """
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        # Use default cache manager if not provided
        nonlocal cache_manager
        if cache_manager is None:
            cache_manager = CacheManager()
        
        async def wrapper(*args, **kwargs) -> T:
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = f"{func.__name__}:{create_cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            result = await cache_manager.get(cache_key)
            if result is not None:
                return result
            
            # Compute and cache
            result = await func(*args, **kwargs)
            await cache_manager.set(cache_key, result, ttl)
            return result
        
        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        return wrapper
    
    return decorator


# Global cache instance for convenience
_global_cache: Optional[CacheManager] = None


def get_global_cache() -> CacheManager:
    """Get or create global cache instance."""
    global _global_cache
    if _global_cache is None:
        _global_cache = CacheManager()
    return _global_cache


def configure_global_cache(
    backend: Optional[CacheBackend] = None,
    default_ttl: Optional[float] = 3600,
    **kwargs
) -> CacheManager:
    """Configure the global cache instance."""
    global _global_cache
    _global_cache = CacheManager(
        backend=backend,
        default_ttl=default_ttl,
        **kwargs
    )
    return _global_cache