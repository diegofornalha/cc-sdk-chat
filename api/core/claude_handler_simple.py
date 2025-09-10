"""
Gerenciador simplificado de conversas com Claude para Session ID único.
Versão otimizada sem pool de conexões - apenas 1 cliente ativo.
"""

import sys
import os
from typing import Optional, AsyncGenerator, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
import logging

# Adiciona SDK ao path
sdk_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sdk')
sys.path.insert(0, sdk_dir)

from claude_code_sdk import (
    ClaudeSDKClient,
    ClaudeCodeOptions,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
    ThinkingBlock
)

from services.logging_config import get_contextual_logger

# Session ID único fixo
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"

@dataclass
class SessionStats:
    """Estatísticas da sessão única."""
    messages_sent: int = 0
    messages_received: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)

class SimplifiedClaudeHandler:
    """
    Gerenciador simplificado para Session ID único.
    Mantém apenas 1 conexão ativa sem pool.
    """
    
    def __init__(self):
        self.client: Optional[ClaudeSDKClient] = None
        self.is_connected: bool = False
        self.stats = SessionStats()
        self.logger = get_contextual_logger(__name__)
        
        self.logger.info(
            "Claude Handler Simplificado inicializado",
            extra={
                "event": "handler_init",
                "session_id": UNIFIED_SESSION_ID,
                "mode": "single_connection"
            }
        )
    
    async def ensure_connection(self) -> None:
        """Garante que há uma conexão ativa com Claude."""
        if not self.is_connected or not self.client:
            await self._create_connection()
    
    async def _create_connection(self) -> None:
        """Cria uma nova conexão com Claude."""
        self.logger.info(
            "Criando conexão única",
            extra={"event": "connection_create", "session_id": UNIFIED_SESSION_ID}
        )
        
        try:
            # Configuração otimizada para sessão única
            options = ClaudeCodeOptions(
                system_prompt="Você é um assistente útil.",
                permission_mode='acceptEdits',
                cwd=os.path.dirname(os.path.dirname(__file__)),
                max_turns=None  # Sem limite de turnos
            )
            
            self.client = ClaudeSDKClient(options)
            await self.client.connect()
            self.is_connected = True
            
            self.logger.info(
                "Conexão estabelecida com sucesso",
                extra={"event": "connection_success", "session_id": UNIFIED_SESSION_ID}
            )
            
        except Exception as e:
            self.logger.error(
                f"Erro ao criar conexão: {e}",
                extra={"event": "connection_error", "error": str(e)}
            )
            self.is_connected = False
            raise
    
    async def send_message(self, message: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Envia mensagem e retorna resposta em streaming.
        
        Args:
            message: Mensagem do usuário
            
        Yields:
            Chunks da resposta em tempo real
        """
        # Garante conexão ativa
        await self.ensure_connection()
        
        # Atualiza estatísticas
        self.stats.messages_sent += 1
        self.stats.last_activity = datetime.now()
        
        try:
            # Notifica início do processamento
            yield {
                "type": "processing",
                "session_id": UNIFIED_SESSION_ID
            }
            
            # Envia mensagem
            await self.client.query(message, session_id=UNIFIED_SESSION_ID)
            
            # Processa resposta em streaming
            async for msg in self.client.receive_response():
                if isinstance(msg, AssistantMessage):
                    self.stats.messages_received += 1
                    
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            # Envia texto em chunks pequenos
                            text = block.text
                            chunk_size = 5  # palavras por chunk
                            words = text.split()
                            
                            for i in range(0, len(words), chunk_size):
                                chunk = ' '.join(words[i:i+chunk_size])
                                if chunk:
                                    yield {
                                        "type": "text_chunk",
                                        "content": chunk + " ",
                                        "session_id": UNIFIED_SESSION_ID
                                    }
                        
                        elif isinstance(block, ToolUseBlock):
                            yield {
                                "type": "tool_use",
                                "tool": block.name,
                                "session_id": UNIFIED_SESSION_ID
                            }
                        
                        elif isinstance(block, ThinkingBlock):
                            # Opcionalmente enviar thinking
                            pass
                
                elif isinstance(msg, ResultMessage):
                    # Atualiza estatísticas finais
                    if msg.usage:
                        self.stats.total_tokens += msg.usage.get('output_tokens', 0)
                    if msg.total_cost_usd:
                        self.stats.total_cost += msg.total_cost_usd
                    
                    yield {
                        "type": "done",
                        "session_id": UNIFIED_SESSION_ID,
                        "stats": {
                            "tokens": self.stats.total_tokens,
                            "cost": self.stats.total_cost,
                            "messages": self.stats.messages_received
                        }
                    }
                    
        except Exception as e:
            self.logger.error(
                f"Erro ao processar mensagem: {e}",
                extra={"event": "message_error", "error": str(e)}
            )
            
            yield {
                "type": "error",
                "error": str(e),
                "session_id": UNIFIED_SESSION_ID
            }
    
    async def reset_connection(self) -> None:
        """Reseta a conexão (útil para limpar contexto)."""
        self.logger.info(
            "Resetando conexão",
            extra={"event": "connection_reset", "session_id": UNIFIED_SESSION_ID}
        )
        
        if self.client and self.is_connected:
            try:
                await self.client.disconnect()
            except:
                pass
        
        self.client = None
        self.is_connected = False
        self.stats = SessionStats()
        
        # Recria conexão
        await self.ensure_connection()
    
    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas da sessão."""
        return {
            "session_id": UNIFIED_SESSION_ID,
            "is_connected": self.is_connected,
            "messages_sent": self.stats.messages_sent,
            "messages_received": self.stats.messages_received,
            "total_tokens": self.stats.total_tokens,
            "total_cost": self.stats.total_cost,
            "uptime_minutes": (datetime.now() - self.stats.created_at).total_seconds() / 60,
            "last_activity": self.stats.last_activity.isoformat()
        }
    
    async def cleanup(self) -> None:
        """Limpa recursos ao encerrar."""
        if self.client and self.is_connected:
            try:
                await self.client.disconnect()
            except:
                pass
        
        self.client = None
        self.is_connected = False
        
        self.logger.info(
            "Handler limpo e encerrado",
            extra={"event": "handler_cleanup", "stats": self.get_stats()}
        )

# Singleton global para uso em toda aplicação
_handler_instance: Optional[SimplifiedClaudeHandler] = None

def get_handler() -> SimplifiedClaudeHandler:
    """Retorna instância única do handler."""
    global _handler_instance
    if _handler_instance is None:
        _handler_instance = SimplifiedClaudeHandler()
    return _handler_instance