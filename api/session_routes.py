#!/usr/bin/env python3
"""
Rotas de gerenciamento de sessões
Centraliza toda lógica de sessões no backend
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional, Dict, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import uuid
import jwt
import json
import redis
from pathlib import Path

# Configurações
SECRET_KEY = "sua-chave-secreta-aqui"  # Em produção, use variável de ambiente
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

# Cache de sessões em memória (em produção, use Redis)
sessions_cache: Dict[str, dict] = {}
user_sessions: Dict[str, List[str]] = {}  # user_id -> [session_ids]

# Models
class SessionCreate(BaseModel):
    """Modelo para criar nova sessão"""
    user_id: Optional[str] = Field(None, description="ID do usuário")
    project_path: Optional[str] = Field(None, description="Caminho do projeto")
    metadata: Optional[dict] = Field(default_factory=dict)

class SessionResponse(BaseModel):
    """Resposta de sessão"""
    session_id: str
    token: str
    created_at: datetime
    expires_at: datetime
    metadata: dict

class SessionHistory(BaseModel):
    """Histórico da sessão"""
    session_id: str
    messages: List[dict]
    total_tokens: int
    total_cost: float
    created_at: datetime
    last_activity: datetime

class SessionMetrics(BaseModel):
    """Métricas da sessão"""
    session_id: str
    total_messages: int
    total_tokens_input: int
    total_tokens_output: int
    total_cost_usd: float
    average_response_time: float
    cache_hit_rate: float

# Funções auxiliares
def create_token(data: dict) -> str:
    """Cria JWT token"""
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    data.update({"exp": expire})
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> dict:
    """Verifica e decodifica JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

def get_current_session(authorization: Optional[str] = Header(None)) -> dict:
    """Dependência para obter sessão atual do token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não fornecido")
    
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    
    session_id = payload.get("session_id")
    if not session_id or session_id not in sessions_cache:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    return sessions_cache[session_id]

# Rotas
@router.post("/create", response_model=SessionResponse)
async def create_session(data: SessionCreate):
    """
    Cria nova sessão com UUID único
    Retorna token JWT para autenticação
    """
    # Gerar UUID único
    session_id = str(uuid.uuid4())
    
    # Criar token JWT
    token_data = {
        "session_id": session_id,
        "user_id": data.user_id or "anonymous",
        "created_at": datetime.utcnow().isoformat()
    }
    token = create_token(token_data)
    
    # Salvar sessão no cache
    session_data = {
        "session_id": session_id,
        "user_id": data.user_id or "anonymous",
        "project_path": data.project_path,
        "created_at": datetime.utcnow(),
        "last_activity": datetime.utcnow(),
        "messages": [],
        "metrics": {
            "total_tokens_input": 0,
            "total_tokens_output": 0,
            "total_cost_usd": 0.0,
            "message_count": 0
        },
        "metadata": data.metadata
    }
    
    sessions_cache[session_id] = session_data
    
    # Associar ao usuário
    user_id = data.user_id or "anonymous"
    if user_id not in user_sessions:
        user_sessions[user_id] = []
    user_sessions[user_id].append(session_id)
    
    return SessionResponse(
        session_id=session_id,
        token=token,
        created_at=session_data["created_at"],
        expires_at=datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
        metadata=data.metadata
    )

@router.get("/{session_id}/history", response_model=SessionHistory)
async def get_session_history(
    session_id: str,
    current_session: dict = Depends(get_current_session)
):
    """
    Retorna histórico completo da sessão
    Requer autenticação via token
    """
    if session_id != current_session["session_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    session = sessions_cache.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    metrics = session["metrics"]
    
    return SessionHistory(
        session_id=session_id,
        messages=session["messages"],
        total_tokens=metrics["total_tokens_input"] + metrics["total_tokens_output"],
        total_cost=metrics["total_cost_usd"],
        created_at=session["created_at"],
        last_activity=session["last_activity"]
    )

@router.get("/{session_id}/metrics", response_model=SessionMetrics)
async def get_session_metrics(
    session_id: str,
    current_session: dict = Depends(get_current_session)
):
    """
    Retorna métricas agregadas da sessão
    Cálculos feitos no servidor
    """
    if session_id != current_session["session_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    session = sessions_cache.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    metrics = session["metrics"]
    
    # Calcular métricas adicionais
    avg_response_time = 0.0
    cache_hit_rate = 0.0
    
    if "response_times" in session:
        response_times = session["response_times"]
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
    
    if "cache_stats" in session:
        cache_stats = session["cache_stats"]
        total_requests = cache_stats.get("total", 0)
        cache_hits = cache_stats.get("hits", 0)
        if total_requests > 0:
            cache_hit_rate = cache_hits / total_requests
    
    return SessionMetrics(
        session_id=session_id,
        total_messages=metrics["message_count"],
        total_tokens_input=metrics["total_tokens_input"],
        total_tokens_output=metrics["total_tokens_output"],
        total_cost_usd=metrics["total_cost_usd"],
        average_response_time=avg_response_time,
        cache_hit_rate=cache_hit_rate
    )

@router.post("/{session_id}/update-metrics")
async def update_session_metrics(
    session_id: str,
    tokens_input: int,
    tokens_output: int,
    cost_usd: float,
    response_time: Optional[float] = None,
    cache_hit: Optional[bool] = None,
    current_session: dict = Depends(get_current_session)
):
    """
    Atualiza métricas da sessão
    Chamado internamente pela API após cada mensagem
    """
    if session_id != current_session["session_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    session = sessions_cache.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Atualizar métricas
    metrics = session["metrics"]
    metrics["total_tokens_input"] += tokens_input
    metrics["total_tokens_output"] += tokens_output
    metrics["total_cost_usd"] += cost_usd
    metrics["message_count"] += 1
    
    # Atualizar tempo de resposta
    if response_time is not None:
        if "response_times" not in session:
            session["response_times"] = []
        session["response_times"].append(response_time)
    
    # Atualizar cache stats
    if cache_hit is not None:
        if "cache_stats" not in session:
            session["cache_stats"] = {"total": 0, "hits": 0}
        session["cache_stats"]["total"] += 1
        if cache_hit:
            session["cache_stats"]["hits"] += 1
    
    # Atualizar última atividade
    session["last_activity"] = datetime.utcnow()
    
    return {"status": "success", "metrics": metrics}

@router.get("/user/{user_id}/sessions")
async def get_user_sessions(user_id: str):
    """
    Lista todas as sessões de um usuário
    """
    session_ids = user_sessions.get(user_id, [])
    
    sessions = []
    for sid in session_ids:
        if sid in sessions_cache:
            session = sessions_cache[sid]
            sessions.append({
                "session_id": sid,
                "created_at": session["created_at"],
                "last_activity": session["last_activity"],
                "message_count": session["metrics"]["message_count"],
                "project_path": session.get("project_path")
            })
    
    return {
        "user_id": user_id,
        "total_sessions": len(sessions),
        "sessions": sorted(sessions, key=lambda x: x["last_activity"], reverse=True)
    }

@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_session: dict = Depends(get_current_session)
):
    """
    Remove sessão do cache
    """
    if session_id != current_session["session_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    if session_id in sessions_cache:
        session = sessions_cache[session_id]
        user_id = session.get("user_id", "anonymous")
        
        # Remover da lista do usuário
        if user_id in user_sessions:
            user_sessions[user_id] = [
                sid for sid in user_sessions[user_id] if sid != session_id
            ]
        
        # Remover do cache
        del sessions_cache[session_id]
        
        return {"status": "success", "message": "Sessão removida"}
    
    raise HTTPException(status_code=404, detail="Sessão não encontrada")

@router.post("/validate")
async def validate_session(authorization: Optional[str] = Header(None)):
    """
    Valida se token/sessão ainda é válido
    """
    try:
        session = get_current_session(authorization)
        return {
            "valid": True,
            "session_id": session["session_id"],
            "user_id": session.get("user_id"),
            "last_activity": session["last_activity"]
        }
    except HTTPException:
        return {"valid": False}