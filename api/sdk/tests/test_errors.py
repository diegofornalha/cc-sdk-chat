"""Test suite for SDK error classes."""

import pytest
from claude_code_sdk import (
    AuthenticationError,
    CLIConnectionError,
    CLIJSONDecodeError,
    CLINotFoundError,
    ClaudeSDKError,
    ConfigurationError,
    ProcessError,
    ProtocolError,
    RateLimitError,
    TimeoutError,
    TransportError,
    ValidationError,
)


class TestBaseErrors:
    """Test base error classes."""
    
    def test_claude_sdk_error(self):
        """Test base ClaudeSDKError."""
        error = ClaudeSDKError("Test error")
        assert str(error) == "Test error"
        assert isinstance(error, Exception)
    
    def test_transport_error(self):
        """Test TransportError base class."""
        error = TransportError("Transport failed")
        assert str(error) == "Transport failed"
        assert isinstance(error, ClaudeSDKError)


class TestSpecificErrors:
    """Test specific error classes with their attributes."""
    
    def test_validation_error(self):
        """Test ValidationError with field and value attributes."""
        error = ValidationError(
            "Invalid value for field",
            field="test_field",
            value="invalid_value"
        )
        assert str(error) == "Invalid value for field"
        assert error.field == "test_field"
        assert error.value == "invalid_value"
        assert isinstance(error, ClaudeSDKError)
    
    def test_validation_error_without_attributes(self):
        """Test ValidationError without optional attributes."""
        error = ValidationError("Generic validation error")
        assert str(error) == "Generic validation error"
        assert error.field is None
        assert error.value is None
    
    def test_timeout_error(self):
        """Test TimeoutError with operation and timeout attributes."""
        error = TimeoutError(
            "Operation timed out",
            operation="connect",
            timeout_seconds=30
        )
        assert str(error) == "Operation timed out"
        assert error.operation == "connect"
        assert error.timeout_seconds == 30
        assert isinstance(error, ClaudeSDKError)
    
    def test_timeout_error_without_attributes(self):
        """Test TimeoutError without optional attributes."""
        error = TimeoutError("Timeout occurred")
        assert str(error) == "Timeout occurred"
        assert error.operation is None
        assert error.timeout_seconds is None
    
    def test_authentication_error(self):
        """Test AuthenticationError with status code."""
        error = AuthenticationError(
            "Authentication failed",
            status_code=401
        )
        assert str(error) == "Authentication failed"
        assert error.status_code == 401
        assert isinstance(error, ClaudeSDKError)
    
    def test_authentication_error_without_status(self):
        """Test AuthenticationError without status code."""
        error = AuthenticationError("Invalid credentials")
        assert str(error) == "Invalid credentials"
        assert error.status_code is None
    
    def test_rate_limit_error(self):
        """Test RateLimitError with retry_after attribute."""
        error = RateLimitError(
            "Rate limit exceeded",
            retry_after_seconds=60
        )
        assert str(error) == "Rate limit exceeded"
        assert error.retry_after_seconds == 60
        assert isinstance(error, ClaudeSDKError)
    
    def test_rate_limit_error_without_retry(self):
        """Test RateLimitError without retry_after."""
        error = RateLimitError("Too many requests")
        assert str(error) == "Too many requests"
        assert error.retry_after_seconds is None
    
    def test_protocol_error(self):
        """Test ProtocolError with expected and received attributes."""
        error = ProtocolError(
            "Protocol violation",
            expected="JSON",
            received="XML"
        )
        assert str(error) == "Protocol violation"
        assert error.expected == "JSON"
        assert error.received == "XML"
        assert isinstance(error, TransportError)
    
    def test_protocol_error_without_details(self):
        """Test ProtocolError without details."""
        error = ProtocolError("Invalid protocol")
        assert str(error) == "Invalid protocol"
        assert error.expected is None
        assert error.received is None
    
    def test_configuration_error(self):
        """Test ConfigurationError with parameter and suggestion."""
        error = ConfigurationError(
            "Invalid configuration",
            parameter="api_key",
            suggestion="Provide a valid API key"
        )
        # When suggestion is provided, it's appended to the message
        assert "Invalid configuration" in str(error)
        assert "Suggestion: Provide a valid API key" in str(error)
        assert error.parameter == "api_key"
        assert error.suggestion == "Provide a valid API key"
        assert isinstance(error, ClaudeSDKError)
    
    def test_configuration_error_minimal(self):
        """Test ConfigurationError with minimal info."""
        error = ConfigurationError("Bad config")
        assert str(error) == "Bad config"
        assert error.parameter is None
        assert error.suggestion is None


class TestCLIErrors:
    """Test CLI-specific error classes."""
    
    def test_cli_not_found_error(self):
        """Test CLINotFoundError."""
        error = CLINotFoundError()
        # Default message from the error class
        assert "Claude Code not found" in str(error)
        assert isinstance(error, ClaudeSDKError)
    
    def test_cli_connection_error(self):
        """Test CLIConnectionError."""
        error = CLIConnectionError("Failed to connect to CLI")
        assert str(error) == "Failed to connect to CLI"
        assert isinstance(error, ClaudeSDKError)
    
    def test_cli_json_decode_error(self):
        """Test CLIJSONDecodeError."""
        # CLIJSONDecodeError requires line and original_error parameters
        original_error = ValueError("Invalid JSON")
        error = CLIJSONDecodeError("Invalid JSON response", original_error)
        assert "Failed to decode JSON" in str(error)
        assert isinstance(error, ClaudeSDKError)
    
    def test_process_error(self):
        """Test ProcessError."""
        error = ProcessError("Process failed with exit code 1")
        assert str(error) == "Process failed with exit code 1"
        assert isinstance(error, ClaudeSDKError)


class TestErrorInheritance:
    """Test error inheritance hierarchy."""
    
    def test_all_errors_inherit_from_base(self):
        """Verify all custom errors inherit from ClaudeSDKError."""
        errors = [
            ValidationError("test"),
            TimeoutError("test"),
            AuthenticationError("test"),
            RateLimitError("test"),
            TransportError("test"),
            ProtocolError("test"),
            ConfigurationError("test"),
            CLINotFoundError(),
            CLIConnectionError("test"),
            CLIJSONDecodeError("test", ValueError("test")),  # Needs original_error
            ProcessError("test"),
        ]
        
        for error in errors:
            assert isinstance(error, ClaudeSDKError)
            assert isinstance(error, Exception)
    
    def test_transport_errors_hierarchy(self):
        """Verify transport-related errors inherit correctly."""
        protocol_error = ProtocolError("test")
        assert isinstance(protocol_error, TransportError)
        assert isinstance(protocol_error, ClaudeSDKError)
    
    def test_error_repr(self):
        """Test error representation for debugging."""
        error = ValidationError("Invalid input", field="name", value=123)
        repr_str = repr(error)
        assert "ValidationError" in repr_str
        assert "Invalid input" in repr_str


class TestErrorUsage:
    """Test practical error usage scenarios."""
    
    def test_raising_validation_error(self):
        """Test raising and catching ValidationError."""
        def validate_input(value):
            if not isinstance(value, str):
                raise ValidationError(
                    "Expected string input",
                    field="input",
                    value=value
                )
            return value
        
        with pytest.raises(ValidationError) as exc_info:
            validate_input(123)
        
        error = exc_info.value
        assert error.field == "input"
        assert error.value == 123
    
    @pytest.mark.asyncio
    async def test_raising_timeout_error(self):
        """Test raising and catching TimeoutError."""
        async def operation_with_timeout():
            raise TimeoutError(
                "Connection timeout",
                operation="connect",
                timeout_seconds=10
            )
        
        with pytest.raises(TimeoutError) as exc_info:
            await operation_with_timeout()
        
        error = exc_info.value
        assert error.operation == "connect"
        assert error.timeout_seconds == 10
    
    def test_chaining_errors(self):
        """Test error chaining with cause."""
        try:
            try:
                raise ValueError("Original error")
            except ValueError as e:
                raise ValidationError("Validation failed") from e
        except ValidationError as e:
            assert e.__cause__ is not None
            assert isinstance(e.__cause__, ValueError)
            assert str(e.__cause__) == "Original error"
    
    def test_error_context_preservation(self):
        """Test that error context is preserved."""
        error = RateLimitError(
            "API rate limit exceeded",
            retry_after_seconds=120
        )
        
        # Simulate error handling that preserves context
        try:
            raise error
        except RateLimitError as e:
            assert e.retry_after_seconds == 120
            # Handler could use retry_after_seconds to schedule retry