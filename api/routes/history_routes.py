"""
Rotas da API para gerenciamento de histórico de conversação
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
import json
import os
from pathlib import Path

# Importar o SDK estendido
import sys
sys.path.append('/Users/2a/.claude/cc-sdk-chat/api/sdk')
from claude_code_sdk import ExtendedClaudeClient

router = APIRouter(
    prefix="/api/history",
    tags=["history"],
    responses={404: {"description": "Not found"}},
)

# Diretório para armazenar históricos
HISTORY_DIR = Path("/Users/2a/.claude/cc-sdk-chat/conversation_histories")
HISTORY_DIR.mkdir(exist_ok=True)

# Cache de clientes por sessão
client_cache: Dict[str, ExtendedClaudeClient] = {}


# Modelos Pydantic
class ConversationMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class ConversationSummary(BaseModel):
    session_id: str
    message_count: int
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    topics: List[str]
    total_tokens: int
    total_cost: float


class HistoryQuery(BaseModel):
    session_id: str
    limit: int = 50
    offset: int = 0
    include_metadata: bool = False


class ContextUpdate(BaseModel):
    session_id: str
    key: str
    value: Any


# Funções auxiliares
def get_or_create_client(session_id: str) -> ExtendedClaudeClient:
    """Obtém ou cria um cliente para a sessão"""
    if session_id not in client_cache:
        client_cache[session_id] = ExtendedClaudeClient()
        
        # Tentar carregar histórico existente
        history_file = HISTORY_DIR / f"{session_id}.json"
        if history_file.exists():
            with open(history_file, 'r') as f:
                data = json.load(f)
                # Restaurar histórico
                for msg in data.get('messages', []):
                    client_cache[session_id].memory.add_message(
                        msg['role'],
                        msg['content'],
                        msg.get('metadata')
                    )
                # Restaurar contexto
                if 'context' in data:
                    client_cache[session_id].memory.context = data['context']
    
    return client_cache[session_id]


def save_session_history(session_id: str):
    """Salva o histórico da sessão em arquivo"""
    if session_id in client_cache:
        client = client_cache[session_id]
        history_file = HISTORY_DIR / f"{session_id}.json"
        
        data = {
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "messages": client.get_conversation_history(1000),
            "context": client.memory.context,
            "metrics": client.get_metrics()
        }
        
        with open(history_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)


# Rotas da API

@router.get("/sessions", response_model=List[str])
async def list_sessions():
    """Lista todas as sessões disponíveis"""
    sessions = []
    
    # Sessões ativas na memória
    sessions.extend(client_cache.keys())
    
    # Sessões salvas em arquivo
    for file in HISTORY_DIR.glob("*.json"):
        session_id = file.stem
        if session_id not in sessions:
            sessions.append(session_id)
    
    return sorted(sessions)


@router.get("/session/{session_id}", response_model=List[ConversationMessage])
async def get_session_history(
    session_id: str,
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    include_metadata: bool = Query(False)
):
    """Obtém o histórico de uma sessão específica"""
    client = get_or_create_client(session_id)
    history = client.get_conversation_history(limit + offset)
    
    # Aplicar offset e limit
    history = history[offset:offset + limit]
    
    # Formatar resposta
    messages = []
    for msg in history:
        message = ConversationMessage(
            role=msg['role'],
            content=msg['content'],
            timestamp=msg.get('timestamp')
        )
        if include_metadata:
            message.metadata = msg.get('metadata', {})
        messages.append(message)
    
    return messages


@router.get("/session/{session_id}/summary", response_model=ConversationSummary)
async def get_session_summary(session_id: str):
    """Obtém um resumo da sessão"""
    client = get_or_create_client(session_id)
    history = client.get_conversation_history(1000)
    metrics = client.get_metrics()
    
    # Extrair tópicos (análise simples)
    topics = set()
    keywords = ["API", "FastAPI", "Python", "Docker", "AWS", "database", "cache", "auth"]
    
    for msg in history:
        content = msg['content'].lower()
        for keyword in keywords:
            if keyword.lower() in content:
                topics.add(keyword)
    
    # Determinar tempos
    start_time = None
    end_time = None
    if history:
        if history[0].get('timestamp'):
            start_time = history[0]['timestamp']
        if history[-1].get('timestamp'):
            end_time = history[-1]['timestamp']
    
    return ConversationSummary(
        session_id=session_id,
        message_count=len(history),
        start_time=start_time,
        end_time=end_time,
        topics=list(topics),
        total_tokens=metrics.get('total_tokens', 0),
        total_cost=metrics.get('total_cost_usd', 0.0)
    )


@router.get("/session/{session_id}/context")
async def get_session_context(session_id: str):
    """Obtém o contexto armazenado da sessão"""
    client = get_or_create_client(session_id)
    return client.memory.context


@router.post("/session/{session_id}/context")
async def update_session_context(session_id: str, update: ContextUpdate):
    """Atualiza o contexto da sessão"""
    client = get_or_create_client(session_id)
    client.memory.set_context(update.key, update.value)
    
    # Salvar automaticamente
    save_session_history(session_id)
    
    return {"status": "success", "message": f"Context '{update.key}' updated"}


@router.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Limpa o histórico de uma sessão"""
    # Remover da memória
    if session_id in client_cache:
        client_cache[session_id].clear_memory()
        del client_cache[session_id]
    
    # Remover arquivo
    history_file = HISTORY_DIR / f"{session_id}.json"
    if history_file.exists():
        history_file.unlink()
    
    return {"status": "success", "message": f"Session '{session_id}' cleared"}


@router.get("/metrics/global")
async def get_global_metrics():
    """Obtém métricas globais de todas as sessões"""
    total_messages = 0
    total_tokens = 0
    total_cost = 0.0
    total_sessions = len(await list_sessions())
    
    for session_id in client_cache:
        client = client_cache[session_id]
        metrics = client.get_metrics()
        history = client.get_conversation_history(1000)
        
        total_messages += len(history)
        total_tokens += metrics.get('total_tokens', 0)
        total_cost += metrics.get('total_cost_usd', 0.0)
    
    return {
        "total_sessions": total_sessions,
        "active_sessions": len(client_cache),
        "total_messages": total_messages,
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost,
        "average_messages_per_session": total_messages / total_sessions if total_sessions > 0 else 0
    }


@router.post("/session/{session_id}/save")
async def save_session(session_id: str):
    """Salva o histórico da sessão em arquivo"""
    if session_id not in client_cache:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    
    save_session_history(session_id)
    return {"status": "success", "message": f"Session '{session_id}' saved"}


@router.post("/session/{session_id}/load")
async def load_session(session_id: str):
    """Carrega o histórico de uma sessão do arquivo"""
    history_file = HISTORY_DIR / f"{session_id}.json"
    
    if not history_file.exists():
        raise HTTPException(status_code=404, detail=f"No saved history for session '{session_id}'")
    
    # Forçar recarregamento
    if session_id in client_cache:
        del client_cache[session_id]
    
    client = get_or_create_client(session_id)
    
    return {
        "status": "success",
        "message": f"Session '{session_id}' loaded",
        "message_count": len(client.get_conversation_history(1000))
    }


@router.get("/search")
async def search_conversations(
    query: str = Query(..., description="Texto para buscar"),
    session_id: Optional[str] = Query(None, description="Filtrar por sessão"),
    limit: int = Query(10, ge=1, le=100)
):
    """Busca em todas as conversações"""
    results = []
    sessions_to_search = [session_id] if session_id else await list_sessions()
    
    for sid in sessions_to_search:
        client = get_or_create_client(sid)
        history = client.get_conversation_history(1000)
        
        for msg in history:
            if query.lower() in msg['content'].lower():
                results.append({
                    "session_id": sid,
                    "role": msg['role'],
                    "content": msg['content'][:200] + "..." if len(msg['content']) > 200 else msg['content'],
                    "timestamp": msg.get('timestamp')
                })
                
                if len(results) >= limit:
                    break
        
        if len(results) >= limit:
            break
    
    return results


@router.get("/analytics/topics")
async def analyze_topics():
    """Analisa os tópicos mais discutidos em todas as sessões"""
    topic_counts = {}
    keywords = [
        "API", "FastAPI", "Python", "Docker", "AWS", "database", 
        "PostgreSQL", "MongoDB", "Redis", "cache", "authentication",
        "JWT", "OAuth", "security", "deployment", "testing", "CI/CD"
    ]
    
    for session_id in await list_sessions():
        client = get_or_create_client(session_id)
        history = client.get_conversation_history(1000)
        
        for msg in history:
            content = msg['content'].lower()
            for keyword in keywords:
                if keyword.lower() in content:
                    topic_counts[keyword] = topic_counts.get(keyword, 0) + 1
    
    # Ordenar por frequência
    sorted_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "topics": [{"topic": topic, "count": count} for topic, count in sorted_topics],
        "total_topics": len(sorted_topics)
    }


@router.get("/analytics/usage-timeline")
async def get_usage_timeline(days: int = Query(7, ge=1, le=30)):
    """Obtém linha do tempo de uso nos últimos dias"""
    now = datetime.now()
    timeline = {}
    
    # Inicializar dias
    for i in range(days):
        date = (now - timedelta(days=i)).date().isoformat()
        timeline[date] = {"messages": 0, "sessions": set()}
    
    # Processar históricos
    for session_id in await list_sessions():
        client = get_or_create_client(session_id)
        history = client.get_conversation_history(1000)
        
        for msg in history:
            if msg.get('timestamp'):
                try:
                    msg_date = datetime.fromisoformat(str(msg['timestamp'])).date().isoformat()
                    if msg_date in timeline:
                        timeline[msg_date]["messages"] += 1
                        timeline[msg_date]["sessions"].add(session_id)
                except:
                    continue
    
    # Converter sets para contagem
    for date in timeline:
        timeline[date]["unique_sessions"] = len(timeline[date]["sessions"])
        del timeline[date]["sessions"]
    
    return timeline