"""Pytest configuration and shared fixtures for SDK tests."""

import asyncio
import json
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from claude_code_sdk import (
    AssistantMessage,
    ClaudeCodeOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)


@pytest.fixture
def mock_transport():
    """Create a mock transport for testing."""
    transport = AsyncMock()
    transport.connect = AsyncMock()
    transport.disconnect = AsyncMock()
    transport.send_message = AsyncMock()
    transport.receive_message = AsyncMock()
    transport.is_connected = MagicMock(return_value=True)
    return transport


@pytest.fixture
def sample_options():
    """Create sample ClaudeCodeOptions for testing."""
    return ClaudeCodeOptions(
        system_prompt="You are a helpful assistant",
        max_turns=5,
        allowed_tools=["Read", "Write"],
        permission_mode="ask",
        cwd="/test/path",
    )


@pytest.fixture
def sample_user_message():
    """Create a sample user message."""
    return UserMessage(
        type="user",
        message={"role": "user", "content": "Hello, Claude!"}
    )


@pytest.fixture
def sample_assistant_message():
    """Create a sample assistant message with text content."""
    return AssistantMessage(
        type="assistant",
        message={
            "role": "assistant",
            "content": [
                {"type": "text", "text": "Hello! How can I help you today?"}
            ]
        },
        content=[TextBlock(type="text", text="Hello! How can I help you today?")]
    )


@pytest.fixture
def sample_tool_use_message():
    """Create a sample assistant message with tool use."""
    return AssistantMessage(
        type="assistant",
        message={
            "role": "assistant",
            "content": [
                {"type": "text", "text": "Let me read that file for you."},
                {
                    "type": "tool_use",
                    "id": "tool_123",
                    "name": "Read",
                    "input": {"file_path": "/test/file.txt"}
                }
            ]
        },
        content=[
            TextBlock(type="text", text="Let me read that file for you."),
            ToolUseBlock(
                type="tool_use",
                id="tool_123",
                name="Read",
                input={"file_path": "/test/file.txt"}
            )
        ]
    )


@pytest.fixture
def sample_tool_result_message():
    """Create a sample tool result message."""
    return ResultMessage(
        type="result",
        message={"role": "user", "content": [
            {
                "type": "tool_result",
                "tool_use_id": "tool_123",
                "content": "File contents: Hello World"
            }
        ]},
        content=[
            ToolResultBlock(
                type="tool_result",
                tool_use_id="tool_123",
                content="File contents: Hello World"
            )
        ]
    )


@pytest.fixture
def sample_error_message():
    """Create a sample error message."""
    return {
        "type": "error",
        "error": {
            "type": "validation_error",
            "message": "Invalid input provided"
        }
    }


@pytest_asyncio.fixture
async def client_with_mock_transport(mock_transport, sample_options):
    """Create a ClaudeSDKClient with a mock transport."""
    client = ClaudeSDKClient(options=sample_options)
    client._transport = mock_transport
    yield client
    if client._transport and hasattr(client._transport, 'disconnect'):
        await client._transport.disconnect()


@pytest.fixture
def mock_subprocess():
    """Mock subprocess for CLI transport tests."""
    mock_proc = AsyncMock()
    mock_proc.stdin = AsyncMock()
    mock_proc.stdout = AsyncMock()
    mock_proc.stderr = AsyncMock()
    mock_proc.returncode = None
    mock_proc.wait = AsyncMock(return_value=0)
    mock_proc.terminate = AsyncMock()
    return mock_proc


@pytest.fixture
def mock_claude_code_cli(mock_subprocess):
    """Mock the Claude Code CLI subprocess."""
    with patch('asyncio.create_subprocess_exec', return_value=mock_subprocess):
        yield mock_subprocess


@pytest.fixture
def temp_workspace(tmp_path):
    """Create a temporary workspace for file operations."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    
    # Create some sample files
    (workspace / "test.txt").write_text("Test content")
    (workspace / "code.py").write_text("print('Hello, World!')")
    
    subdir = workspace / "subdir"
    subdir.mkdir()
    (subdir / "nested.txt").write_text("Nested content")
    
    return workspace


@pytest.fixture
def mock_hook_callback():
    """Create a mock hook callback for testing."""
    return AsyncMock(return_value=None)


@pytest.fixture
def sample_hook_context():
    """Create a sample hook context."""
    return {
        "event": "tool_use",
        "tool_name": "Read",
        "tool_input": {"file_path": "/test/file.txt"},
        "timestamp": "2024-01-01T00:00:00Z"
    }


class AsyncIteratorMock:
    """Mock async iterator for streaming responses."""
    
    def __init__(self, items: List[Any]):
        self.items = items
        self.index = 0
    
    def __aiter__(self):
        return self
    
    async def __anext__(self):
        if self.index >= len(self.items):
            raise StopAsyncIteration
        item = self.items[self.index]
        self.index += 1
        return item


@pytest.fixture
def mock_streaming_response():
    """Create a mock streaming response."""
    messages = [
        {"type": "start", "session_id": "test_session"},
        {
            "type": "assistant",
            "message": {
                "role": "assistant",
                "content": [{"type": "text", "text": "Processing..."}]
            }
        },
        {
            "type": "assistant",
            "message": {
                "role": "assistant",
                "content": [{"type": "text", "text": "Complete!"}]
            }
        },
        {"type": "end"}
    ]
    return AsyncIteratorMock(messages)


@pytest.fixture(autouse=True)
def reset_asyncio_policy():
    """Reset asyncio policy after each test."""
    yield
    asyncio.set_event_loop_policy(None)