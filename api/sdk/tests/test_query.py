"""Test suite for the query function."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from claude_code_sdk import (
    AssistantMessage,
    ClaudeCodeOptions,
    ConfigurationError,
    ResultMessage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
    ValidationError,
    query,
)


class TestQueryFunction:
    """Test the main query function."""
    
    @pytest.mark.asyncio
    async def test_simple_query(self):
        """Test a simple query with text response."""
        with patch('claude_code_sdk.query._internal.query.query') as mock_internal_query:
            # Mock the internal query to return a simple response
            async def mock_response(prompt, options):
                yield AssistantMessage(
                    type="assistant",
                    message={
                        "role": "assistant",
                        "content": [{"type": "text", "text": "Hello, World!"}]
                    },
                    content=[TextBlock(type="text", text="Hello, World!")]
                )
            
            mock_internal_query.return_value = mock_response("Test", None)
            
            responses = []
            async for message in query("Test prompt"):
                responses.append(message)
            
            assert len(responses) == 1
            assert isinstance(responses[0], AssistantMessage)
            assert responses[0].content[0].text == "Hello, World!"
    
    @pytest.mark.asyncio
    async def test_query_with_options(self):
        """Test query with custom options."""
        options = ClaudeCodeOptions(
            system_prompt="You are a helpful assistant",
            max_turns=3,
            allowed_tools=["Read"]
        )
        
        with patch('claude_code_sdk.query._internal.query.query') as mock_internal_query:
            async def mock_response(prompt, opts):
                # Verify options were passed
                assert opts == options
                yield AssistantMessage(
                    type="assistant",
                    message={"role": "assistant", "content": [{"type": "text", "text": "Response"}]},
                    content=[TextBlock(type="text", text="Response")]
                )
            
            mock_internal_query.return_value = mock_response("Test", options)
            
            async for message in query("Test", options=options):
                assert isinstance(message, AssistantMessage)
    
    @pytest.mark.asyncio
    async def test_query_with_empty_prompt(self):
        """Test that empty prompt raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            async for _ in query(""):
                pass
        
        assert "empty" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_query_with_none_prompt(self):
        """Test that None prompt raises ValidationError."""
        with pytest.raises(ValidationError):
            async for _ in query(None):
                pass


class TestQueryWithTools:
    """Test query function with tool usage."""
    
    @pytest.mark.asyncio
    async def test_query_with_tool_use(self):
        """Test query that uses tools."""
        with patch('claude_code_sdk.query._internal.query.query') as mock_internal_query:
            async def mock_response(prompt, options):
                # First: Assistant decides to use a tool
                yield AssistantMessage(
                    type="assistant",
                    message={
                        "role": "assistant",
                        "content": [
                            {"type": "text", "text": "Let me read that file."},
                            {
                                "type": "tool_use",
                                "id": "tool_1",
                                "name": "Read",
                                "input": {"file_path": "/test.txt"}
                            }
                        ]
                    },
                    content=[
                        TextBlock(type="text", text="Let me read that file."),
                        ToolUseBlock(
                            type="tool_use",
                            id="tool_1",
                            name="Read",
                            input={"file_path": "/test.txt"}
                        )
                    ]
                )
                
                # Second: Tool result
                yield ResultMessage(
                    type="result",
                    message={
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "tool_1",
                            "content": "File contents: Hello"
                        }]
                    },
                    content=[
                        ToolResultBlock(
                            type="tool_result",
                            tool_use_id="tool_1",
                            content="File contents: Hello"
                        )
                    ]
                )
                
                # Third: Assistant final response
                yield AssistantMessage(
                    type="assistant",
                    message={
                        "role": "assistant",
                        "content": [{"type": "text", "text": "The file contains: Hello"}]
                    },
                    content=[TextBlock(type="text", text="The file contains: Hello")]
                )
            
            mock_internal_query.return_value = mock_response("Read /test.txt", None)
            
            messages = []
            async for message in query("Read /test.txt"):
                messages.append(message)
            
            assert len(messages) == 3
            assert isinstance(messages[0], AssistantMessage)
            assert isinstance(messages[1], ResultMessage)
            assert isinstance(messages[2], AssistantMessage)
            
            # Check tool use
            tool_use = messages[0].content[1]
            assert tool_use.name == "Read"
            assert tool_use.input["file_path"] == "/test.txt"
            
            # Check tool result
            tool_result = messages[1].content[0]
            assert tool_result.tool_use_id == "tool_1"
            assert "Hello" in tool_result.content


class TestQueryStreaming:
    """Test streaming behavior of query."""
    
    @pytest.mark.asyncio
    async def test_streaming_response(self):
        """Test that query streams responses properly."""
        with patch('claude_code_sdk.query._internal.query.query') as mock_internal_query:
            async def mock_streaming_response(prompt, options):
                # Simulate streaming by yielding multiple parts
                for i in range(3):
                    yield AssistantMessage(
                        type="assistant",
                        message={
                            "role": "assistant",
                            "content": [{"type": "text", "text": f"Part {i+1}"}]
                        },
                        content=[TextBlock(type="text", text=f"Part {i+1}")]
                    )
                    await asyncio.sleep(0.01)  # Simulate delay
            
            mock_internal_query.return_value = mock_streaming_response("Test", None)
            
            parts = []
            async for message in query("Generate streaming response"):
                if isinstance(message, AssistantMessage):
                    parts.append(message.content[0].text)
            
            assert parts == ["Part 1", "Part 2", "Part 3"]
    
    @pytest.mark.asyncio
    async def test_early_termination(self):
        """Test early termination of streaming."""
        with patch('claude_code_sdk.query._internal.query.query') as mock_internal_query:
            async def mock_infinite_stream(prompt, options):
                i = 0
                while True:
                    yield AssistantMessage(
                        type="assistant",
                        message={
                            "role": "assistant",
                            "content": [{"type": "text", "text": f"Message {i}"}]
                        },
                        content=[TextBlock(type="text", text=f"Message {i}")]
                    )
                    i += 1
                    await asyncio.sleep(0.01)
            
            mock_internal_query.return_value = mock_infinite_stream("Test", None)
            
            messages_received = 0
            async for message in query("Infinite stream"):
                messages_received += 1
                if messages_received >= 5:
                    break  # Stop after 5 messages
            
            assert messages_received == 5


class TestQueryErrorHandling:
    """Test error handling in query function."""
    
    @pytest.mark.asyncio
    async def test_query_with_invalid_options(self):
        """Test query with invalid options type."""
        with pytest.raises(TypeError):
            async for _ in query("Test", options="invalid"):
                pass
    
    @pytest.mark.asyncio
    async def test_query_handles_transport_error(self):
        """Test that transport errors are properly propagated."""
        with patch('claude_code_sdk.query._internal.query.query') as mock_internal_query:
            async def mock_error_response(prompt, options):
                yield AssistantMessage(
                    type="assistant",
                    message={"role": "assistant", "content": [{"type": "text", "text": "Starting..."}]},
                    content=[TextBlock(type="text", text="Starting...")]
                )
                raise ConnectionError("Transport failed")
            
            mock_internal_query.return_value = mock_error_response("Test", None)
            
            messages = []
            with pytest.raises(ConnectionError) as exc_info:
                async for message in query("Test with error"):
                    messages.append(message)
            
            assert len(messages) == 1  # Got first message before error
            assert "Transport failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_query_with_configuration_error(self):
        """Test query with invalid configuration."""
        options = ClaudeCodeOptions(
            permission_mode="invalid_mode"  # This should trigger validation
        )
        
        with patch('claude_code_sdk.query._internal.query.query') as mock_internal_query:
            mock_internal_query.side_effect = ConfigurationError(
                "Invalid permission mode",
                parameter="permission_mode",
                suggestion="Use 'ask', 'accept', or 'acceptEdits'"
            )
            
            with pytest.raises(ConfigurationError) as exc_info:
                async for _ in query("Test", options=options):
                    pass
            
            assert exc_info.value.parameter == "permission_mode"
            assert exc_info.value.suggestion is not None


class TestQueryIntegration:
    """Integration tests for query function."""
    
    @pytest.mark.asyncio
    async def test_multi_turn_conversation(self):
        """Test a multi-turn conversation through query."""
        conversation_state = {"turn": 0}
        
        with patch('claude_code_sdk.query._internal.query.query') as mock_internal_query:
            async def mock_conversation(prompt, options):
                conversation_state["turn"] += 1
                turn = conversation_state["turn"]
                
                if turn == 1:
                    yield AssistantMessage(
                        type="assistant",
                        message={"role": "assistant", "content": [{"type": "text", "text": "First response"}]},
                        content=[TextBlock(type="text", text="First response")]
                    )
                elif turn == 2:
                    yield AssistantMessage(
                        type="assistant",
                        message={"role": "assistant", "content": [{"type": "text", "text": "Second response"}]},
                        content=[TextBlock(type="text", text="Second response")]
                    )
            
            mock_internal_query.side_effect = [
                mock_conversation("First prompt", None),
                mock_conversation("Second prompt", None)
            ]
            
            # First query
            responses1 = []
            async for msg in query("First prompt"):
                responses1.append(msg)
            
            assert len(responses1) == 1
            assert responses1[0].content[0].text == "First response"
            
            # Second query
            responses2 = []
            async for msg in query("Second prompt"):
                responses2.append(msg)
            
            assert len(responses2) == 1
            assert responses2[0].content[0].text == "Second response"
            
            assert conversation_state["turn"] == 2