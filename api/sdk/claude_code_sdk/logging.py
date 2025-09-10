"""Advanced logging system for Claude SDK.

This module provides structured logging with:
- Multiple output formats (JSON, plain text, colored)
- Contextual logging with correlation IDs
- Performance metrics tracking
- Sensitive data masking
- Log aggregation support
- Async-safe operations
"""

import asyncio
import json
import logging
import sys
import time
import traceback
from collections import defaultdict
from contextlib import contextmanager, asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Callable, TypeVar, Set
from uuid import uuid4
import re
import inspect

T = TypeVar('T')


class LogLevel(Enum):
    """Log levels with numeric values."""
    DEBUG = 10
    INFO = 20
    WARNING = 30
    ERROR = 40
    CRITICAL = 50


@dataclass
class LogContext:
    """Context information for structured logging."""
    
    request_id: str = field(default_factory=lambda: str(uuid4()))
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    correlation_id: Optional[str] = None
    environment: str = "production"
    service_name: str = "claude-sdk"
    service_version: str = "0.1.0"
    extra: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary."""
        data = asdict(self)
        # Remove None values
        return {k: v for k, v in data.items() if v is not None}


@dataclass
class LogMetrics:
    """Performance metrics for operations."""
    
    operation: str
    start_time: float
    end_time: Optional[float] = None
    duration_ms: Optional[float] = None
    success: bool = False
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def complete(self, success: bool = True, error: Optional[str] = None) -> None:
        """Mark operation as complete."""
        self.end_time = time.time()
        self.duration_ms = (self.end_time - self.start_time) * 1000
        self.success = success
        self.error = error


class LogFormatter:
    """Base class for log formatters."""
    
    def format(self, record: Dict[str, Any]) -> str:
        """Format log record."""
        raise NotImplementedError


class JSONFormatter(LogFormatter):
    """JSON log formatter for structured logging."""
    
    def __init__(self, pretty: bool = False, include_stacktrace: bool = True):
        self.pretty = pretty
        self.include_stacktrace = include_stacktrace
    
    def format(self, record: Dict[str, Any]) -> str:
        """Format log record as JSON."""
        # Add timestamp
        record["timestamp"] = datetime.utcnow().isoformat() + "Z"
        
        # Add stack trace for errors
        if self.include_stacktrace and record.get("level") in ["ERROR", "CRITICAL"]:
            if "exception" not in record:
                record["stacktrace"] = traceback.format_stack()
        
        if self.pretty:
            return json.dumps(record, indent=2, default=str)
        return json.dumps(record, default=str)


class PlainTextFormatter(LogFormatter):
    """Plain text log formatter."""
    
    def __init__(self, template: Optional[str] = None):
        self.template = template or "{timestamp} [{level}] {service_name}: {message}"
    
    def format(self, record: Dict[str, Any]) -> str:
        """Format log record as plain text."""
        record["timestamp"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        
        # Handle nested context
        if "context" in record and isinstance(record["context"], dict):
            for key, value in record["context"].items():
                record[f"context.{key}"] = value
        
        try:
            return self.template.format(**record)
        except KeyError:
            # Fallback to simple format
            return f"{record.get('timestamp')} [{record.get('level')}] {record.get('message')}"


class ColoredFormatter(PlainTextFormatter):
    """Colored console formatter."""
    
    COLORS = {
        "DEBUG": "\033[36m",    # Cyan
        "INFO": "\033[32m",     # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",    # Red
        "CRITICAL": "\033[35m", # Magenta
        "RESET": "\033[0m"
    }
    
    def format(self, record: Dict[str, Any]) -> str:
        """Format log record with colors."""
        level = record.get("level", "INFO")
        color = self.COLORS.get(level, "")
        reset = self.COLORS["RESET"]
        
        # Color the level
        if color:
            record["level"] = f"{color}{level}{reset}"
        
        return super().format(record)


class SensitiveDataFilter:
    """Filter for masking sensitive data in logs."""
    
    DEFAULT_PATTERNS = [
        (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]'),  # Email
        (r'\b(?:\d{4}[-\s]?){3}\d{4}\b', '[CARD]'),  # Credit card
        (r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]'),  # SSN
        (r'(?i)(api[_-]?key|password|secret|token)["\']?\s*[:=]\s*["\']?[^"\'\s]+', '[REDACTED]'),  # API keys
    ]
    
    def __init__(self, patterns: Optional[List[tuple]] = None):
        """Initialize filter with patterns.
        
        Args:
            patterns: List of (regex, replacement) tuples
        """
        self.patterns = patterns or self.DEFAULT_PATTERNS
        self.compiled_patterns = [
            (re.compile(pattern), replacement)
            for pattern, replacement in self.patterns
        ]
    
    def filter(self, text: str) -> str:
        """Filter sensitive data from text."""
        for pattern, replacement in self.compiled_patterns:
            text = pattern.sub(replacement, text)
        return text
    
    def filter_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Filter sensitive data from dictionary."""
        filtered = {}
        sensitive_keys = {'password', 'secret', 'token', 'api_key', 'apikey', 'auth'}
        
        for key, value in data.items():
            # Check if key contains sensitive words
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                filtered[key] = '[REDACTED]'
            elif isinstance(value, str):
                filtered[key] = self.filter(value)
            elif isinstance(value, dict):
                filtered[key] = self.filter_dict(value)
            elif isinstance(value, list):
                filtered[key] = [
                    self.filter(item) if isinstance(item, str) else item
                    for item in value
                ]
            else:
                filtered[key] = value
        
        return filtered


class StructuredLogger:
    """Main structured logger for Claude SDK."""
    
    def __init__(
        self,
        name: str = "claude-sdk",
        level: LogLevel = LogLevel.INFO,
        formatter: Optional[LogFormatter] = None,
        output: Optional[Any] = None,
        enable_metrics: bool = True,
        enable_context: bool = True,
        sensitive_filter: Optional[SensitiveDataFilter] = None
    ):
        """Initialize structured logger.
        
        Args:
            name: Logger name
            level: Minimum log level
            formatter: Log formatter (defaults to JSON)
            output: Output stream (defaults to stdout)
            enable_metrics: Whether to track metrics
            enable_context: Whether to include context
            sensitive_filter: Filter for sensitive data
        """
        self.name = name
        self.level = level
        self.formatter = formatter or JSONFormatter()
        self.output = output or sys.stdout
        self.enable_metrics = enable_metrics
        self.enable_context = enable_context
        self.sensitive_filter = sensitive_filter or SensitiveDataFilter()
        
        # Thread-local storage for context
        self._context_stack: List[LogContext] = []
        self._metrics: Dict[str, LogMetrics] = {}
        
        # Performance tracking
        self._log_count = defaultdict(int)
        self._last_reset = time.time()
    
    @property
    def current_context(self) -> Optional[LogContext]:
        """Get current logging context."""
        return self._context_stack[-1] if self._context_stack else None
    
    def _should_log(self, level: LogLevel) -> bool:
        """Check if message should be logged."""
        return level.value >= self.level.value
    
    def _prepare_record(
        self,
        level: LogLevel,
        message: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Prepare log record."""
        record = {
            "level": level.name,
            "message": message,
            "logger": self.name,
            **kwargs
        }
        
        # Add context if enabled
        if self.enable_context and self.current_context:
            record["context"] = self.current_context.to_dict()
        
        # Add caller information
        frame = inspect.currentframe()
        if frame and frame.f_back and frame.f_back.f_back:
            caller = frame.f_back.f_back
            record["source"] = {
                "file": caller.f_code.co_filename,
                "line": caller.f_lineno,
                "function": caller.f_code.co_name
            }
        
        # Filter sensitive data
        if self.sensitive_filter:
            record = self.sensitive_filter.filter_dict(record)
        
        return record
    
    def _write(self, record: Dict[str, Any]) -> None:
        """Write log record to output."""
        formatted = self.formatter.format(record)
        
        if hasattr(self.output, 'write'):
            self.output.write(formatted + '\n')
            if hasattr(self.output, 'flush'):
                self.output.flush()
        else:
            print(formatted)
        
        # Track log count
        self._log_count[record["level"]] += 1
    
    def log(self, level: LogLevel, message: str, **kwargs) -> None:
        """Log a message at specified level."""
        if not self._should_log(level):
            return
        
        record = self._prepare_record(level, message, **kwargs)
        self._write(record)
    
    def debug(self, message: str, **kwargs) -> None:
        """Log debug message."""
        self.log(LogLevel.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs) -> None:
        """Log info message."""
        self.log(LogLevel.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs) -> None:
        """Log warning message."""
        self.log(LogLevel.WARNING, message, **kwargs)
    
    def error(self, message: str, exception: Optional[Exception] = None, **kwargs) -> None:
        """Log error message."""
        if exception:
            kwargs["exception"] = {
                "type": type(exception).__name__,
                "message": str(exception),
                "traceback": traceback.format_exception(
                    type(exception), exception, exception.__traceback__
                )
            }
        self.log(LogLevel.ERROR, message, **kwargs)
    
    def critical(self, message: str, **kwargs) -> None:
        """Log critical message."""
        self.log(LogLevel.CRITICAL, message, **kwargs)
    
    @contextmanager
    def context(self, **kwargs):
        """Context manager for adding context to logs.
        
        Example:
            >>> with logger.context(user_id="123", operation="query"):
            ...     logger.info("Processing request")
        """
        ctx = LogContext(**kwargs)
        self._context_stack.append(ctx)
        try:
            yield ctx
        finally:
            self._context_stack.pop()
    
    @asynccontextmanager
    async def async_context(self, **kwargs):
        """Async context manager for adding context to logs."""
        ctx = LogContext(**kwargs)
        self._context_stack.append(ctx)
        try:
            yield ctx
        finally:
            self._context_stack.pop()
    
    @contextmanager
    def timer(self, operation: str, **metadata):
        """Context manager for timing operations.
        
        Example:
            >>> with logger.timer("api_call", endpoint="/query"):
            ...     result = await api.query()
        """
        metrics = LogMetrics(
            operation=operation,
            start_time=time.time(),
            metadata=metadata
        )
        
        metric_id = str(uuid4())
        self._metrics[metric_id] = metrics
        
        try:
            self.debug(f"Starting {operation}", metrics=metadata)
            yield metrics
            metrics.complete(success=True)
            
        except Exception as e:
            metrics.complete(success=False, error=str(e))
            raise
        
        finally:
            if self.enable_metrics:
                self.info(
                    f"Completed {operation}",
                    duration_ms=metrics.duration_ms,
                    success=metrics.success,
                    metrics=metadata
                )
            del self._metrics[metric_id]
    
    @asynccontextmanager
    async def async_timer(self, operation: str, **metadata):
        """Async context manager for timing operations."""
        metrics = LogMetrics(
            operation=operation,
            start_time=time.time(),
            metadata=metadata
        )
        
        metric_id = str(uuid4())
        self._metrics[metric_id] = metrics
        
        try:
            self.debug(f"Starting {operation}", metrics=metadata)
            yield metrics
            metrics.complete(success=True)
            
        except Exception as e:
            metrics.complete(success=False, error=str(e))
            raise
        
        finally:
            if self.enable_metrics:
                self.info(
                    f"Completed {operation}",
                    duration_ms=metrics.duration_ms,
                    success=metrics.success,
                    metrics=metadata
                )
            del self._metrics[metric_id]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get logging statistics."""
        uptime = time.time() - self._last_reset
        return {
            "log_counts": dict(self._log_count),
            "uptime_seconds": uptime,
            "logs_per_second": sum(self._log_count.values()) / uptime if uptime > 0 else 0,
            "active_contexts": len(self._context_stack),
            "active_metrics": len(self._metrics)
        }
    
    def reset_stats(self) -> None:
        """Reset logging statistics."""
        self._log_count.clear()
        self._last_reset = time.time()


class LoggerFactory:
    """Factory for creating and managing loggers."""
    
    _loggers: Dict[str, StructuredLogger] = {}
    _default_config: Dict[str, Any] = {}
    
    @classmethod
    def configure_default(cls, **kwargs) -> None:
        """Configure default settings for new loggers."""
        cls._default_config = kwargs
    
    @classmethod
    def get_logger(cls, name: str = "claude-sdk", **kwargs) -> StructuredLogger:
        """Get or create a logger.
        
        Args:
            name: Logger name
            **kwargs: Logger configuration
            
        Returns:
            Structured logger instance
        """
        if name not in cls._loggers:
            config = {**cls._default_config, **kwargs}
            cls._loggers[name] = StructuredLogger(name=name, **config)
        return cls._loggers[name]
    
    @classmethod
    def configure_from_env(cls) -> None:
        """Configure logging from environment variables."""
        import os
        
        # Log level
        level_str = os.environ.get("CLAUDE_SDK_LOG_LEVEL", "INFO")
        level = LogLevel[level_str.upper()]
        
        # Output format
        format_type = os.environ.get("CLAUDE_SDK_LOG_FORMAT", "json")
        if format_type == "json":
            formatter = JSONFormatter(
                pretty=os.environ.get("CLAUDE_SDK_LOG_PRETTY", "false").lower() == "true"
            )
        elif format_type == "plain":
            formatter = PlainTextFormatter()
        elif format_type == "colored":
            formatter = ColoredFormatter()
        else:
            formatter = JSONFormatter()
        
        # Configure default
        cls.configure_default(
            level=level,
            formatter=formatter,
            enable_metrics=os.environ.get("CLAUDE_SDK_LOG_METRICS", "true").lower() == "true",
            enable_context=os.environ.get("CLAUDE_SDK_LOG_CONTEXT", "true").lower() == "true"
        )


# Convenience functions
def get_logger(name: str = "claude-sdk") -> StructuredLogger:
    """Get a logger instance."""
    return LoggerFactory.get_logger(name)


def configure_logging(**kwargs) -> None:
    """Configure default logging settings."""
    LoggerFactory.configure_default(**kwargs)


def log_function_call(
    logger: Optional[StructuredLogger] = None,
    level: LogLevel = LogLevel.DEBUG,
    include_args: bool = True,
    include_result: bool = False,
    max_length: int = 100
):
    """Decorator for logging function calls.
    
    Args:
        logger: Logger to use (defaults to module logger)
        level: Log level
        include_args: Whether to log arguments
        include_result: Whether to log return value
        max_length: Maximum length for logged values
        
    Example:
        >>> @log_function_call(include_result=True)
        ... async def process_data(data: str) -> str:
        ...     return data.upper()
    """
    def decorator(func: Callable) -> Callable:
        nonlocal logger
        if logger is None:
            logger = get_logger(func.__module__)
        
        def truncate(value: Any) -> str:
            """Truncate long values."""
            s = str(value)
            if len(s) > max_length:
                return s[:max_length] + "..."
            return s
        
        if asyncio.iscoroutinefunction(func):
            async def async_wrapper(*args, **kwargs):
                call_id = str(uuid4())[:8]
                
                # Log call
                log_data = {"call_id": call_id, "function": func.__name__}
                if include_args:
                    log_data["args"] = [truncate(arg) for arg in args]
                    log_data["kwargs"] = {k: truncate(v) for k, v in kwargs.items()}
                
                logger.log(level, f"Calling {func.__name__}", **log_data)
                
                try:
                    result = await func(*args, **kwargs)
                    
                    # Log result
                    if include_result:
                        logger.log(
                            level,
                            f"Completed {func.__name__}",
                            call_id=call_id,
                            result=truncate(result)
                        )
                    
                    return result
                    
                except Exception as e:
                    logger.error(
                        f"Error in {func.__name__}",
                        call_id=call_id,
                        exception=e
                    )
                    raise
            
            return async_wrapper
        
        else:
            def sync_wrapper(*args, **kwargs):
                call_id = str(uuid4())[:8]
                
                # Log call
                log_data = {"call_id": call_id, "function": func.__name__}
                if include_args:
                    log_data["args"] = [truncate(arg) for arg in args]
                    log_data["kwargs"] = {k: truncate(v) for k, v in kwargs.items()}
                
                logger.log(level, f"Calling {func.__name__}", **log_data)
                
                try:
                    result = func(*args, **kwargs)
                    
                    # Log result
                    if include_result:
                        logger.log(
                            level,
                            f"Completed {func.__name__}",
                            call_id=call_id,
                            result=truncate(result)
                        )
                    
                    return result
                    
                except Exception as e:
                    logger.error(
                        f"Error in {func.__name__}",
                        call_id=call_id,
                        exception=e
                    )
                    raise
            
            return sync_wrapper
    
    return decorator


# Configure from environment on import
LoggerFactory.configure_from_env()