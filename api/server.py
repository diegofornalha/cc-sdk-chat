"""Servidor FastAPI para integração com Claude Code SDK."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from fastapi import Path
from typing import Optional, Dict, Any, List
import asyncio
import json
import uuid

from claude_handler import ClaudeHandler, SessionConfig
from analytics_service import AnalyticsService
from session_manager import ClaudeCodeSessionManager
from session_validator import SessionValidator

app = FastAPI(
    title="Claude Chat API",
    description="""
    ## API de Chat com Claude Code SDK
    
    Esta API fornece integração com o Claude Code SDK para conversas em streaming.
    
    ### Funcionalidades principais:
    
    * **Chat em Streaming** - Respostas em tempo real via Server-Sent Events (SSE)
    * **Gerenciamento de Sessões** - Criar, interromper e limpar sessões de chat
    * **Contexto Persistente** - Mantém histórico de conversas por sessão
    * **Interrupção em Tempo Real** - Pare respostas em andamento instantaneamente
    
    ### Como usar:
    
    1. Crie uma nova sessão com `/api/new-session`
    2. Envie mensagens para `/api/chat` com o `session_id`
    3. Receba respostas em streaming via SSE
    4. Gerencie a sessão com endpoints de controle
    
    ### Formato de Resposta SSE:
    
    As respostas são enviadas como eventos SSE no formato:
    ```
    data: {"type": "content", "content": "texto", "session_id": "uuid"}
    data: {"type": "done", "session_id": "uuid"}
    ```
    """,
    version="1.0.0",
    contact={
        "name": "Suporte API",
        "email": "api@example.com"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    },
    servers=[
        {
            "url": "http://localhost:8989",
            "description": "Servidor de desenvolvimento"
        }
    ],
    tags_metadata=[
        {
            "name": "Chat",
            "description": "Operações de chat com Claude"
        },
        {
            "name": "Sessões",
            "description": "Gerenciamento de sessões de chat"
        },
        {
            "name": "Sistema",
            "description": "Endpoints de sistema e monitoramento"
        }
    ]
)

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3082", 
        "http://localhost:3000",
        "http://127.0.0.1:3082",
        "https://suthub.agentesintegrados.com",
        "http://suthub.agentesintegrados.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Handlers globais
claude_handler = ClaudeHandler()
analytics_service = AnalyticsService()
session_manager = ClaudeCodeSessionManager()
session_validator = SessionValidator()

class ChatMessage(BaseModel):
    """Modelo para mensagem de chat."""
    message: str = Field(
        ...,
        description="Conteúdo da mensagem a ser enviada para Claude",
        example="Olá, como você pode me ajudar hoje?"
    )
    session_id: Optional[str] = Field(
        None,
        description="ID da sessão. Se não fornecido, será gerado automaticamente",
        example="550e8400-e29b-41d4-a716-446655440000"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "Explique o que é Machine Learning",
                "session_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }

class SessionAction(BaseModel):
    """Modelo para ações em sessões."""
    session_id: str = Field(
        ...,
        description="ID único da sessão",
        example="550e8400-e29b-41d4-a716-446655440000"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }

class HealthResponse(BaseModel):
    """Resposta do health check."""
    status: str = Field(..., description="Status da API", example="ok")
    service: str = Field(..., description="Nome do serviço", example="Claude Chat API")

class SessionResponse(BaseModel):
    """Resposta para operações de sessão."""
    session_id: str = Field(..., description="ID da sessão", example="550e8400-e29b-41d4-a716-446655440000")

class StatusResponse(BaseModel):
    """Resposta genérica com status."""
    status: str = Field(..., description="Status da operação", example="success")
    session_id: str = Field(..., description="ID da sessão afetada", example="550e8400-e29b-41d4-a716-446655440000")

class StreamEvent(BaseModel):
    """Evento SSE para streaming."""
    type: str = Field(..., description="Tipo do evento", example="content")
    content: Optional[str] = Field(None, description="Conteúdo da mensagem", example="Olá! Como posso ajudar?")
    session_id: str = Field(..., description="ID da sessão", example="550e8400-e29b-41d4-a716-446655440000")
    error: Optional[str] = Field(None, description="Mensagem de erro se houver")

class SessionConfigRequest(BaseModel):
    """Configuração para criar ou atualizar uma sessão."""
    system_prompt: Optional[str] = Field(None, description="System prompt para a sessão", example="Você é um assistente útil")
    allowed_tools: Optional[List[str]] = Field(default_factory=list, description="Ferramentas permitidas", example=["Read", "Write", "Bash"])
    max_turns: Optional[int] = Field(None, description="Número máximo de turnos", example=10)
    permission_mode: str = Field('acceptEdits', description="Modo de permissão para edições", example="acceptEdits")
    cwd: Optional[str] = Field(None, description="Diretório de trabalho", example="/home/user/projeto")
    
    class Config:
        json_schema_extra = {
            "example": {
                "system_prompt": "Você é um assistente especializado em Python",
                "allowed_tools": ["Read", "Write", "Bash"],
                "max_turns": 10,
                "permission_mode": "acceptEdits",
                "cwd": "/home/user/projeto"
            }
        }

class SessionInfoResponse(BaseModel):
    """Informações detalhadas de uma sessão."""
    session_id: str
    active: bool
    config: Dict[str, Any]
    history: Dict[str, Any]

@app.get(
    "/",
    tags=["Sistema"],
    summary="Health Check",
    description="Verifica se a API está funcionando corretamente",
    response_description="Status da API",
    responses={
        200: {
            "description": "API funcionando normalmente",
            "content": {
                "application/json": {
                    "example": {"status": "ok", "service": "Claude Chat API"}
                }
            }
        }
    },
    response_model=HealthResponse
)
async def root() -> HealthResponse:
    """Health check endpoint para verificar o status da API."""
    return HealthResponse(status="ok", service="Claude Chat API")

@app.post(
    "/api/chat",
    tags=["Chat"],
    summary="Enviar Mensagem",
    description="""Envia uma mensagem para Claude e recebe a resposta em streaming via SSE.
    
    As respostas são enviadas como Server-Sent Events (SSE) permitindo recebimento em tempo real.
    Cada chunk de resposta é enviado como um evento 'data' no formato JSON.
    """,
    response_description="Stream SSE com resposta de Claude",
    responses={
        200: {
            "description": "Stream SSE iniciado com sucesso",
            "content": {
                "text/event-stream": {
                    "example": "data: {\"type\": \"content\", \"content\": \"Olá!\", \"session_id\": \"uuid\"}\n\n"
                }
            }
        },
        500: {
            "description": "Erro no processamento da mensagem"
        }
    }
)
async def send_message(chat_message: ChatMessage) -> StreamingResponse:
    """Envia mensagem para Claude e retorna resposta em streaming."""
    
    # Se não há session_id, deixa None para Claude SDK criar
    session_id = chat_message.session_id
    
    async def generate():
        """Gera stream SSE."""
        # Inicializa real_session_id no escopo da função
        real_session_id = session_id
        
        try:
            async for response in claude_handler.send_message(
                session_id, 
                chat_message.message
            ):
                # Captura session_id real quando disponível
                if "session_id" in response:
                    real_session_id = response["session_id"]
                    
                # Se é primeira mensagem sem session_id, envia evento de nova sessão
                if not session_id and real_session_id and real_session_id != session_id:
                    migration_data = json.dumps({
                        "type": "session_migrated",
                        "session_id": real_session_id,
                        "migrated": False  # Nova sessão, não migração
                    })
                    yield f"data: {migration_data}\n\n"
                
                # Formato SSE
                data = json.dumps(response)
                yield f"data: {data}\n\n"
                
        except Exception as e:
            error_data = json.dumps({
                "type": "error",
                "error": str(e),
                "session_id": real_session_id or "unknown"
            })
            yield f"data: {error_data}\n\n"
        finally:
            # Envia evento de fim com session_id real
            final_data = {
                'type': 'done', 
                'session_id': real_session_id or "unknown"
            }
            yield f"data: {json.dumps(final_data)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-ID": session_id or "pending"
        }
    )

@app.post(
    "/api/interrupt",
    tags=["Sessões"],
    summary="Interromper Sessão",
    description="""Interrompe imediatamente a geração de resposta em andamento para uma sessão específica.
    
    Útil quando o usuário deseja parar uma resposta longa ou cancelar uma operação.
    """,
    response_description="Confirmação de interrupção",
    responses={
        200: {
            "description": "Sessão interrompida com sucesso",
            "content": {
                "application/json": {
                    "example": {"status": "interrupted", "session_id": "uuid"}
                }
            }
        },
        404: {
            "description": "Sessão não encontrada"
        }
    },
    response_model=StatusResponse
)
async def interrupt_session(action: SessionAction) -> StatusResponse:
    """Interrompe a execução de uma sessão ativa."""
    success = await claude_handler.interrupt_session(action.session_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return StatusResponse(status="interrupted", session_id=action.session_id)

@app.post(
    "/api/clear",
    tags=["Sessões"],
    summary="Limpar Contexto",
    description="""Limpa todo o histórico e contexto de uma sessão, mantendo o session_id.
    
    Após limpar, a sessão continua ativa mas sem histórico de mensagens anteriores.
    """,
    response_description="Confirmação de limpeza",
    responses={
        200: {
            "description": "Contexto limpo com sucesso",
            "content": {
                "application/json": {
                    "example": {"status": "cleared", "session_id": "uuid"}
                }
            }
        }
    },
    response_model=StatusResponse
)
async def clear_session(action: SessionAction) -> StatusResponse:
    """Limpa o contexto e histórico de uma sessão."""
    await claude_handler.clear_session(action.session_id)
    return StatusResponse(status="cleared", session_id=action.session_id)


@app.delete(
    "/api/session/{session_id}",
    tags=["Sessões"],
    summary="Deletar Sessão",
    description="""Remove permanentemente uma sessão e todo seu histórico.
    
    Esta ação é irreversível. A sessão e todas as mensagens associadas serão deletadas.
    """,
    response_description="Confirmação de exclusão",
    responses={
        200: {
            "description": "Sessão deletada com sucesso",
            "content": {
                "application/json": {
                    "example": {"status": "deleted", "session_id": "uuid"}
                }
            }
        },
        404: {
            "description": "Sessão não encontrada"
        }
    },
    response_model=StatusResponse
)
async def delete_session(session_id: str = Path(..., description="ID único da sessão a ser deletada")) -> StatusResponse:
    """Remove permanentemente uma sessão."""
    await claude_handler.destroy_session(session_id)
    return StatusResponse(status="deleted", session_id=session_id)

@app.post(
    "/api/session-with-config",
    tags=["Sessões"],
    summary="Criar Sessão com Configuração",
    description="""Cria uma nova sessão com configurações específicas.
    
    Permite definir system prompt, ferramentas permitidas, diretório de trabalho e outras opções.
    """,
    response_description="ID da nova sessão criada",
    responses={
        200: {
            "description": "Sessão criada com configurações",
            "content": {
                "application/json": {
                    "example": {"session_id": "uuid"}
                }
            }
        }
    },
    response_model=SessionResponse
)
async def create_session_with_config(config: SessionConfigRequest) -> SessionResponse:
    """Cria uma sessão com configurações específicas."""
    session_id = str(uuid.uuid4())
    
    session_config = SessionConfig(
        system_prompt=config.system_prompt,
        allowed_tools=config.allowed_tools,
        max_turns=config.max_turns,
        permission_mode=config.permission_mode,
        cwd=config.cwd
    )
    
    await claude_handler.create_session(session_id, session_config)
    return SessionResponse(session_id=session_id)

@app.put(
    "/api/session/{session_id}/config",
    tags=["Sessões"],
    summary="Atualizar Configuração da Sessão",
    description="""Atualiza a configuração de uma sessão existente.
    
    A sessão será recriada com as novas configurações mas o histórico será mantido.
    """,
    response_description="Confirmação de atualização",
    responses={
        200: {
            "description": "Configuração atualizada",
            "content": {
                "application/json": {
                    "example": {"status": "updated", "session_id": "uuid"}
                }
            }
        },
        404: {
            "description": "Sessão não encontrada"
        }
    },
    response_model=StatusResponse
)
async def update_session_config(
    session_id: str = Path(..., description="ID da sessão"),
    config: SessionConfigRequest = ...
) -> StatusResponse:
    """Atualiza configuração de uma sessão."""
    session_config = SessionConfig(
        system_prompt=config.system_prompt,
        allowed_tools=config.allowed_tools,
        max_turns=config.max_turns,
        permission_mode=config.permission_mode,
        cwd=config.cwd
    )
    
    success = await claude_handler.update_session_config(session_id, session_config)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return StatusResponse(status="updated", session_id=session_id)

@app.get(
    "/api/session/{session_id}",
    tags=["Sessões"],
    summary="Obter Informações da Sessão",
    description="""Retorna informações detalhadas sobre uma sessão específica.
    
    Inclui configurações, estatísticas de uso e status.
    """,
    response_description="Informações da sessão",
    responses={
        200: {
            "description": "Informações da sessão",
            "content": {
                "application/json": {
                    "example": {
                        "session_id": "uuid",
                        "active": True,
                        "config": {
                            "system_prompt": "...",
                            "allowed_tools": ["Read", "Write"],
                            "created_at": "2024-01-01T00:00:00"
                        },
                        "history": {
                            "message_count": 10,
                            "total_tokens": 1000,
                            "total_cost": 0.05
                        }
                    }
                }
            }
        },
        404: {
            "description": "Sessão não encontrada"
        }
    },
    response_model=SessionInfoResponse
)
async def get_session_info(session_id: str = Path(..., description="ID da sessão")) -> SessionInfoResponse:
    """Obtém informações detalhadas de uma sessão."""
    info = await claude_handler.get_session_info(session_id)
    
    if "error" in info:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionInfoResponse(**info)

@app.get(
    "/api/sessions",
    tags=["Sessões"],
    summary="Listar Todas as Sessões",
    description="""Retorna lista de todas as sessões ativas com suas informações.
    
    Útil para monitoramento e gerenciamento de múltiplas conversas.
    """,
    response_description="Lista de sessões",
    responses={
        200: {
            "description": "Lista de sessões ativas",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "session_id": "uuid1",
                            "active": True,
                            "config": {"system_prompt": "..."},
                            "history": {"message_count": 5}
                        }
                    ]
                }
            }
        }
    }
)
async def list_sessions() -> List[SessionInfoResponse]:
    """Lista todas as sessões ativas."""
    sessions = await claude_handler.get_all_sessions()
    return [SessionInfoResponse(**session) for session in sessions]

@app.get(
    "/api/current-session-id",
    tags=["Sessões"],
    summary="Obter ID da Sessão Claude Code Atual",
    description="""Retorna o ID da sessão Claude Code ativa atual extraído dos arquivos .jsonl.
    
    Busca em ~/.claude/projects/ pelo arquivo .jsonl mais recente.
    """,
    response_description="ID da sessão atual"
)
async def get_current_claude_session_id():
    """Obtém ID real da sessão Claude Code ativa do projeto cc-sdk-chat."""
    import json
    import glob
    from pathlib import Path
    
    claude_projects = Path.home() / ".claude" / "projects"
    
    if not claude_projects.exists():
        return {"session_id": None, "error": "Diretório ~/.claude/projects/ não encontrado"}
    
    # Busca especificamente no projeto cc-sdk-chat-api
    target_project = None
    for project_dir in claude_projects.iterdir():
        if project_dir.is_dir() and "cc-sdk-chat-api" in project_dir.name:
            target_project = project_dir
            break
    
    if not target_project:
        # Fallback: busca em todos os projetos
        jsonl_files = []
        for project_dir in claude_projects.iterdir():
            if project_dir.is_dir():
                for jsonl_file in project_dir.glob("*.jsonl"):
                    jsonl_files.append(jsonl_file)
    else:
        # Busca apenas no projeto correto
        jsonl_files = list(target_project.glob("*.jsonl"))
    
    if not jsonl_files:
        return {"session_id": None, "error": "Nenhum arquivo .jsonl encontrado"}
    
    # Ordena por modificação mais recente
    jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    latest_file = jsonl_files[0]
    
    try:
        # Lê primeira linha para pegar sessionId
        with open(latest_file, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line:
                data = json.loads(first_line)
                session_id = data.get('sessionId')
                return {
                    "session_id": session_id,
                    "file": str(latest_file),
                    "project": latest_file.parent.name
                }
    except Exception as e:
        return {"session_id": None, "error": str(e)}
    
    return {"session_id": None, "error": "Não foi possível extrair sessionId"}

@app.get(
    "/api/session-history/{session_id}",
    tags=["Sessões"],
    summary="Obter Histórico Real da Sessão Claude",
    description="""Carrega histórico completo de uma sessão do arquivo .jsonl.
    
    Preserva todo o histórico mesmo se a pessoa sair e entrar novamente.
    """,
    response_description="Histórico da sessão"
)
async def get_session_history(session_id: str):
    """Obtém histórico real de uma sessão do arquivo .jsonl."""
    import json
    from pathlib import Path
    
    claude_projects = Path.home() / ".claude" / "projects"
    
    if not claude_projects.exists():
        return {"messages": [], "error": "Diretório ~/.claude/projects/ não encontrado"}
    
    # Busca arquivo com este session_id
    target_file = None
    for project_dir in claude_projects.iterdir():
        if project_dir.is_dir():
            for jsonl_file in project_dir.glob("*.jsonl"):
                if jsonl_file.stem == session_id:
                    target_file = jsonl_file
                    break
            if target_file:
                break
    
    if not target_file:
        return {"messages": [], "error": f"Arquivo de sessão {session_id} não encontrado"}
    
    messages = []
    try:
        with open(target_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        data = json.loads(line)
                        
                        # Extrai mensagem se existir
                        if 'message' in data and 'role' in data['message']:
                            msg = data['message']
                            
                            # Converte para formato do chat
                            chat_message = {
                                "id": data.get('uuid', ''),
                                "role": msg['role'],
                                "content": msg.get('content', ''),
                                "timestamp": data.get('timestamp'),
                                "tokens": None,
                                "cost": None
                            }
                            
                            # Extrai tokens e custo se disponível
                            if 'usage' in msg:
                                usage = msg['usage']
                                chat_message["tokens"] = {
                                    "input": usage.get('input_tokens', 0),
                                    "output": usage.get('output_tokens', 0)
                                }
                            
                            # Detecta ferramentas usadas
                            tools_used = []
                            if 'content' in msg and isinstance(msg['content'], list):
                                for content_block in msg['content']:
                                    if isinstance(content_block, dict) and content_block.get('type') == 'tool_use':
                                        tool_name = content_block.get('name')
                                        if tool_name:
                                            tools_used.append(tool_name)
                            
                            if tools_used:
                                chat_message["tools"] = tools_used
                            
                            messages.append(chat_message)
                            
                    except json.JSONDecodeError:
                        continue
                        
    except Exception as e:
        return {"messages": [], "error": str(e)}
    
    return {
        "messages": messages,
        "session_id": session_id,
        "total_messages": len(messages),
        "file": str(target_file)
    }

@app.get(
    "/api/analytics/global",
    tags=["Analytics"],
    summary="Analytics Globais das Sessões",
    description="""Retorna métricas completas de todas as sessões Claude Code.
    
    Analisa todos os arquivos .jsonl para fornecer:
    - Total de tokens, custo, mensagens
    - Métricas por projeto  
    - Ferramentas mais usadas
    - Rankings de sessões
    """,
    response_description="Analytics completos"
)
async def get_global_analytics():
    """Obtém analytics globais de todas as sessões."""
    try:
        analytics = await analytics_service.get_global_analytics()
        
        return {
            "summary": {
                "total_sessions": analytics.total_sessions,
                "total_messages": analytics.total_messages,
                "total_tokens": analytics.total_tokens,
                "total_cost": analytics.total_cost,
                "active_projects": len(analytics.active_projects)
            },
            "by_project": {
                "sessions": analytics.sessions_by_project,
                "costs": analytics.cost_by_project,
                "tokens": analytics.tokens_by_project
            },
            "top_tools": analytics.most_used_tools,
            "top_sessions": [
                {
                    "id": s.session_id,
                    "project": s.project,
                    "messages": s.total_messages,
                    "tokens": s.total_input_tokens + s.total_output_tokens,
                    "cost": s.total_cost,
                    "duration_hours": s.duration_hours,
                    "tools": s.tools_used
                }
                for s in sorted(analytics.sessions_metrics, key=lambda x: x.total_messages, reverse=True)[:10]
            ]
        }
    except Exception as e:
        return {"error": str(e)}

@app.get(
    "/api/analytics/session/{session_id}",
    tags=["Analytics"],
    summary="Analytics de Sessão Específica",
    description="""Retorna métricas detalhadas de uma sessão específica.""",
    response_description="Analytics da sessão"
)
async def get_session_analytics(session_id: str):
    """Obtém analytics de uma sessão específica."""
    try:
        metrics = await analytics_service.get_session_analytics(session_id)
        
        if not metrics:
            return {"error": "Sessão não encontrada"}
        
        return {
            "session_id": metrics.session_id,
            "project": metrics.project,
            "messages": {
                "total": metrics.total_messages,
                "user": metrics.user_messages,
                "assistant": metrics.assistant_messages
            },
            "tokens": {
                "input": metrics.total_input_tokens,
                "output": metrics.total_output_tokens,
                "total": metrics.total_input_tokens + metrics.total_output_tokens
            },
            "cost": metrics.total_cost,
            "tools_used": metrics.tools_used,
            "timing": {
                "first_message": metrics.first_message_time.isoformat() if metrics.first_message_time else None,
                "last_message": metrics.last_message_time.isoformat() if metrics.last_message_time else None,
                "duration_hours": metrics.duration_hours
            },
            "file_path": metrics.file_path
        }
    except Exception as e:
        return {"error": str(e)}

@app.get(
    "/api/validate-session/{session_id}",
    tags=["Sessões"],
    summary="Validar Sessão",
    description="Valida se uma sessão existe e pode ser usada para redirecionamento",
    response_description="Status de validação da sessão"
)
async def validate_session(session_id: str = Path(..., description="ID da sessão para validar")):
    """Valida se uma sessão existe e é válida para uso."""
    validation = session_validator.validate_session_for_redirect(session_id)
    
    if validation['can_redirect']:
        return {
            "valid": True,
            "session_id": session_id,
            "message": "Sessão válida e existe no sistema"
        }
    else:
        return {
            "valid": False,
            "session_id": session_id,
            "error": validation['error'],
            "details": {
                "exists": validation['exists'],
                "is_temporary": validation['is_temporary'],
                "is_valid_uuid": validation['valid']
            }
        }

@app.get(
    "/api/real-sessions",
    tags=["Sessões"],
    summary="Listar Sessões Reais",
    description="Retorna lista de IDs de sessões que realmente existem no sistema",
    response_description="Lista de sessões reais existentes"
)
async def get_real_sessions():
    """Lista todas as sessões reais que existem no sistema."""
    real_sessions = session_validator.get_real_session_ids()
    return {
        "sessions": list(real_sessions),
        "count": len(real_sessions),
        "message": f"Encontradas {len(real_sessions)} sessões reais no sistema"
    }

@app.get(
    "/api/discover-projects",
    tags=["Projetos"],
    summary="Descobrir Todos os Projetos",
    description="Descobre automaticamente todos os projetos Claude Code disponíveis",
    response_description="Lista de projetos com estatísticas"
)
async def discover_projects():
    """Descobre todos os projetos Claude Code no sistema."""
    import json
    from pathlib import Path
    
    claude_projects = Path.home() / ".claude" / "projects"
    
    if not claude_projects.exists():
        return {"projects": [], "count": 0, "error": "Diretório ~/.claude/projects/ não encontrado"}
    
    projects = []
    
    for project_dir in claude_projects.iterdir():
        if project_dir.is_dir():
            jsonl_files = list(project_dir.glob("*.jsonl"))
            
            if jsonl_files:
                # Calcula estatísticas do projeto
                total_messages = 0
                total_sessions = len(jsonl_files)
                last_activity = None
                
                for jsonl_file in jsonl_files:
                    try:
                        # Lê primeira e última linha para estatísticas básicas
                        with open(jsonl_file, 'r', encoding='utf-8') as f:
                            lines = f.readlines()
                            total_messages += len(lines)
                            
                            # Pega timestamp da última linha
                            if lines:
                                try:
                                    last_line = json.loads(lines[-1])
                                    if 'timestamp' in last_line:
                                        file_time = last_line['timestamp']
                                        if not last_activity or file_time > last_activity:
                                            last_activity = file_time
                                except:
                                    pass
                    except:
                        continue
                
                projects.append({
                    "name": project_dir.name,
                    "path": str(project_dir),
                    "sessions_count": total_sessions,
                    "total_messages": total_messages,
                    "last_activity": last_activity,
                    "url_path": project_dir.name
                })
    
    # Ordena por última atividade
    projects.sort(key=lambda p: p['last_activity'] or '', reverse=True)
    
    return {
        "projects": projects,
        "count": len(projects),
        "message": f"Encontrados {len(projects)} projetos Claude Code"
    }

@app.get(
    "/api/web-sessions",
    tags=["Sessões"],
    summary="Listar Sessões Web",
    description="Lista apenas sessões criadas via SDK Web (não Terminal)",
    response_description="Lista de sessões Web com estatísticas"
)
async def get_web_sessions():
    """Lista apenas sessões criadas via interface Web."""
    import json
    from pathlib import Path
    
    claude_projects = Path.home() / ".claude" / "projects"
    
    if not claude_projects.exists():
        return {"sessions": [], "count": 0, "error": "Diretório ~/.claude/projects/ não encontrado"}
    
    web_sessions = []
    
    for project_dir in claude_projects.iterdir():
        if project_dir.is_dir():
            for jsonl_file in project_dir.glob("*.jsonl"):
                try:
                    with open(jsonl_file, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        
                    if not lines:
                        continue
                        
                    # Verifica se é sessão Web (não Terminal)
                    is_web_session = False
                    total_messages = len(lines)
                    first_message = None
                    last_message = None
                    
                    for line in lines:
                        try:
                            data = json.loads(line)
                            
                            # Detecta origem Web
                            if (data.get('type') == 'summary' or 
                                data.get('userType') != 'external'):
                                is_web_session = True
                            
                            # Pega primeira mensagem
                            if data.get('type') in ['user', 'assistant'] and not first_message:
                                first_message = data.get('timestamp')
                            
                            # Atualiza última mensagem
                            if data.get('timestamp'):
                                last_message = data.get('timestamp')
                                
                        except:
                            continue
                    
                    if is_web_session:
                        session_id = jsonl_file.stem
                        web_sessions.append({
                            "id": session_id,
                            "project": project_dir.name,
                            "total_messages": total_messages,
                            "first_message": first_message,
                            "last_activity": last_message,
                            "url": f"/{project_dir.name}/{session_id}"
                        })
                        
                except Exception as e:
                    continue
    
    # Ordena por última atividade
    web_sessions.sort(key=lambda s: s['last_activity'] or '', reverse=True)
    
    return {
        "sessions": web_sessions,
        "count": len(web_sessions),
        "message": f"Encontradas {len(web_sessions)} sessões Web"
    }

@app.post(
    "/api/load-project-history",
    tags=["Sessões"],
    summary="Carregar Histórico do Projeto",
    description="Carrega histórico completo de todas as sessões do projeto",
    response_description="Histórico unificado do projeto"
)
async def load_project_history(request: dict):
    """Carrega histórico completo do projeto com todas as sessões."""
    try:
        project_path = request.get('projectPath')
        primary_session_id = request.get('primarySessionId')
        
        # Busca todas as sessões reais no projeto
        real_sessions = session_validator.get_real_session_ids()
        sessions_data = []
        
        for session_id in real_sessions:
            try:
                # Usa o endpoint existente para carregar histórico da sessão
                session_history = await get_session_history(session_id)
                
                if 'error' not in session_history and session_history.get('messages'):
                    sessions_data.append({
                        'id': session_id,
                        'messages': session_history['messages'],
                        'origin': 'Claude Code',
                        'createdAt': session_history.get('first_message_time'),
                        'cwd': project_path
                    })
            except Exception as e:
                print(f"⚠️ Erro ao carregar sessão {session_id}: {e}")
                continue
        
        return {
            "sessions": sessions_data,
            "isSingleSession": len(sessions_data) == 1,
            "continuationMode": primary_session_id in real_sessions,
            "projectPath": project_path,
            "totalSessions": len(sessions_data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar histórico: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    import os
    
    # Usa variáveis de ambiente para configuração flexível
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8989"))
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    uvicorn.run(
        app, 
        host=host, 
        port=port, 
        log_level=log_level,
        reload=False,
        access_log=True
    )