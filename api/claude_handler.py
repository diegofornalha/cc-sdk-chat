"""Handler para integração com Claude Code SDK."""

import sys
import os
import asyncio
from typing import AsyncGenerator, Optional, Dict, Any, List
import json
import time
from datetime import datetime
from dataclasses import dataclass, field

# Adiciona o diretório do SDK ao path
sdk_dir = '/home/suthub/.claude/api-claude-code-app/claude-code-sdk-python'
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
    ClaudeCodeOptions,
    __version__
)

@dataclass
class SessionConfig:
    """Configuração para uma sessão de chat."""
    system_prompt: Optional[str] = None
    allowed_tools: List[str] = field(default_factory=list)
    max_turns: Optional[int] = None
    permission_mode: str = 'acceptEdits'
    cwd: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    
@dataclass 
class SessionHistory:
    """Histórico de uma sessão de chat."""
    messages: List[Dict[str, Any]] = field(default_factory=list)
    total_tokens: int = 0
    total_cost: float = 0.0
    
class ClaudeHandler:
    """Gerenciador de conversas com Claude."""
    
    def __init__(self):
        self.clients: Dict[str, ClaudeSDKClient] = {}
        self.active_sessions: Dict[str, bool] = {}
        self.session_configs: Dict[str, SessionConfig] = {}
        self.session_histories: Dict[str, SessionHistory] = {}
        
    async def create_session(self, session_id: str, config: Optional[SessionConfig] = None) -> None:
        """Cria uma nova sessão de chat com configuração opcional."""
        if session_id in self.clients:
            await self.destroy_session(session_id)
            
        # Usa configuração padrão se não fornecida
        if config is None:
            config = SessionConfig()
            
        # Cria opções do SDK baseadas na configuração
        options = None
        if any([config.system_prompt, config.allowed_tools, config.max_turns, config.cwd]):
            options = ClaudeCodeOptions(
                system_prompt=config.system_prompt,
                allowed_tools=config.allowed_tools if config.allowed_tools else None,
                max_turns=config.max_turns,
                permission_mode=config.permission_mode,
                cwd=config.cwd
            )
            
        client = ClaudeSDKClient(options=options)
        await client.connect()
        
        self.clients[session_id] = client
        self.active_sessions[session_id] = True
        self.session_configs[session_id] = config
        self.session_histories[session_id] = SessionHistory()
        
    async def destroy_session(self, session_id: str) -> None:
        """Destrói uma sessão existente."""
        if session_id in self.clients:
            try:
                await self.clients[session_id].disconnect()
            except:
                pass
            del self.clients[session_id]
            
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
        if session_id in self.session_configs:
            del self.session_configs[session_id]
        if session_id in self.session_histories:
            del self.session_histories[session_id]
            
    async def send_message(
        self, 
        session_id: str, 
        message: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Envia mensagem e retorna stream de respostas otimizado."""
        
        # Cria sessão se não existir
        if session_id not in self.clients:
            await self.create_session(session_id)
            
        # 🔥 CAPTURA DO SESSION_ID REAL: O SDK pode gerar um session_id próprio
        real_session_id = session_id  # Começamos com o fornecido
            
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
                    "session_id": real_session_id
                }
                text_buffer = []
                buffer_size = 0
        
        try:
            # Notifica que começou a processar
            yield {
                "type": "processing", 
                "session_id": real_session_id
            }
            
            # Envia query (o SDK pode gerar um novo session_id internamente)
            await client.query(message, session_id=session_id)
            
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
                    # Flush qualquer texto restante no buffer
                    async for response in flush_buffer():
                        yield response
                    
                    # 🔥 ESTRATÉGIA ROBUSTA: Encontra o session_id real via filesystem
                    # Após cada interação, o Claude SDK cria/atualiza um arquivo .jsonl
                    # Vamos buscar o arquivo mais recente para obter o session_id real
                    
                    sdk_session_id = None
                    
                    # Tentativa 1: Busca no filesystem o arquivo .jsonl mais recente
                    try:
                        import glob
                        from pathlib import Path
                        
                        # Busca arquivos .jsonl criados/modificados nos últimos 10 segundos
                        claude_projects = Path.home() / ".claude" / "projects"
                        current_time = time.time()
                        
                        for project_dir in claude_projects.iterdir():
                            if project_dir.is_dir() and "cc-sdk-chat" in project_dir.name:
                                for jsonl_file in project_dir.glob("*.jsonl"):
                                    file_mtime = jsonl_file.stat().st_mtime
                                    # Se arquivo foi modificado nos últimos 10 segundos
                                    if (current_time - file_mtime) <= 10:
                                        # Este é provavelmente o arquivo da sessão atual
                                        potential_session_id = jsonl_file.stem
                                        
                                        # Valida se é UUID válido
                                        try:
                                            import uuid
                                            uuid.UUID(potential_session_id)
                                            sdk_session_id = potential_session_id
                                            print(f"🎯 Session ID real encontrado via filesystem: {sdk_session_id}")
                                            break
                                        except ValueError:
                                            continue
                            if sdk_session_id:
                                break
                    except Exception as e:
                        print(f"⚠️ Erro ao buscar session_id via filesystem: {e}")
                    
                    # Tentativa 2: Métodos diretos do SDK (fallback)
                    if not sdk_session_id:
                        # Tentativa 2a: Atributo direto
                        sdk_session_id = getattr(msg, 'session_id', None)
                        
                        # Tentativa 2b: Dentro de metadata ou context
                        if not sdk_session_id and hasattr(msg, '_metadata'):
                            sdk_session_id = getattr(msg._metadata, 'session_id', None)
                            
                        # Tentativa 2c: No dict interno da mensagem  
                        if not sdk_session_id and hasattr(msg, '__dict__'):
                            for key, value in msg.__dict__.items():
                                if 'session' in key.lower() and isinstance(value, str) and len(value) > 10:
                                    try:
                                        import uuid
                                        uuid.UUID(value)
                                        sdk_session_id = value
                                        print(f"🔍 Session ID encontrado via atributo {key}: {sdk_session_id}")
                                        break
                                    except ValueError:
                                        continue
                    
                    # Se encontramos um session_id diferente E VÁLIDO, atualizamos
                    if sdk_session_id and sdk_session_id != session_id:
                        # Valida se o session_id encontrado realmente existe
                        session_file_path = None
                        try:
                            from pathlib import Path
                            claude_projects = Path.home() / ".claude" / "projects"
                            for project_dir in claude_projects.iterdir():
                                if project_dir.is_dir() and "cc-sdk-chat" in project_dir.name:
                                    potential_file = project_dir / f"{sdk_session_id}.jsonl"
                                    if potential_file.exists():
                                        session_file_path = potential_file
                                        break
                                        
                            if session_file_path:
                                real_session_id = sdk_session_id
                                print(f"✅ Session ID real validado: {real_session_id} (arquivo: {session_file_path})")
                            else:
                                # Session ID do SDK não tem arquivo correspondente
                                print(f"⚠️ Session ID do SDK {sdk_session_id} não tem arquivo correspondente")
                                real_session_id = session_id  # Mantém o original
                        except Exception as e:
                            print(f"❌ Erro ao validar session_id: {e}")
                            real_session_id = session_id  # Mantém o original
                    else:
                        # Mantém session_id original
                        real_session_id = session_id
                        if not sdk_session_id:
                            print(f"🔍 SDK não retornou session_id, mantendo cliente: {session_id}")
                    
                    result_data = {
                        "type": "result",
                        "session_id": real_session_id  # Usa o session_id validado
                    }
                    
                    # Adiciona informações de uso se disponível
                    if hasattr(msg, 'usage') and msg.usage:
                        if hasattr(msg.usage, 'input_tokens'):
                            result_data["input_tokens"] = msg.usage.input_tokens
                            result_data["output_tokens"] = msg.usage.output_tokens
                        elif isinstance(msg.usage, dict):
                            result_data["input_tokens"] = msg.usage.get('input_tokens', 0)
                            result_data["output_tokens"] = msg.usage.get('output_tokens', 0)
                            
                        # Atualiza histórico da sessão
                        if session_id in self.session_histories:
                            history = self.session_histories[session_id]
                            if 'input_tokens' in result_data:
                                history.total_tokens += result_data['input_tokens'] + result_data.get('output_tokens', 0)
                            
                    if hasattr(msg, 'total_cost_usd') and msg.total_cost_usd:
                        result_data["cost_usd"] = msg.total_cost_usd
                        # Atualiza custo total
                        if session_id in self.session_histories:
                            self.session_histories[session_id].total_cost += msg.total_cost_usd
                        
                    yield result_data
                    break
            
            # Flush final do buffer se houver conteúdo
            async for response in flush_buffer():
                yield response
                    
        except Exception as e:
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