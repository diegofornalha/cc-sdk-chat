"""Error types for Claude SDK.

This module provides a comprehensive hierarchy of exceptions for the Claude SDK,
enabling precise error handling and debugging in client applications.

Example:
    Basic error handling:
    >>> try:
    ...     async for msg in query(prompt="Hello"):
    ...         print(msg)
    ... except CLINotFoundError:
    ...     print("Please install Claude Code CLI")
    ... except TimeoutError as e:
    ...     print(f"Request timed out after {e.timeout}s")
    ... except ClaudeSDKError as e:
    ...     print(f"SDK error: {e}")
"""

from typing import Any, Optional, Dict


class ClaudeSDKError(Exception):
    """Base exception for all Claude SDK errors.
    
    All SDK-specific exceptions inherit from this class, allowing for
    broad exception handling when specific error types don't matter.
    """


class CLIConnectionError(ClaudeSDKError):
    """Raised when unable to connect to Claude Code.
    
    This can occur due to:
    - Claude Code not running
    - Network issues
    - Permission problems
    - Invalid configuration
    """


class CLINotFoundError(CLIConnectionError):
    """Raised when Claude Code is not found or not installed.
    
    Attributes:
        cli_path: The path that was searched for the CLI
    """

    def __init__(
        self, message: str = "Claude Code not found", cli_path: Optional[str] = None
    ):
        """Initialize CLINotFoundError.
        
        Args:
            message: Error message to display
            cli_path: Optional path where CLI was expected
        """
        if cli_path:
            message = f"{message}: {cli_path}"
        self.cli_path = cli_path
        super().__init__(message)


class ProcessError(ClaudeSDKError):
    """Raised when the CLI process fails.
    
    Attributes:
        exit_code: Process exit code if available
        stderr: Error output from the process
    """

    def __init__(
        self, message: str, exit_code: Optional[int] = None, stderr: Optional[str] = None
    ):
        """Initialize ProcessError.
        
        Args:
            message: Error description
            exit_code: Optional process exit code
            stderr: Optional error output from process
        """
        self.exit_code = exit_code
        self.stderr = stderr

        if exit_code is not None:
            message = f"{message} (exit code: {exit_code})"
        if stderr:
            message = f"{message}\nError output: {stderr}"

        super().__init__(message)


class CLIJSONDecodeError(ClaudeSDKError):
    """Raised when unable to decode JSON from CLI output.
    
    Attributes:
        line: The line that failed to decode
        original_error: The underlying JSON decode exception
    """

    def __init__(self, line: str, original_error: Exception):
        """Initialize CLIJSONDecodeError.
        
        Args:
            line: The line that failed to parse as JSON
            original_error: The original exception from json.loads()
        """
        self.line = line
        self.original_error = original_error
        super().__init__(f"Failed to decode JSON: {line[:100]}...")


class MessageParseError(ClaudeSDKError):
    """Raised when unable to parse a message from CLI output.
    
    Attributes:
        data: The raw data that failed to parse
    """

    def __init__(self, message: str, data: Optional[Dict[str, Any]] = None):
        """Initialize MessageParseError.
        
        Args:
            message: Error description
            data: Optional raw data that failed to parse
        """
        self.data = data
        super().__init__(message)


# New specific exception classes for better error handling

class ValidationError(ClaudeSDKError):
    """Raised when input validation fails.
    
    This includes:
    - Invalid parameter combinations
    - Malformed prompts
    - Configuration conflicts
    
    Attributes:
        field: The field that failed validation
        value: The invalid value
    """
    
    def __init__(self, message: str, field: Optional[str] = None, value: Any = None):
        """Initialize ValidationError.
        
        Args:
            message: Error description
            field: Optional field name that failed validation
            value: Optional invalid value
        """
        self.field = field
        self.value = value
        super().__init__(message)


class TimeoutError(ClaudeSDKError):
    """Raised when an operation times out.
    
    Attributes:
        timeout_seconds: The timeout duration in seconds
        operation: Description of the operation that timed out
    """
    
    def __init__(self, message: str, timeout_seconds: Optional[float] = None, operation: Optional[str] = None):
        """Initialize TimeoutError.
        
        Args:
            message: Error description
            timeout_seconds: Optional timeout duration in seconds
            operation: Optional description of what timed out
        """
        self.timeout_seconds = timeout_seconds
        self.operation = operation
        super().__init__(message)


class AuthenticationError(ClaudeSDKError):
    """Raised when authentication fails.
    
    This can occur when:
    - API key is invalid
    - Permissions are insufficient
    - Session has expired
    
    Attributes:
        status_code: HTTP status code if available
    """
    
    def __init__(self, message: str, status_code: Optional[int] = None):
        """Initialize AuthenticationError.
        
        Args:
            message: Error description
            status_code: Optional HTTP status code
        """
        self.status_code = status_code
        super().__init__(message)


class RateLimitError(ClaudeSDKError):
    """Raised when rate limits are exceeded.
    
    Attributes:
        retry_after_seconds: Seconds to wait before retrying
        limit_type: Type of limit hit (requests, tokens, etc.)
    """
    
    def __init__(self, message: str, retry_after_seconds: Optional[float] = None, limit_type: Optional[str] = None):
        """Initialize RateLimitError.
        
        Args:
            message: Error description
            retry_after_seconds: Optional seconds to wait before retry
            limit_type: Optional type of rate limit hit
        """
        self.retry_after_seconds = retry_after_seconds
        self.limit_type = limit_type
        super().__init__(message)


class TransportError(ClaudeSDKError):
    """Raised when transport-level errors occur.
    
    This is a base class for transport-specific errors like
    network issues, protocol errors, or transport configuration problems.
    """


class ProtocolError(TransportError):
    """Raised when the communication protocol is violated.
    
    This includes:
    - Unexpected message formats
    - Invalid state transitions
    - Protocol version mismatches
    
    Attributes:
        expected: What was expected
        received: What was actually received
    """
    
    def __init__(self, message: str, expected: Optional[str] = None, received: Optional[str] = None):
        """Initialize ProtocolError.
        
        Args:
            message: Error description
            expected: Optional description of expected format/value
            received: Optional description of received format/value
        """
        self.expected = expected
        self.received = received
        super().__init__(message)


class ConfigurationError(ClaudeSDKError):
    """Raised when SDK configuration is invalid.
    
    Attributes:
        parameter: The configuration parameter that has an issue
        suggestion: Optional suggestion for fixing the issue
    """
    
    def __init__(self, message: str, parameter: Optional[str] = None, suggestion: Optional[str] = None):
        """Initialize ConfigurationError.
        
        Args:
            message: Error description
            parameter: Optional configuration parameter with issue
            suggestion: Optional suggestion for resolution
        """
        self.parameter = parameter
        self.suggestion = suggestion
        if suggestion:
            message = f"{message}\nSuggestion: {suggestion}"
        super().__init__(message)
