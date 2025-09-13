#!/usr/bin/env python3
"""
Rotas para gerenciamento de projetos Claude
Lista e gerencia projetos salvos em /.claude/projects
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional
from pathlib import Path
import json
import os
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="/api/analytics", tags=["projects"])

# Diretório dos projetos
PROJECTS_DIR = Path.home() / ".claude" / "projects"

class ProjectInfo(BaseModel):
    """Informações do projeto"""
    name: str
    path: str
    sessions_count: int
    total_messages: int
    last_activity: Optional[datetime]
    total_tokens: int
    created_at: Optional[datetime]

class SessionInfo(BaseModel):
    """Informações da sessão"""
    session_id: str
    messages_count: int
    created_at: datetime
    last_activity: datetime
    tokens_used: int

def scan_project_directory(project_path: Path) -> Dict:
    """Escaneia diretório do projeto e retorna estatísticas"""
    sessions = []
    total_messages = 0
    total_tokens = 0
    last_activity = None
    created_at = None
    
    # Listar arquivos JSONL
    jsonl_files = list(project_path.glob("*.jsonl"))
    
    for jsonl_file in jsonl_files:
        session_id = jsonl_file.stem
        messages_count = 0
        session_tokens = 0
        session_created = None
        session_last = None
        
        try:
            with open(jsonl_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                messages_count = len(lines)
                
                for line in lines:
                    try:
                        data = json.loads(line)
                        
                        # Pegar timestamp
                        if 'timestamp' in data:
                            ts = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
                            if not session_created or ts < session_created:
                                session_created = ts
                            if not session_last or ts > session_last:
                                session_last = ts
                        
                        # Contar tokens
                        if 'message' in data and isinstance(data['message'], dict):
                            if 'usage' in data['message']:
                                usage = data['message']['usage']
                                session_tokens += usage.get('input_tokens', 0)
                                session_tokens += usage.get('output_tokens', 0)
                    except:
                        continue
                
                total_messages += messages_count
                total_tokens += session_tokens
                
                # Atualizar timestamps globais
                if session_created and (not created_at or session_created < created_at):
                    created_at = session_created
                if session_last and (not last_activity or session_last > last_activity):
                    last_activity = session_last
                
                sessions.append({
                    'session_id': session_id,
                    'messages_count': messages_count,
                    'created_at': session_created or datetime.now(),
                    'last_activity': session_last or datetime.now(),
                    'tokens_used': session_tokens
                })
        except Exception as e:
            print(f"Erro ao ler {jsonl_file}: {e}")
            continue
    
    return {
        'sessions': sessions,
        'sessions_count': len(sessions),
        'total_messages': total_messages,
        'total_tokens': total_tokens,
        'last_activity': last_activity,
        'created_at': created_at
    }

@router.get("/projects")
async def get_projects():
    """
    Lista todos os projetos disponíveis
    Endpoint usado pelo frontend para mostrar projetos na home
    """
    if not PROJECTS_DIR.exists():
        return {"projects": []}
    
    projects = []
    
    # Listar subdiretórios
    for project_dir in PROJECTS_DIR.iterdir():
        if project_dir.is_dir():
            # Escanear projeto
            stats = scan_project_directory(project_dir)
            
            # Incluir todos os projetos, mesmo vazios
            projects.append({
                    'name': project_dir.name,
                    'path': str(project_dir),
                    'url_path': project_dir.name,  # Adicionar campo url_path esperado pelo frontend
                    'sessions_count': stats['sessions_count'],
                    'total_messages': stats['total_messages'],
                    'total_tokens': stats['total_tokens'],
                    'last_activity': stats['last_activity'].isoformat() if stats['last_activity'] else None,
                    'created_at': stats['created_at'].isoformat() if stats['created_at'] else None
                })
    
    # Ordenar por última atividade
    projects.sort(
        key=lambda x: x['last_activity'] if x['last_activity'] else '',
        reverse=True
    )
    
    return {"projects": projects}

@router.get("/projects/{project_name}/sessions")
async def get_project_sessions(project_name: str):
    """
    Lista todas as sessões de um projeto específico
    """
    project_path = PROJECTS_DIR / project_name
    print(f"DEBUG: Procurando projeto em: {project_path}")
    print(f"DEBUG: Projeto existe? {project_path.exists()}")

    if not project_path.exists():
        print(f"DEBUG: Projeto não encontrado: {project_name}")
        # Retornar vazio ao invés de 404 para projetos recém-criados
        return {
            "project_name": project_name,
            "sessions": [],
            "total": 0
        }

    stats = scan_project_directory(project_path)

    # Ordenar sessões por última atividade
    sessions = sorted(
        stats['sessions'],
        key=lambda x: x['last_activity'],
        reverse=True
    ) if stats['sessions'] else []

    return {
        "project_name": project_name,
        "sessions": sessions,
        "total": len(sessions)
    }

@router.get("/projects/{project_name}/sessions/{session_id}")
async def get_session_history(project_name: str, session_id: str):
    """
    Retorna histórico completo de uma sessão
    """
    session_file = PROJECTS_DIR / project_name / f"{session_id}.jsonl"
    
    if not session_file.exists():
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    messages = []
    
    try:
        with open(session_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    
                    # Extrair mensagem
                    if 'message' in data:
                        msg = data['message']
                        
                        # Formatar mensagem
                        formatted_msg = {
                            'role': msg.get('role', data.get('type', 'unknown')),
                            'content': '',
                            'timestamp': data.get('timestamp'),
                            'uuid': data.get('uuid')
                        }
                        
                        # Extrair conteúdo
                        if isinstance(msg, dict):
                            if 'content' in msg:
                                if isinstance(msg['content'], str):
                                    formatted_msg['content'] = msg['content']
                                elif isinstance(msg['content'], list):
                                    # Claude response format
                                    content_parts = []
                                    for part in msg['content']:
                                        if isinstance(part, dict) and 'text' in part:
                                            content_parts.append(part['text'])
                                    formatted_msg['content'] = '\n'.join(content_parts)
                            
                            # Adicionar métricas se disponível
                            if 'usage' in msg:
                                formatted_msg['usage'] = msg['usage']
                        
                        messages.append(formatted_msg)
                        
                except Exception as e:
                    print(f"Erro ao processar linha: {e}")
                    continue
                    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler sessão: {e}")
    
    return {
        "project_name": project_name,
        "session_id": session_id,
        "messages": messages,
        "total": len(messages)
    }

@router.get("/projects/{project_name}/stats")
async def get_project_stats(project_name: str):
    """
    Retorna estatísticas detalhadas de um projeto
    """
    project_path = PROJECTS_DIR / project_name
    
    if not project_path.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    stats = scan_project_directory(project_path)
    
    # Calcular estatísticas adicionais
    avg_messages_per_session = (
        stats['total_messages'] / stats['sessions_count']
        if stats['sessions_count'] > 0 else 0
    )
    
    avg_tokens_per_session = (
        stats['total_tokens'] / stats['sessions_count']
        if stats['sessions_count'] > 0 else 0
    )
    
    # Calcular custo estimado (baseado no Claude Opus)
    # $15 per million input tokens, $75 per million output tokens
    # Estimativa: 70% input, 30% output
    input_tokens_est = stats['total_tokens'] * 0.7
    output_tokens_est = stats['total_tokens'] * 0.3
    cost_estimate = (input_tokens_est * 15 / 1_000_000) + (output_tokens_est * 75 / 1_000_000)
    
    return {
        "project_name": project_name,
        "sessions_count": stats['sessions_count'],
        "total_messages": stats['total_messages'],
        "total_tokens": stats['total_tokens'],
        "avg_messages_per_session": round(avg_messages_per_session, 2),
        "avg_tokens_per_session": round(avg_tokens_per_session, 2),
        "estimated_cost_usd": round(cost_estimate, 4),
        "created_at": stats['created_at'].isoformat() if stats['created_at'] else None,
        "last_activity": stats['last_activity'].isoformat() if stats['last_activity'] else None,
        "sessions": stats['sessions']
    }

@router.delete("/projects/{project_name}/sessions/{session_id}")
async def delete_session(project_name: str, session_id: str):
    """
    Remove uma sessão específica
    """
    session_file = PROJECTS_DIR / project_name / f"{session_id}.jsonl"
    
    if not session_file.exists():
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    try:
        os.remove(session_file)
        return {"status": "success", "message": f"Sessão {session_id} removida"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover sessão: {e}")

# Health check
@router.get("/health")
async def projects_health():
    """
    Verifica saúde do sistema de projetos
    """
    try:
        projects_count = len(list(PROJECTS_DIR.iterdir())) if PROJECTS_DIR.exists() else 0
        
        total_sessions = 0
        for project_dir in PROJECTS_DIR.iterdir():
            if project_dir.is_dir():
                total_sessions += len(list(project_dir.glob("*.jsonl")))
        
        return {
            "status": "healthy",
            "projects_directory": str(PROJECTS_DIR),
            "projects_count": projects_count,
            "total_sessions": total_sessions
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }