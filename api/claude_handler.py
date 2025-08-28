"""Handler para integração com Claude Code SDK."""

import sys
import os
import asyncio
from typing import AsyncGenerator, Optional, Dict, Any
import json
import time

# Adiciona o diretório do SDK ao path
sdk_dir = '/home/codable/Claudable/cc-sdk-chat/api/claude-code-sdk-python'
sys.path.insert(0, sdk_dir)

from src import (
    AssistantMessage,
    TextBlock,
    ResultMessage,
    ClaudeSDKClient,
    UserMessage,
    SystemMessage,
    ToolUseBlock,
    ToolResultBlock,
    __version__
)

class ClaudeHandler:
    """Gerenciador de conversas com Claude."""
    
    def __init__(self):
        self.clients: Dict[str, ClaudeSDKClient] = {}
        self.active_sessions: Dict[str, bool] = {}
        
    async def create_session(self, session_id: str) -> None:
        """Cria uma nova sessão de chat."""
        if session_id in self.clients:
            await self.destroy_session(session_id)
            
        client = ClaudeSDKClient()
        await client.connect()
        self.clients[session_id] = client
        self.active_sessions[session_id] = True
        
    async def destroy_session(self, session_id: str) -> None:
        """Destrói uma sessão existente."""
        if session_id in self.clients:
            try:
                await self.clients[session_id].disconnect()
            except:
                pass
            del self.clients[session_id]
            del self.active_sessions[session_id]
            
    async def send_message(
        self, 
        session_id: str, 
        message: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Envia mensagem e retorna stream de respostas otimizado."""
        
        # Cria sessão se não existir
        if session_id not in self.clients:
            await self.create_session(session_id)
            
        client = self.clients[session_id]
        
        # Buffer para acumular texto antes de enviar
        text_buffer = []
        buffer_size = 0
        BUFFER_THRESHOLD = 20  # Envia a cada 20 caracteres (mais responsivo)
        last_flush = time.time()
        FLUSH_INTERVAL = 0.05  # Flush a cada 50ms (mais rápido)
        
        async def flush_buffer():
            """Envia conteúdo do buffer."""
            nonlocal text_buffer, buffer_size
            if text_buffer:
                combined_text = ''.join(text_buffer)
                yield {
                    "type": "assistant_text",
                    "content": combined_text,
                    "session_id": session_id
                }
                text_buffer = []
                buffer_size = 0
        
        try:
            # Notifica que começou a processar
            yield {
                "type": "processing",
                "session_id": session_id
            }
            
            # Envia query
            await client.query(message)
            
            # Stream de respostas com buffer
            async for msg in client.receive_response():
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            # Adiciona ao buffer
                            text_buffer.append(block.text)
                            buffer_size += len(block.text)
                            
                            # Flush se atingir threshold ou timeout
                            current_time = time.time()
                            if buffer_size >= BUFFER_THRESHOLD or (current_time - last_flush) >= FLUSH_INTERVAL:
                                async for response in flush_buffer():
                                    yield response
                                last_flush = current_time
                                # Pequeno delay para suavizar streaming
                                await asyncio.sleep(0.01)
                                
                        elif isinstance(block, ToolUseBlock):
                            # Flush buffer antes de enviar tool use
                            async for response in flush_buffer():
                                yield response
                                
                            yield {
                                "type": "tool_use",
                                "tool": block.name,
                                "id": block.id,
                                "session_id": session_id
                            }
                            
                elif isinstance(msg, UserMessage):
                    for block in msg.content:
                        if isinstance(block, ToolResultBlock):
                            yield {
                                "type": "tool_result",
                                "tool_id": block.tool_use_id,
                                "content": block.content if block.content else "",
                                "session_id": session_id
                            }
                            
                elif isinstance(msg, ResultMessage):
                    # Flush qualquer texto restante no buffer
                    async for response in flush_buffer():
                        yield response
                    
                    result_data = {
                        "type": "result",
                        "session_id": session_id
                    }
                    
                    # Adiciona informações de uso se disponível
                    if hasattr(msg, 'usage') and msg.usage:
                        if hasattr(msg.usage, 'input_tokens'):
                            result_data["input_tokens"] = msg.usage.input_tokens
                            result_data["output_tokens"] = msg.usage.output_tokens
                        elif isinstance(msg.usage, dict):
                            result_data["input_tokens"] = msg.usage.get('input_tokens', 0)
                            result_data["output_tokens"] = msg.usage.get('output_tokens', 0)
                            
                    if hasattr(msg, 'total_cost_usd') and msg.total_cost_usd:
                        result_data["cost_usd"] = msg.total_cost_usd
                        
                    yield result_data
                    break
            
            # Flush final do buffer se houver conteúdo
            async for response in flush_buffer():
                yield response
                    
        except Exception as e:
            yield {
                "type": "error",
                "error": str(e),
                "session_id": session_id
            }
            
    async def interrupt_session(self, session_id: str) -> bool:
        """Interrompe a execução atual."""
        if session_id in self.clients:
            try:
                await self.clients[session_id].interrupt()
                return True
            except:
                pass
        return False
        
    async def clear_session(self, session_id: str) -> None:
        """Limpa o contexto da sessão."""
        await self.destroy_session(session_id)
        await self.create_session(session_id)