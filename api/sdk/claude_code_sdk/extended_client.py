"""Extended Claude SDK Client with advanced features."""

import asyncio
import time
from typing import Any, Dict, List, Optional, Union, AsyncIterator, Callable
from collections.abc import AsyncIterable

from .client import ClaudeSDKClient
from .types import (
    ClaudeCodeOptions, Message, ResultMessage, AssistantMessage, 
    TextBlock, ToolUseBlock, ThinkingBlock
)
from .utils import (
    InputValidator, CallbackManager, MetricsCollector, ConversationMemory,
    ResponseFormatter, RetryConfig, with_retry
)
from ._errors import CLIConnectionError, ValidationError, TimeoutError


class ExtendedClaudeClient(ClaudeSDKClient):
    """Enhanced Claude SDK Client with additional features.
    
    This client extends the base ClaudeSDKClient with:
    - Input validation
    - Metrics collection
    - Callback support
    - Conversation memory
    - Retry logic
    - Batch processing
    - Template support
    - Response formatting
    
    Example:
        ```python
        async with ExtendedClaudeClient() as client:
            # Register callbacks
            client.on_message(lambda msg: print(f"Received: {msg}"))
            client.on_error(lambda err: print(f"Error: {err}"))
            
            # Use with validation and retry
            response = await client.query_with_retry(
                "What's the weather?",
                retry_config=RetryConfig(max_attempts=3)
            )
            
            # Get metrics
            stats = client.get_metrics()
            print(f"Total requests: {stats['total_requests']}")
        ```
    """
    
    def __init__(self, options: Optional[ClaudeCodeOptions] = None):
        """Initialize ExtendedClaudeClient.
        
        Args:
            options: Optional ClaudeCodeOptions configuration
        """
        super().__init__(options)
        self.validator = InputValidator()
        self.callbacks = CallbackManager()
        self.metrics = MetricsCollector()
        self.memory = ConversationMemory()
        self.formatter = ResponseFormatter()
        self._templates: Dict[str, str] = {}
    
    # Callback Management
    def on_message(self, callback: Callable[[Message], None]) -> None:
        """Register callback for message events.
        
        Args:
            callback: Function to call when message is received
        """
        self.callbacks.register('message_received', callback)
    
    def on_error(self, callback: Callable[[Exception], None]) -> None:
        """Register callback for error events.
        
        Args:
            callback: Function to call when error occurs
        """
        self.callbacks.register('error', callback)
    
    def on_complete(self, callback: Callable[[ResultMessage], None]) -> None:
        """Register callback for completion events.
        
        Args:
            callback: Function to call when response completes
        """
        self.callbacks.register('complete', callback)
    
    # Enhanced Query Methods
    async def query_with_validation(
        self, 
        prompt: str, 
        session_id: str = "default",
        max_length: int = 100000
    ) -> None:
        """Query with input validation.
        
        Args:
            prompt: Prompt to send
            session_id: Session identifier
            max_length: Maximum prompt length
            
        Raises:
            ValidationError: If input is invalid
        """
        validated_prompt = self.validator.validate_prompt(prompt, max_length)
        validated_session = self.validator.validate_session_id(session_id)
        
        start_time = time.time()
        try:
            await super().query(validated_prompt, validated_session)
            self.metrics.record_request(True, time.time() - start_time)
            self.memory.add_message("user", validated_prompt)
        except Exception as e:
            self.metrics.record_request(False, time.time() - start_time)
            self.metrics.record_error(type(e).__name__)
            await self.callbacks.trigger('error', e)
            raise
    
    @with_retry()
    async def query_with_retry(
        self,
        prompt: str,
        session_id: str = "default",
        retry_config: Optional[RetryConfig] = None
    ) -> None:
        """Query with automatic retry on failure.
        
        Args:
            prompt: Prompt to send
            session_id: Session identifier
            retry_config: Optional retry configuration
        """
        await self.query_with_validation(prompt, session_id)
    
    async def query_and_wait(
        self,
        prompt: str,
        session_id: str = "default",
        timeout: float = 60.0
    ) -> List[Message]:
        """Query and wait for complete response.
        
        Args:
            prompt: Prompt to send
            session_id: Session identifier
            timeout: Maximum time to wait for response
            
        Returns:
            List of all messages received
            
        Raises:
            TimeoutError: If response takes too long
        """
        await self.query_with_validation(prompt, session_id)
        
        messages = []
        start_time = time.time()
        
        async for message in self.receive_response():
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Response timeout after {timeout} seconds")
            
            messages.append(message)
            await self.callbacks.trigger('message_received', message)
            
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        self.memory.add_message("assistant", block.text)
            
            if isinstance(message, ResultMessage):
                self.metrics.record_request(
                    True,
                    time.time() - start_time,
                    message.usage.output_tokens if message.usage else 0,
                    message.total_cost_usd
                )
                await self.callbacks.trigger('complete', message)
        
        return messages
    
    # Batch Processing
    async def batch_query(
        self,
        prompts: List[str],
        session_id: str = "default",
        concurrency: int = 1,
        delay_between: float = 0
    ) -> Dict[str, List[Message]]:
        """Process multiple prompts in batch.
        
        Args:
            prompts: List of prompts to process
            session_id: Session identifier
            concurrency: Number of concurrent queries (if > 1, uses different sessions)
            delay_between: Delay between queries in seconds
            
        Returns:
            Dictionary mapping prompts to their responses
        """
        results = {}
        
        if concurrency == 1:
            # Sequential processing in same session
            for i, prompt in enumerate(prompts):
                if i > 0 and delay_between > 0:
                    await asyncio.sleep(delay_between)
                
                results[prompt] = await self.query_and_wait(prompt, session_id)
        else:
            # Parallel processing in different sessions
            async def process_prompt(prompt: str, index: int):
                session = f"{session_id}_{index}"
                return prompt, await self.query_and_wait(prompt, session)
            
            tasks = [
                process_prompt(prompt, i)
                for i, prompt in enumerate(prompts)
            ]
            
            for prompt, response in await asyncio.gather(*tasks):
                results[prompt] = response
        
        return results
    
    # Template Support
    def register_template(self, name: str, template: str) -> None:
        """Register a prompt template.
        
        Args:
            name: Template name
            template: Template string with {variable} placeholders
            
        Example:
            client.register_template(
                "code_review",
                "Review this {language} code:\n{code}\nFocus on: {focus}"
            )
        """
        self._templates[name] = template
    
    async def query_with_template(
        self,
        template_name: str,
        variables: Dict[str, str],
        session_id: str = "default"
    ) -> List[Message]:
        """Query using a registered template.
        
        Args:
            template_name: Name of registered template
            variables: Variables to fill in template
            session_id: Session identifier
            
        Returns:
            List of response messages
            
        Raises:
            ValueError: If template not found
        """
        if template_name not in self._templates:
            raise ValueError(f"Template '{template_name}' not found")
        
        template = self._templates[template_name]
        prompt = template.format(**variables)
        
        return await self.query_and_wait(prompt, session_id)
    
    # Convenience Methods
    async def ask(self, question: str) -> str:
        """Simple question-answer interface.
        
        Args:
            question: Question to ask
            
        Returns:
            Text response from Claude
        """
        messages = await self.query_and_wait(question)
        
        response_text = []
        for message in messages:
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        response_text.append(block.text)
        
        return "\n".join(response_text)
    
    async def analyze_code(
        self,
        code: str,
        language: str = "python",
        focus: str = "bugs, performance, best practices"
    ) -> str:
        """Analyze code for issues and improvements.
        
        Args:
            code: Code to analyze
            language: Programming language
            focus: Areas to focus on
            
        Returns:
            Analysis results
        """
        prompt = f"""Analyze this {language} code:

```{language}
{code}
```

Focus on: {focus}

Provide specific suggestions for improvement."""
        
        return await self.ask(prompt)
    
    async def summarize(self, text: str, max_words: int = 100) -> str:
        """Summarize text content.
        
        Args:
            text: Text to summarize
            max_words: Maximum words in summary
            
        Returns:
            Summary text
        """
        prompt = f"Summarize the following text in {max_words} words or less:\n\n{text}"
        return await self.ask(prompt)
    
    async def translate(
        self,
        text: str,
        target_language: str,
        source_language: str = "auto-detect"
    ) -> str:
        """Translate text to another language.
        
        Args:
            text: Text to translate
            target_language: Target language
            source_language: Source language or "auto-detect"
            
        Returns:
            Translated text
        """
        if source_language == "auto-detect":
            prompt = f"Translate the following text to {target_language}:\n\n{text}"
        else:
            prompt = f"Translate from {source_language} to {target_language}:\n\n{text}"
        
        return await self.ask(prompt)
    
    # Metrics and Memory
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics.
        
        Returns:
            Dictionary with metrics data
        """
        return self.metrics.get_stats()
    
    def get_conversation_history(self, n: int = 10) -> List[Dict[str, Any]]:
        """Get recent conversation history.
        
        Args:
            n: Number of messages to retrieve
            
        Returns:
            List of recent messages
        """
        return self.memory.get_context_window(n)
    
    def clear_memory(self) -> None:
        """Clear conversation memory and reset metrics."""
        self.memory.clear()
        self.metrics.reset()
    
    # Response Formatting
    def format_response(self, response: str, format_type: str = "markdown") -> str:
        """Format response text.
        
        Args:
            response: Response text to format
            format_type: Format type ("markdown" or "json")
            
        Returns:
            Formatted response
        """
        if format_type == "markdown":
            return self.formatter.to_markdown(response)
        elif format_type == "json":
            return self.formatter.to_json(response)
        else:
            return response
    
    def extract_code(self, response: str) -> List[Dict[str, str]]:
        """Extract code blocks from response.
        
        Args:
            response: Response containing code blocks
            
        Returns:
            List of code blocks with language and content
        """
        return self.formatter.extract_code_blocks(response)
    
    # Enhanced receive methods
    async def receive_messages(self) -> AsyncIterator[Message]:
        """Receive messages with callback support."""
        async for message in super().receive_messages():
            await self.callbacks.trigger('message_received', message)
            yield message
    
    async def receive_response(self) -> AsyncIterator[Message]:
        """Receive response with callback support."""
        async for message in super().receive_response():
            await self.callbacks.trigger('message_received', message)
            yield message
            if isinstance(message, ResultMessage):
                await self.callbacks.trigger('complete', message)