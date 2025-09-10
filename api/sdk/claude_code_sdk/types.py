"""Type definitions for Claude SDK."""

import sys
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, TypedDict, Optional, List, Dict, Union

from typing_extensions import NotRequired

if TYPE_CHECKING:
    from mcp.server import Server as McpServer

# Permission modes
PermissionMode = Literal["default", "acceptEdits", "plan", "bypassPermissions"]


# Permission Update types (matching TypeScript SDK)
PermissionUpdateDestination = Literal[
    "userSettings", "projectSettings", "localSettings", "session"
]

PermissionBehavior = Literal["allow", "deny", "ask"]


@dataclass
class PermissionRuleValue:
    """Permission rule value."""

    tool_name: str
    rule_content: Optional[str] = None


@dataclass
class PermissionUpdate:
    """Permission update configuration."""

    type: Literal[
        "addRules",
        "replaceRules",
        "removeRules",
        "setMode",
        "addDirectories",
        "removeDirectories",
    ]
    rules: Optional[List[PermissionRuleValue]] = None
    behavior: Optional[PermissionBehavior] = None
    mode: Optional[PermissionMode] = None
    directories: Optional[List[str]] = None
    destination: Optional[PermissionUpdateDestination] = None


# Tool callback types
@dataclass
class ToolPermissionContext:
    """Context information for tool permission callbacks."""

    signal: Optional[Any] = None  # Future: abort signal support
    suggestions: List[PermissionUpdate] = field(
        default_factory=list
    )  # Permission suggestions from CLI


# Match TypeScript's PermissionResult structure
@dataclass
class PermissionResultAllow:
    """Allow permission result."""

    behavior: Literal["allow"] = "allow"
    updated_input: Optional[Dict[str, Any]] = None
    updated_permissions: Optional[List[PermissionUpdate]] = None


@dataclass
class PermissionResultDeny:
    """Deny permission result."""

    behavior: Literal["deny"] = "deny"
    message: str = ""
    interrupt: bool = False


PermissionResult = Union[PermissionResultAllow, PermissionResultDeny]

CanUseTool = Callable[
    [str, Dict[str, Any], ToolPermissionContext], Awaitable[PermissionResult]
]


##### Hook types
# Supported hook event types. Due to setup limitations, the Python SDK does not
# support SessionStart, SessionEnd, and Notification hooks.
HookEvent = Literal[
    "PreToolUse",
    "PostToolUse",
    "UserPromptSubmit",
    "Stop",
    "SubagentStop",
    "PreCompact"
]


# See https://docs.anthropic.com/en/docs/claude-code/hooks#advanced%3A-json-output
# for documentation of the output types. Currently, "continue", "stopReason",
# and "suppressOutput" are not supported in the Python SDK.
class HookJSONOutput(TypedDict):
    # Whether to block the action related to the hook.
    decision: NotRequired[Literal["block"]]
    # Optionally add a system message that is not visible to Claude but saved in
    # the chat transcript.
    systemMessage: NotRequired[str]
    # See each hook's individual "Decision Control" section in the documentation
    # for guidance.
    hookSpecificOutput: NotRequired[Any]


@dataclass
class HookContext:
    """Context information for hook callbacks."""

    signal: Optional[Any] = None  # Future: abort signal support


HookCallback = Callable[
    # HookCallback input parameters:
    # - input
    #   See https://docs.anthropic.com/en/docs/claude-code/hooks#hook-input for
    #   the type of 'input', the first value.
    # - tool_use_id
    # - context
    [Dict[str, Any], Optional[str], HookContext],
    Awaitable[HookJSONOutput],
]


# Hook matcher configuration
@dataclass
class HookMatcher:
    """Hook matcher configuration."""

    # See https://docs.anthropic.com/en/docs/claude-code/hooks#structure for the
    # expected string value. For example, for PreToolUse, the matcher can be
    # a tool name like "Bash" or a combination of tool names like
    # "Write|MultiEdit|Edit".
    matcher: Optional[str] = None

    # A list of Python functions with function signature HookCallback
    hooks: List[HookCallback] = field(default_factory=list)


# MCP Server config
class McpStdioServerConfig(TypedDict):
    """MCP stdio server configuration."""

    type: NotRequired[Literal["stdio"]]  # Optional for backwards compatibility
    command: str
    args: NotRequired[List[str]]
    env: NotRequired[Dict[str, str]]


class McpSSEServerConfig(TypedDict):
    """MCP SSE server configuration."""

    type: Literal["sse"]
    url: str
    headers: NotRequired[Dict[str, str]]


class McpHttpServerConfig(TypedDict):
    """MCP HTTP server configuration."""

    type: Literal["http"]
    url: str
    headers: NotRequired[Dict[str, str]]


class McpSdkServerConfig(TypedDict):
    """SDK MCP server configuration."""

    type: Literal["sdk"]
    name: str
    instance: "McpServer"


McpServerConfig = Union[
    McpStdioServerConfig, McpSSEServerConfig, McpHttpServerConfig, McpSdkServerConfig
]


# Content block types
@dataclass
class TextBlock:
    """Text content block."""

    text: str


@dataclass
class ThinkingBlock:
    """Thinking content block."""

    thinking: str
    signature: str


@dataclass
class ToolUseBlock:
    """Tool use content block."""

    id: str
    name: str
    input: Dict[str, Any]


@dataclass
class ToolResultBlock:
    """Tool result content block."""

    tool_use_id: str
    content: Optional[Union[str, List[Dict[str, Any]]]] = None
    is_error: Optional[bool] = None


ContentBlock = Union[TextBlock, ThinkingBlock, ToolUseBlock, ToolResultBlock]


# Message types
@dataclass
class UserMessage:
    """User message."""

    content: Union[str, List[ContentBlock]]


@dataclass
class AssistantMessage:
    """Assistant message with content blocks."""

    content: List[ContentBlock]
    model: str


@dataclass
class SystemMessage:
    """System message with metadata."""

    subtype: str
    data: Dict[str, Any]


@dataclass
class ResultMessage:
    """Result message with cost and usage information."""

    subtype: str
    duration_ms: int
    duration_api_ms: int
    is_error: bool
    num_turns: int
    session_id: str
    total_cost_usd: Optional[float] = None
    usage: Optional[Dict[str, Any]] = None
    result: Optional[str] = None


Message = Union[UserMessage, AssistantMessage, SystemMessage, ResultMessage]


@dataclass
class ClaudeCodeOptions:
    """Query options for Claude SDK."""

    allowed_tools: List[str] = field(default_factory=list)
    max_thinking_tokens: int = 8000
    system_prompt: Optional[str] = None
    append_system_prompt: Optional[str] = None
    mcp_servers: Union[Dict[str, McpServerConfig], str, Path] = field(default_factory=dict)
    permission_mode: Optional[PermissionMode] = None
    continue_conversation: bool = False
    resume: Optional[str] = None
    max_turns: Optional[int] = None
    disallowed_tools: List[str] = field(default_factory=list)
    model: Optional[str] = None
    permission_prompt_tool_name: Optional[str] = None
    cwd: Optional[Union[str, Path]] = None
    settings: Optional[str] = None
    add_dirs: List[Union[str, Path]] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    extra_args: Dict[str, Optional[str]] = field(
        default_factory=dict
    )  # Pass arbitrary CLI flags
    debug_stderr: Any = (
        sys.stderr
    )  # File-like object for debug output when debug-to-stderr is set

    # Tool permission callback
    can_use_tool: Optional[CanUseTool] = None

    # Hook configurations
    hooks: Optional[Dict[HookEvent, List[HookMatcher]]] = None


# SDK Control Protocol
class SDKControlInterruptRequest(TypedDict):
    subtype: Literal["interrupt"]


class SDKControlPermissionRequest(TypedDict):
    subtype: Literal["can_use_tool"]
    tool_name: str
    input: Dict[str, Any]
    # TODO: Add PermissionUpdate type here
    permission_suggestions: Optional[List[Any]]
    blocked_path: Optional[str]


class SDKControlInitializeRequest(TypedDict):
    subtype: Literal["initialize"]
    hooks: Optional[Dict[HookEvent, Any]]


class SDKControlSetPermissionModeRequest(TypedDict):
    subtype: Literal["set_permission_mode"]
    # TODO: Add PermissionMode
    mode: str


class SDKHookCallbackRequest(TypedDict):
    subtype: Literal["hook_callback"]
    callback_id: str
    input: Any
    tool_use_id: Optional[str]


class SDKControlMcpMessageRequest(TypedDict):
    subtype: Literal["mcp_message"]
    server_name: str
    message: Any


class SDKControlRequest(TypedDict):
    type: Literal["control_request"]
    request_id: str
    request: Union[
        SDKControlInterruptRequest,
        SDKControlPermissionRequest,
        SDKControlInitializeRequest,
        SDKControlSetPermissionModeRequest,
        SDKHookCallbackRequest,
        SDKControlMcpMessageRequest
    ]


class ControlResponse(TypedDict):
    subtype: Literal["success"]
    request_id: str
    response: Optional[Dict[str, Any]]


class ControlErrorResponse(TypedDict):
    subtype: Literal["error"]
    request_id: str
    error: str


class SDKControlResponse(TypedDict):
    type: Literal["control_response"]
    response: Union[ControlResponse, ControlErrorResponse]
