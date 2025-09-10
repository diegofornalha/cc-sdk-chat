"""Claude SDK Client for interacting with Claude Code."""

import json
import os
from collections.abc import AsyncIterable, AsyncIterator
from dataclasses import replace
from typing import Any, Optional, Dict, Union, List

from ._errors import CLIConnectionError
from .types import ClaudeCodeOptions, HookEvent, HookMatcher, Message, ResultMessage


class ClaudeSDKClient:
    """
    Client for bidirectional, interactive conversations with Claude Code.

    This client provides full control over the conversation flow with support
    for streaming, interrupts, and dynamic message sending. For simple one-shot
    queries, consider using the query() function instead.

    Key features:
    - **Bidirectional**: Send and receive messages at any time
    - **Stateful**: Maintains conversation context across messages
    - **Interactive**: Send follow-ups based on responses
    - **Control flow**: Support for interrupts and session management

    When to use ClaudeSDKClient:
    - Building chat interfaces or conversational UIs
    - Interactive debugging or exploration sessions
    - Multi-turn conversations with context
    - When you need to react to Claude's responses
    - Real-time applications with user input
    - When you need interrupt capabilities

    When to use query() instead:
    - Simple one-off questions
    - Batch processing of prompts
    - Fire-and-forget automation scripts
    - When all inputs are known upfront
    - Stateless operations

    Example - Interactive conversation:
        ```python
        # Automatically connects with empty stream for interactive use
        async with ClaudeSDKClient() as client:
            # Send initial message
            await client.query("Let's solve a math problem step by step")

            # Receive and process response
            async for message in client.receive_messages():
                if "ready" in str(message.content).lower():
                    break

            # Send follow-up based on response
            await client.query("What's 15% of 80?")

            # Continue conversation...
        # Automatically disconnects
        ```

    Example - With interrupt:
        ```python
        async with ClaudeSDKClient() as client:
            # Start a long task
            await client.query("Count to 1000")

            # Interrupt after 2 seconds
            await anyio.sleep(2)
            await client.interrupt()

            # Send new instruction
            await client.query("Never mind, what's 2+2?")
        ```

    Example - Manual connection:
        ```python
        client = ClaudeSDKClient()

        # Connect with initial message stream
        async def message_stream():
            yield {"type": "user", "message": {"role": "user", "content": "Hello"}}

        await client.connect(message_stream())

        # Send additional messages dynamically
        await client.query("What's the weather?")

        async for message in client.receive_messages():
            print(message)

        await client.disconnect()
        ```
    """

    def __init__(self, options: Optional[ClaudeCodeOptions] = None):
        """Initialize Claude SDK client.
        
        Args:
            options: Optional configuration for the client. If not provided,
                    uses default ClaudeCodeOptions(). Common options include:
                    - system_prompt: Custom system prompt for Claude
                    - cwd: Working directory for file operations
                    - permission_mode: How to handle tool permissions
                    - mcp_servers: MCP server configurations
                    - allowed_tools: List of allowed tool names
                    
        Example:
            Basic initialization:
            >>> client = ClaudeSDKClient()
            
            With custom options:
            >>> options = ClaudeCodeOptions(
            ...     system_prompt="You are a Python expert",
            ...     cwd="/home/user/project",
            ...     permission_mode="acceptEdits"
            ... )
            >>> client = ClaudeSDKClient(options)
            
        Note:
            The client must be connected before use. Either use the async
            context manager or call connect() explicitly.
        """
        if options is None:
            options = ClaudeCodeOptions()
        self.options = options
        self._transport: Optional[Any] = None
        self._query: Optional[Any] = None
        os.environ["CLAUDE_CODE_ENTRYPOINT"] = "sdk-py-client"

    def _convert_hooks_to_internal_format(
        self, hooks: Dict[HookEvent, List[HookMatcher]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Convert HookMatcher format to internal Query format."""
        internal_hooks: Dict[str, List[Dict[str, Any]]] = {}
        for event, matchers in hooks.items():
            internal_hooks[event] = []
            for matcher in matchers:
                # Convert HookMatcher to internal dict format
                internal_matcher = {
                    "matcher": matcher.matcher if hasattr(matcher, "matcher") else None,
                    "hooks": matcher.hooks if hasattr(matcher, "hooks") else [],
                }
                internal_hooks[event].append(internal_matcher)
        return internal_hooks

    async def connect(
        self, prompt: Optional[Union[str, AsyncIterable[Dict[str, Any]]]] = None
    ) -> None:
        """Connect to Claude with a prompt or message stream.
        
        Args:
            prompt: Optional initial prompt to send. Can be:
                   - None: Opens interactive connection (default)
                   - str: Single message to send
                   - AsyncIterable: Stream of message dictionaries
                   
        Raises:
            CLIConnectionError: If connection fails
            ValidationError: If options are invalid (e.g., can_use_tool with string prompt)
            CLINotFoundError: If Claude Code CLI is not installed
            
        Example:
            Connect with no initial prompt (interactive):
            >>> await client.connect()
            
            Connect with initial string prompt:
            >>> await client.connect("Hello Claude")
            
            Connect with message stream:
            >>> async def messages():
            ...     yield {"type": "user", "message": {"role": "user", "content": "Hi"}}
            >>> await client.connect(messages())
            
        Note:
            - Auto-connects with empty stream if prompt is None
            - Sets up transport and control protocol handling
            - Validates permission settings
        """

        from ._internal.query import Query
        from ._internal.transport.subprocess_cli import SubprocessCLITransport

        # Auto-connect with empty async iterable if no prompt is provided
        async def _empty_stream() -> AsyncIterator[Dict[str, Any]]:
            # Never yields, but indicates that this function is an iterator and
            # keeps the connection open.
            # This yield is never reached but makes this an async generator
            return
            yield {}  # type: ignore[unreachable]

        actual_prompt = _empty_stream() if prompt is None else prompt

        # Validate and configure permission settings (matching TypeScript SDK logic)
        if self.options.can_use_tool:
            # canUseTool callback requires streaming mode (AsyncIterable prompt)
            if isinstance(prompt, str):
                raise ValueError(
                    "can_use_tool callback requires streaming mode. "
                    "Please provide prompt as an AsyncIterable instead of a string."
                )

            # canUseTool and permission_prompt_tool_name are mutually exclusive
            if self.options.permission_prompt_tool_name:
                raise ValueError(
                    "can_use_tool callback cannot be used with permission_prompt_tool_name. "
                    "Please use one or the other."
                )

            # Automatically set permission_prompt_tool_name to "stdio" for control protocol
            options = replace(self.options, permission_prompt_tool_name="stdio")
        else:
            options = self.options

        self._transport = SubprocessCLITransport(
            prompt=actual_prompt,
            options=options,
        )
        await self._transport.connect()

        # Extract SDK MCP servers from options
        sdk_mcp_servers = {}
        if self.options.mcp_servers and isinstance(self.options.mcp_servers, dict):
            for name, config in self.options.mcp_servers.items():
                if isinstance(config, dict) and config.get("type") == "sdk":
                    sdk_mcp_servers[name] = config["instance"]  # type: ignore[typeddict-item]

        # Create Query to handle control protocol
        self._query = Query(
            transport=self._transport,
            is_streaming_mode=True,  # ClaudeSDKClient always uses streaming mode
            can_use_tool=self.options.can_use_tool,
            hooks=self._convert_hooks_to_internal_format(self.options.hooks)
            if self.options.hooks
            else None,
            sdk_mcp_servers=sdk_mcp_servers,
        )

        # Start reading messages and initialize
        await self._query.start()
        await self._query.initialize()

        # If we have an initial prompt stream, start streaming it
        if prompt is not None and isinstance(prompt, AsyncIterable) and self._query._tg:
            self._query._tg.start_soon(self._query.stream_input, prompt)

    async def receive_messages(self) -> AsyncIterator[Message]:
        """Receive all messages from Claude.
        
        Continuously yields messages from the ongoing conversation.
        This iterator runs indefinitely until the connection is closed.
        
        Yields:
            Message: Various message types including:
                    - UserMessage: User input messages
                    - AssistantMessage: Claude's responses
                    - SystemMessage: System notifications
                    - ResultMessage: Request completion with usage stats
                    
        Raises:
            CLIConnectionError: If not connected
            MessageParseError: If message parsing fails
            
        Example:
            Process all messages:
            >>> async for message in client.receive_messages():
            ...     if isinstance(message, AssistantMessage):
            ...         for block in message.content:
            ...             if isinstance(block, TextBlock):
            ...                 print(block.text)
            ...     elif isinstance(message, ResultMessage):
            ...         print(f"Tokens used: {message.usage.output_tokens}")
            
        Note:
            For single-response scenarios, consider using receive_response()
            which automatically stops after a ResultMessage.
        """
        if not self._query:
            raise CLIConnectionError("Not connected. Call connect() first.")

        from ._internal.message_parser import parse_message

        async for data in self._query.receive_messages():
            yield parse_message(data)

    async def query(
        self, prompt: Union[str, AsyncIterable[Dict[str, Any]]], session_id: str = "default"
    ) -> None:
        """Send a new request in streaming mode.

        This method allows sending messages to Claude after the initial connection.
        Use this for follow-up questions or continuing the conversation.

        Args:
            prompt: Either a string message or an async iterable of message dictionaries.
                   String prompts are converted to user messages automatically.
            session_id: Session identifier for the conversation. Default is "default".
                       Use different session IDs to maintain separate conversation contexts.
                       
        Raises:
            CLIConnectionError: If not connected
            
        Example:
            Send a simple string message:
            >>> await client.query("What's the weather like?")
            
            Send with custom session:
            >>> await client.query("Remember this number: 42", session_id="memory_test")
            >>> # Later in the same session...
            >>> await client.query("What number did I ask you to remember?", session_id="memory_test")
            
            Stream multiple messages:
            >>> async def follow_ups():
            ...     yield {"type": "user", "message": {"role": "user", "content": "First question"}}
            ...     yield {"type": "user", "message": {"role": "user", "content": "Second question"}}
            >>> await client.query(follow_ups())
            
        Note:
            - This method doesn't wait for or return responses
            - Use receive_messages() or receive_response() to get Claude's replies
            - Messages are sent immediately when called
        """
        if not self._query or not self._transport:
            raise CLIConnectionError("Not connected. Call connect() first.")

        # Handle string prompts
        if isinstance(prompt, str):
            message = {
                "type": "user",
                "message": {"role": "user", "content": prompt},
                "parent_tool_use_id": None,
                "session_id": session_id,
            }
            await self._transport.write(json.dumps(message) + "\n")
        else:
            # Handle AsyncIterable prompts - stream them
            async for msg in prompt:
                # Ensure session_id is set on each message
                if "session_id" not in msg:
                    msg["session_id"] = session_id
                await self._transport.write(json.dumps(msg) + "\n")

    async def interrupt(self) -> None:
        """Send interrupt signal (only works with streaming mode)."""
        if not self._query:
            raise CLIConnectionError("Not connected. Call connect() first.")
        await self._query.interrupt()

    async def get_server_info(self) -> Optional[Dict[str, Any]]:
        """Get server initialization info including available commands and output styles.

        Returns initialization information from the Claude Code server including:
        - Available commands (slash commands, system commands, etc.)
        - Current and available output styles
        - Server capabilities

        Returns:
            Dictionary with server info, or None if not in streaming mode

        Example:
            ```python
            async with ClaudeSDKClient() as client:
                info = await client.get_server_info()
                if info:
                    print(f"Commands available: {len(info.get('commands', []))}")
                    print(f"Output style: {info.get('output_style', 'default')}")
            ```
        """
        if not self._query:
            raise CLIConnectionError("Not connected. Call connect() first.")
        # Return the initialization result that was already obtained during connect
        return getattr(self._query, "_initialization_result", None)

    async def receive_response(self) -> AsyncIterator[Message]:
        """
        Receive messages from Claude until and including a ResultMessage.

        This async iterator yields all messages in sequence and automatically terminates
        after yielding a ResultMessage (which indicates the response is complete).
        It's a convenience method over receive_messages() for single-response workflows.

        **Stopping Behavior:**
        - Yields each message as it's received
        - Terminates immediately after yielding a ResultMessage
        - The ResultMessage IS included in the yielded messages
        - If no ResultMessage is received, the iterator continues indefinitely

        Yields:
            Message: Each message received (UserMessage, AssistantMessage, SystemMessage, ResultMessage)

        Example:
            ```python
            async with ClaudeSDKClient() as client:
                await client.query("What's the capital of France?")

                async for msg in client.receive_response():
                    if isinstance(msg, AssistantMessage):
                        for block in msg.content:
                            if isinstance(block, TextBlock):
                                print(f"Claude: {block.text}")
                    elif isinstance(msg, ResultMessage):
                        print(f"Cost: ${msg.total_cost_usd:.4f}")
                        # Iterator will terminate after this message
            ```

        Note:
            To collect all messages: `messages = [msg async for msg in client.receive_response()]`
            The final message in the list will always be a ResultMessage.
        """
        async for message in self.receive_messages():
            yield message
            if isinstance(message, ResultMessage):
                return

    async def disconnect(self) -> None:
        """Disconnect from Claude."""
        if self._query:
            await self._query.close()
            self._query = None
        self._transport = None

    async def __aenter__(self) -> "ClaudeSDKClient":
        """Enter async context - automatically connects with empty stream for interactive use."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        """Exit async context - always disconnects."""
        await self.disconnect()
        return False
