"""Message parser for Claude Code SDK responses."""

import logging
from typing import Any, Dict, List

from .._errors import MessageParseError
from ..types import (
    AssistantMessage,
    ContentBlock,
    Message,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ThinkingBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)

logger = logging.getLogger(__name__)


def parse_message(data: Dict[str, Any]) -> Message:
    """
    Parse message from CLI output into typed Message objects.

    Args:
        data: Raw message dictionary from CLI output

    Returns:
        Parsed Message object

    Raises:
        MessageParseError: If parsing fails or message type is unrecognized
    """
    if not isinstance(data, dict):
        raise MessageParseError(
            f"Invalid message data type (expected dict, got {type(data).__name__})",
            data,
        )

    message_type = data.get("type")
    if not message_type:
        raise MessageParseError("Message missing 'type' field", data)

    if message_type == "user":
        try:
            if isinstance(data["message"]["content"], list):
                user_content_blocks: List[ContentBlock] = []
                for block in data["message"]["content"]:
                    block_type = block["type"]
                    if block_type == "text":
                        user_content_blocks.append(
                            TextBlock(text=block["text"])
                        )
                    elif block_type == "tool_use":
                        user_content_blocks.append(
                            ToolUseBlock(
                                id=block["id"],
                                name=block["name"],
                                input=block["input"],
                            )
                        )
                    elif block_type == "tool_result":
                        user_content_blocks.append(
                            ToolResultBlock(
                                tool_use_id=block["tool_use_id"],
                                content=block.get("content"),
                                is_error=block.get("is_error"),
                            )
                        )
                return UserMessage(content=user_content_blocks)
            return UserMessage(content=data["message"]["content"])
        except KeyError as e:
            raise MessageParseError(
                f"Missing required field in user message: {e}", data
            ) from e

    elif message_type == "assistant":
        try:
            content_blocks: List[ContentBlock] = []
            for block in data["message"]["content"]:
                block_type = block["type"]
                if block_type == "text":
                    content_blocks.append(TextBlock(text=block["text"]))
                elif block_type == "thinking":
                    content_blocks.append(
                        ThinkingBlock(
                            thinking=block["thinking"],
                            signature=block["signature"],
                        )
                    )
                elif block_type == "tool_use":
                    content_blocks.append(
                        ToolUseBlock(
                            id=block["id"],
                            name=block["name"],
                            input=block["input"],
                        )
                    )
                elif block_type == "tool_result":
                    content_blocks.append(
                        ToolResultBlock(
                            tool_use_id=block["tool_use_id"],
                            content=block.get("content"),
                            is_error=block.get("is_error"),
                        )
                    )

            return AssistantMessage(
                content=content_blocks, model=data["message"]["model"]
            )
        except KeyError as e:
            raise MessageParseError(
                f"Missing required field in assistant message: {e}", data
            ) from e

    elif message_type == "system":
        try:
            return SystemMessage(
                subtype=data["subtype"],
                data=data,
            )
        except KeyError as e:
            raise MessageParseError(
                f"Missing required field in system message: {e}", data
            ) from e

    elif message_type == "result":
        try:
            return ResultMessage(
                subtype=data["subtype"],
                duration_ms=data["duration_ms"],
                duration_api_ms=data["duration_api_ms"],
                is_error=data["is_error"],
                num_turns=data["num_turns"],
                session_id=data["session_id"],
                total_cost_usd=data.get("total_cost_usd"),
                usage=data.get("usage"),
                result=data.get("result"),
            )
        except KeyError as e:
            raise MessageParseError(
                f"Missing required field in result message: {e}", data
            ) from e

    else:
        raise MessageParseError(f"Unknown message type: {message_type}", data)
