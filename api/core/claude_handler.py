"""Handler para integração com Claude Code SDK."""

import sys
import os
import asyncio
import uuid
import weakref
import threading
from typing import AsyncGenerator, Optional, Dict, Any, List
import json
import time
from datetime import datetime, timedelta
from dataclasses import dataclass, field

# Adiciona imports do projeto
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logging_config import get_contextual_logger
from middleware.exception_middleware import handle_errors
from core.session_manager import ClaudeCodeSessionManager

# Adiciona o diretório do SDK ao path  
sdk_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sdk')
sys.path.insert(0, sdk_dir)

from claude_code_sdk import (
    AssistantMessage,
    TextBlock,
    ResultMessage,
    ClaudeSDKClient,
    UserMessage,
    SystemMessage,
    ToolUseBlock,
    ToolResultBlock,
    ClaudeCodeOptions,
    __version__
)

@dataclass
class SessionConfig:
    """Configuração para uma sessão de chat."""
    system_prompt: Optional[str] = None
    allowed_tools: List[str] = field(default_factory=list)
    max_turns: Optional[int] = None
    permission_mode: str = 'bypassPermissions'
    cwd: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    
@dataclass 
class SessionHistory:
    """Histórico de uma sessão de chat."""
    messages: List[Dict[str, Any]] = field(default_factory=list)
    total_tokens: int = 0
    total_cost: float = 0.0

@dataclass
class PooledConnection:
    """Conexão pooled para reutilização."""
    client: 'ClaudeSDKClient'
    created_at: datetime = field(default_factory=datetime.now)
    last_used: datetime = field(default_factory=datetime.now)
    use_count: int = 0
    is_healthy: bool = True
    
class ClaudeHandler:
    """Gerenciador otimizado de conversas com Claude com pool de conexões."""
    
    # Configurações do pool
    POOL_MAX_SIZE = 10
    POOL_MIN_SIZE = 2
    CONNECTION_MAX_AGE_MINUTES = 60
    CONNECTION_MAX_USES = 100
    HEALTH_CHECK_INTERVAL = 300  # 5 minutos
    
    def __init__(self):
        self.clients: Dict[str, ClaudeSDKClient] = {}
        self.active_sessions: Dict[str, bool] = {}
        self.session_configs: Dict[str, SessionConfig] = {}
        self.session_histories: Dict[str, SessionHistory] = {}
        self.logger = get_contextual_logger(__name__)
        
        # Pool de conexões otimizado
        self.connection_pool: List[PooledConnection] = []
        self.pool_lock = threading.Lock()
        
        # Integração com session manager
        self.session_manager = ClaudeCodeSessionManager()
        
        # Task de manutenção do pool
        self.pool_maintenance_task = None
        self._pool_maintenance_started = False
        
        self.logger.info(
            "Claude Handler inicializado com pool de conexões",
            extra={
                "event": "handler_init", 
                "component": "claude_handler",
                "pool_config": {
                    "max_size": self.POOL_MAX_SIZE,
                    "min_size": self.POOL_MIN_SIZE,
                    "max_age_minutes": self.CONNECTION_MAX_AGE_MINUTES,
                    "max_uses": self.CONNECTION_MAX_USES
                }
            }
        )
        
    @handle_errors(timeout_seconds=30.0)
    async def create_session(self, session_id: str, config: Optional[SessionConfig] = None) -> None:
        """Cria uma nova sessão de chat com configuração opcional."""
        
        self.logger.info(
            "Criando nova sessão",
            extra={
                "event": "session_create_start",
                "session_id": session_id,
                "has_config": config is not None
            }
        )
        
        try:
            # Verifica limite de sessões no session manager
            if not self.session_manager.register_session(session_id):
                raise RuntimeError(f"Limite de sessões atingido ({self.session_manager.MAX_SESSIONS})")
            
            if session_id in self.clients:
                self.logger.warning(
                    "Sessão já existe, recriando",
                    extra={"event": "session_recreate", "session_id": session_id}
                )
                await self.destroy_session(session_id)
                
            # Usa configuração padrão se não fornecida
            if config is None:
                config = SessionConfig()
                
            # Tenta obter cliente do pool primeiro
            client = await self._get_or_create_pooled_client(config)
            
            self.clients[session_id] = client
            self.active_sessions[session_id] = True
            self.session_configs[session_id] = config
            self.session_histories[session_id] = SessionHistory()
            
            self.logger.info(
                "Sessão criada com sucesso",
                extra={
                    "event": "session_created",
                    "session_id": session_id,
                    "config": {
                        "system_prompt_length": len(config.system_prompt) if config.system_prompt else 0,
                        "allowed_tools_count": len(config.allowed_tools) if config.allowed_tools else 0,
                        "max_turns": config.max_turns,
                        "permission_mode": config.permission_mode,
                        "cwd": config.cwd
                    }
                }
            )
            
        except asyncio.TimeoutError:
            self.logger.error(
                "Timeout ao criar sessão",
                extra={"event": "session_create_timeout", "session_id": session_id}
            )
            raise
        except Exception as e:
            # Remove registro se criação falhou
            self.session_manager.unregister_session(session_id)
            
            self.logger.error(
                "Erro ao criar sessão",
                extra={
                    "event": "session_create_error",
                    "session_id": session_id,
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            )
            raise
        
    @handle_errors(timeout_seconds=15.0)
    async def destroy_session(self, session_id: str) -> None:
        """Destrói uma sessão existente."""
        
        self.logger.info(
            "Destruindo sessão",
            extra={"event": "session_destroy_start", "session_id": session_id}
        )
        
        try:
            if session_id in self.clients:
                client = self.clients[session_id]
                
                # Tenta retornar cliente ao pool se está saudável
                try:
                    if await self._is_client_healthy(client):
                        await self._return_client_to_pool(client)
                        self.logger.info(
                            "Cliente retornado ao pool durante destroy_session",
                            extra={"event": "client_pooled_on_destroy", "session_id": session_id}
                        )
                    else:
                        await asyncio.wait_for(client.disconnect(), timeout=10.0)
                except asyncio.TimeoutError:
                    self.logger.warning(
                        "Timeout ao desconectar cliente, forçando remoção",
                        extra={"event": "client_disconnect_timeout", "session_id": session_id}
                    )
                except Exception as e:
                    self.logger.warning(
                        "Erro ao desconectar cliente, continuando remoção",
                        extra={
                            "event": "client_disconnect_error",
                            "session_id": session_id,
                            "error_type": type(e).__name__,
                            "error_message": str(e)
                        }
                    )
                finally:
                    del self.clients[session_id]
                    
            # Limpa todas as referências
            self.active_sessions.pop(session_id, None)
            self.session_configs.pop(session_id, None)
            self.session_histories.pop(session_id, None)
            
            # Remove do session manager
            self.session_manager.unregister_session(session_id)
            
            self.logger.info(
                "Sessão destruída com sucesso",
                extra={"event": "session_destroyed", "session_id": session_id}
            )
            
        except Exception as e:
            self.logger.error(
                "Erro ao destruir sessão",
                extra={
                    "event": "session_destroy_error",
                    "session_id": session_id,
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
            )
            raise
            
    async def send_message(
        self, 
        session_id: str, 
        message: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Envia mensagem e retorna stream de respostas - FORÇA SESSION ID FIXO."""
        
        # FORÇA usar sempre o session ID unificado
        UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"
        session_id = UNIFIED_SESSION_ID  # SEMPRE usa o ID fixo
        
        # Cria sessão se não existir
        if session_id not in self.clients:
            await self.create_session(session_id)
        
        # Atualiza atividade da sessão
        self.session_manager.update_session_activity(session_id)
            
        # Usa sempre o session_id unificado
        real_session_id = UNIFIED_SESSION_ID
        client = self.clients[session_id]
        
        try:
            # Notifica que começou a processar
            yield {
                "type": "processing", 
                "session_id": real_session_id
            }
            
            # Envia query - FORÇA usar o session_id correto
            # HACK: O SDK ignora o session_id, então vamos interceptar
            await client.query(message, session_id=session_id)
            
            # SIMPLIFICADO - Recebe resposta e envia em chunks
            async for msg in client.receive_response():
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            # Pega o texto completo
                            text = block.text
                            
                            # Divide em pequenos pedaços e envia
                            words = text.split()
                            for i in range(0, len(words), 2):
                                chunk = ' '.join(words[i:i+2])
                                if chunk:
                                    yield {
                                        "type": "text_chunk",
                                        "content": chunk + " ",
                                        "session_id": real_session_id
                                    }
                        
                        elif isinstance(block, ToolUseBlock):
                            yield {
                                "type": "tool_use",
                                "tool": block.name,
                                "id": block.id,
                                "session_id": real_session_id
                            }
                                
                        elif isinstance(block, ToolUseBlock):
                            yield {
                                "type": "tool_use",
                                "tool": block.name,
                                "id": block.id,
                                "session_id": real_session_id
                            }
                            
                elif isinstance(msg, UserMessage):
                    for block in msg.content:
                        if isinstance(block, ToolResultBlock):
                            yield {
                                "type": "tool_result",
                                "tool_id": block.tool_use_id,
                                "content": block.content if block.content else "",
                                "session_id": real_session_id
                            }
                            
                elif isinstance(msg, ResultMessage):
                    # FORÇA usar o session_id que queremos
                    # Ignora completamente o que o SDK retorna
                    sdk_session_id = session_id  # Força usar o original SEMPRE
                    
                    # Não tenta pegar session_id do SDK para manter consistência
                    # sdk_session_id = getattr(msg, 'session_id', None)  # DESABILITADO
                    
                    # Fallback simples: busca em atributos da mensagem
                    if not sdk_session_id and hasattr(msg, '__dict__'):
                        for key, value in msg.__dict__.items():
                            if 'session' in key.lower() and isinstance(value, str) and len(value) > 10:
                                try:
                                    import uuid
                                    uuid.UUID(value)
                                    sdk_session_id = value
                                    break
                                except ValueError:
                                    continue
                    
                    # NÃO atualiza session_id - mantém o original para consistência
                    # if sdk_session_id and sdk_session_id != session_id:
                    #     real_session_id = sdk_session_id  # DESABILITADO
                    
                    result_data = {
                        "type": "result",
                        "session_id": real_session_id
                    }
                    
                    # Adiciona informações de uso se disponível
                    if hasattr(msg, 'usage') and msg.usage:
                        if hasattr(msg.usage, 'input_tokens'):
                            result_data["input_tokens"] = msg.usage.input_tokens
                            result_data["output_tokens"] = msg.usage.output_tokens
                        elif isinstance(msg.usage, dict):
                            result_data["input_tokens"] = msg.usage.get('input_tokens', 0)
                            result_data["output_tokens"] = msg.usage.get('output_tokens', 0)
                            
                        # Atualiza histórico da sessão e métricas
                        if session_id in self.session_histories:
                            history = self.session_histories[session_id]
                            if 'input_tokens' in result_data:
                                token_count = result_data['input_tokens'] + result_data.get('output_tokens', 0)
                                history.total_tokens += token_count
                                
                                # Atualiza métricas no session manager
                                self.session_manager.update_session_metrics(
                                    session_id, 
                                    total_tokens=history.total_tokens,
                                    message_count=len(history.messages) + 1
                                )
                            
                    if hasattr(msg, 'total_cost_usd') and msg.total_cost_usd:
                        result_data["cost_usd"] = msg.total_cost_usd
                        # Atualiza custo total
                        if session_id in self.session_histories:
                            self.session_histories[session_id].total_cost += msg.total_cost_usd
                            
                            # Atualiza métricas de custo
                            self.session_manager.update_session_metrics(
                                session_id, 
                                total_cost=self.session_histories[session_id].total_cost
                            )
                        
                    yield result_data
                    break
                    
        except Exception as e:
            # Atualiza métricas de erro
            try:
                current_metrics = self.session_manager.get_session_metrics(session_id)
                error_count = current_metrics.connection_errors + 1 if current_metrics else 1
                self.session_manager.update_session_metrics(
                    session_id, 
                    connection_errors=error_count
                )
            except:
                pass  # Não deixa falhas de métricas impedirem relatório de erro
            
            yield {
                "type": "error",
                "error": str(e),
                "session_id": real_session_id
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
        """Limpa o contexto da sessão mantendo a configuração."""
        config = self.session_configs.get(session_id, SessionConfig())
        await self.destroy_session(session_id)
        await self.create_session(session_id, config)
        
    async def get_session_info(self, session_id: str) -> Dict[str, Any]:
        """Retorna informações sobre uma sessão."""
        if session_id not in self.clients:
            return {"error": "Session not found"}
            
        config = self.session_configs.get(session_id, SessionConfig())
        history = self.session_histories.get(session_id, SessionHistory())
        
        return {
            "session_id": session_id,
            "active": session_id in self.active_sessions,
            "config": {
                "system_prompt": config.system_prompt,
                "allowed_tools": config.allowed_tools,
                "max_turns": config.max_turns,
                "permission_mode": config.permission_mode,
                "cwd": config.cwd,
                "created_at": config.created_at.isoformat()
            },
            "history": {
                "message_count": len(history.messages),
                "total_tokens": history.total_tokens,
                "total_cost": history.total_cost
            }
        }
        
    async def get_all_sessions(self) -> List[Dict[str, Any]]:
        """Retorna lista de todas as sessões ativas."""
        sessions = []
        for session_id in self.clients:
            sessions.append(await self.get_session_info(session_id))
        return sessions
        
    async def update_session_config(self, session_id: str, config: SessionConfig) -> bool:
        """Atualiza a configuração de uma sessão existente."""
        if session_id not in self.clients:
            return False
            
        # Salva histórico antes de recriar
        history = self.session_histories.get(session_id, SessionHistory())
        
        # Recria sessão com nova configuração
        await self.destroy_session(session_id)
        await self.create_session(session_id, config)
        
        # Restaura histórico
        self.session_histories[session_id] = history
        
        return True
    
    # ===========================================
    # POOL DE CONEXÕES OTIMIZADO
    # ===========================================
    
    async def ensure_pool_maintenance_started(self):
        """Garante que a manutenção do pool esteja iniciada."""
        if not self._pool_maintenance_started:
            self._pool_maintenance_started = True
            await self._start_pool_maintenance()
    
    async def _start_pool_maintenance(self):
        """Inicia tarefa de manutenção do pool de conexões."""
        self.pool_maintenance_task = asyncio.create_task(self._pool_maintenance_loop())
        self.logger.info("Manutenção do pool de conexões iniciada")
    
    async def _pool_maintenance_loop(self):
        """Loop de manutenção do pool de conexões."""
        while True:
            try:
                await asyncio.sleep(self.HEALTH_CHECK_INTERVAL)
                await self._maintain_pool()
                await self._health_check_pool()
            except Exception as e:
                self.logger.error(
                    "Erro na manutenção do pool",
                    extra={"event": "pool_maintenance_error", "error": str(e)}
                )
    
    async def _maintain_pool(self):
        """Mantém o pool de conexões removendo conexões antigas e não saudáveis."""
        with self.pool_lock:
            now = datetime.now()
            connections_to_remove = []
            
            for i, conn in enumerate(self.connection_pool):
                # Remove conexões muito antigas
                age_minutes = (now - conn.created_at).total_seconds() / 60
                if age_minutes > self.CONNECTION_MAX_AGE_MINUTES:
                    connections_to_remove.append(i)
                    continue
                
                # Remove conexões com muitos usos
                if conn.use_count > self.CONNECTION_MAX_USES:
                    connections_to_remove.append(i)
                    continue
                
                # Remove conexões não saudáveis
                if not conn.is_healthy:
                    connections_to_remove.append(i)
            
            # Remove conexões identificadas (em ordem reversa)
            for i in reversed(connections_to_remove):
                removed_conn = self.connection_pool.pop(i)
                try:
                    await removed_conn.client.disconnect()
                except:
                    pass
            
            if connections_to_remove:
                self.logger.info(
                    f"Removidas {len(connections_to_remove)} conexões antigas/não saudáveis do pool",
                    extra={"event": "pool_cleanup", "removed_count": len(connections_to_remove)}
                )
    
    async def _health_check_pool(self):
        """Verifica saúde das conexões no pool."""
        with self.pool_lock:
            for conn in self.connection_pool:
                conn.is_healthy = await self._is_client_healthy(conn.client)
    
    async def _is_client_healthy(self, client: ClaudeSDKClient) -> bool:
        """Verifica se um cliente está saudável."""
        try:
            # Implementação simples: verifica se cliente não está None e ainda conectado
            return client is not None and hasattr(client, '_connected') and getattr(client, '_connected', False)
        except Exception:
            return False
    
    async def _get_or_create_pooled_client(self, config: SessionConfig) -> ClaudeSDKClient:
        """Obtém cliente do pool ou cria um novo."""
        # Tenta obter do pool primeiro
        pooled_client = await self._get_from_pool()
        if pooled_client:
            self.logger.info(
                "Cliente obtido do pool",
                extra={"event": "client_from_pool", "pool_size": len(self.connection_pool)}
            )
            return pooled_client
        
        # Se não há cliente disponível no pool, cria novo
        return await self._create_new_client(config)
    
    async def _get_from_pool(self) -> Optional[ClaudeSDKClient]:
        """Obtém cliente saudável do pool."""
        with self.pool_lock:
            for i, conn in enumerate(self.connection_pool):
                if conn.is_healthy:
                    # Remove do pool para uso
                    connection = self.connection_pool.pop(i)
                    connection.last_used = datetime.now()
                    connection.use_count += 1
                    return connection.client
        
        return None
    
    async def _create_new_client(self, config: SessionConfig) -> ClaudeSDKClient:
        """Cria novo cliente SDK."""
        # SEMPRE cria opções para garantir que permission_mode seja aplicado
        options = ClaudeCodeOptions(
            system_prompt=config.system_prompt if config.system_prompt else None,
            allowed_tools=config.allowed_tools if config.allowed_tools else None,
            max_turns=config.max_turns if config.max_turns else None,
            permission_mode=config.permission_mode,  # SEMPRE inclui bypass
            cwd=config.cwd if config.cwd else None
        )

        # Log de debug para verificar permissões
        self.logger.info(
            f"🔑 Criando cliente com permission_mode: {config.permission_mode}",
            extra={
                "event": "client_options",
                "permission_mode": config.permission_mode,
                "has_allowed_tools": bool(config.allowed_tools),
                "cwd": config.cwd
            }
        )

        client = ClaudeSDKClient(options=options)
        await asyncio.wait_for(client.connect(), timeout=20.0)

        self.logger.info(
            "Novo cliente criado com bypass permissions",
            extra={"event": "client_created", "pool_size": len(self.connection_pool)}
        )
        
        return client
    
    async def _return_client_to_pool(self, client: ClaudeSDKClient):
        """Retorna cliente ao pool se houver espaço."""
        with self.pool_lock:
            # Verifica se há espaço no pool
            if len(self.connection_pool) >= self.POOL_MAX_SIZE:
                # Pool cheio, desconecta o cliente
                try:
                    await client.disconnect()
                except:
                    pass
                return
            
            # Adiciona ao pool
            pooled_conn = PooledConnection(
                client=client,
                last_used=datetime.now(),
                is_healthy=True
            )
            self.connection_pool.append(pooled_conn)
            
            self.logger.info(
                "Cliente retornado ao pool",
                extra={"event": "client_returned_to_pool", "pool_size": len(self.connection_pool)}
            )
    
    def get_pool_status(self) -> Dict[str, Any]:
        """Retorna status do pool de conexões."""
        with self.pool_lock:
            healthy_count = sum(1 for conn in self.connection_pool if conn.is_healthy)
            
            return {
                "pool_size": len(self.connection_pool),
                "healthy_connections": healthy_count,
                "max_size": self.POOL_MAX_SIZE,
                "min_size": self.POOL_MIN_SIZE,
                "connections": [
                    {
                        "created_at": conn.created_at.isoformat(),
                        "last_used": conn.last_used.isoformat(),
                        "use_count": conn.use_count,
                        "is_healthy": conn.is_healthy,
                        "age_minutes": (datetime.now() - conn.created_at).total_seconds() / 60
                    }
                    for conn in self.connection_pool
                ]
            }
    
    async def shutdown_pool(self):
        """Para e limpa o pool de conexões."""
        # Para task de manutenção
        if self.pool_maintenance_task:
            self.pool_maintenance_task.cancel()
            try:
                await self.pool_maintenance_task
            except asyncio.CancelledError:
                pass
        
        # Desconecta todas as conexões do pool
        with self.pool_lock:
            for conn in self.connection_pool:
                try:
                    await conn.client.disconnect()
                except:
                    pass
            
            pool_size = len(self.connection_pool)
            self.connection_pool.clear()
        
        # Para session manager
        if hasattr(self.session_manager, 'stop_scheduler'):
            await self.session_manager.stop_scheduler()
        
        self.logger.info(
            f"Pool de conexões encerrado - {pool_size} conexões fechadas",
            extra={"event": "pool_shutdown", "connections_closed": pool_size}
        )