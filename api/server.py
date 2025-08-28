"""Servidor FastAPI para integração com Claude Code SDK."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from fastapi import Path
from typing import Optional, Dict, Any
import asyncio
import json
import uuid

from claude_handler import ClaudeHandler

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
            "url": "http://localhost:8002",
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
    allow_origins=["http://localhost:3020", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Handler global
claude_handler = ClaudeHandler()

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
    
    # Gera session_id se não fornecido
    session_id = chat_message.session_id or str(uuid.uuid4())
    
    async def generate():
        """Gera stream SSE."""
        try:
            async for response in claude_handler.send_message(
                session_id, 
                chat_message.message
            ):
                # Formato SSE
                data = json.dumps(response)
                yield f"data: {data}\n\n"
                
        except Exception as e:
            error_data = json.dumps({
                "type": "error",
                "error": str(e),
                "session_id": session_id
            })
            yield f"data: {error_data}\n\n"
        finally:
            # Envia evento de fim
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-ID": session_id
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

@app.post(
    "/api/new-session",
    tags=["Sessões"],
    summary="Criar Nova Sessão",
    description="""Cria uma nova sessão de chat com ID único.
    
    Cada sessão mantém seu próprio contexto e histórico de conversas.
    Use o session_id retornado nas próximas chamadas para manter o contexto.
    """,
    response_description="ID da nova sessão criada",
    responses={
        200: {
            "description": "Sessão criada com sucesso",
            "content": {
                "application/json": {
                    "example": {"session_id": "550e8400-e29b-41d4-a716-446655440000"}
                }
            }
        }
    },
    response_model=SessionResponse
)
async def create_new_session() -> SessionResponse:
    """Cria uma nova sessão com ID único."""
    session_id = str(uuid.uuid4())
    await claude_handler.create_session(session_id)
    return SessionResponse(session_id=session_id)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002, reload=False)