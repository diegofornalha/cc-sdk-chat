"""
Rotas para streaming em tempo real.
SOLUÇÃO: Monitora o arquivo JSONL mais recente e retorna atualizações.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pathlib import Path
import json
import asyncio
import time
from typing import AsyncGenerator

router = APIRouter(prefix="/api/realtime", tags=["Realtime"])

async def monitor_latest_jsonl(project_name: str) -> AsyncGenerator[str, None]:
    """
    Monitora o arquivo JSONL mais recente do projeto e retorna mudanças.
    """
    claude_projects = Path.home() / ".claude" / "projects" / project_name
    
    if not claude_projects.exists():
        yield f"data: {json.dumps({'type': 'error', 'content': 'Projeto não encontrado'})}\n\n"
        return
    
    last_size = 0
    last_file = None
    last_content = []
    
    while True:
        try:
            # Pega todos os arquivos JSONL
            jsonl_files = list(claude_projects.glob("*.jsonl"))
            
            if not jsonl_files:
                await asyncio.sleep(0.5)
                continue
            
            # Ordena por data de modificação (mais recente primeiro)
            jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            latest_file = jsonl_files[0]
            
            # Se mudou de arquivo ou cresceu
            current_size = latest_file.stat().st_size
            
            if latest_file != last_file or current_size > last_size:
                # Lê o arquivo
                with open(latest_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                # Se tem conteúdo novo
                if len(lines) > len(last_content):
                    # Processa apenas linhas novas
                    for line in lines[len(last_content):]:
                        if line.strip():
                            try:
                                data = json.loads(line)
                                
                                # Se é mensagem do assistant
                                if data.get('type') == 'assistant' and data.get('message'):
                                    msg = data['message']
                                    if 'content' in msg and isinstance(msg['content'], list):
                                        for content in msg['content']:
                                            if content.get('type') == 'text':
                                                text = content.get('text', '')
                                                
                                                # Envia o texto direto, sem abstrações
                                                if text:
                                                    yield f"data: {json.dumps({'type': 'text_chunk', 'content': text, 'session_id': 'realtime'})}\n\n"
                                                    await asyncio.sleep(0.01)
                                
                            except json.JSONDecodeError:
                                pass
                
                last_content = lines
                last_size = current_size
                last_file = latest_file
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        
        await asyncio.sleep(0.2)  # Verifica a cada 200ms

@router.get("/stream/{project_name}")
async def stream_realtime(project_name: str):
    """
    Stream em tempo real das mensagens do projeto.
    Monitora o arquivo JSONL mais recente automaticamente.
    """
    return StreamingResponse(
        monitor_latest_jsonl(project_name),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/latest/{project_name}")
async def get_latest_messages(project_name: str, limit: int = 10):
    """
    Retorna as últimas mensagens do arquivo JSONL mais recente.
    """
    claude_projects = Path.home() / ".claude" / "projects" / project_name
    
    if not claude_projects.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    # Pega o arquivo mais recente
    jsonl_files = list(claude_projects.glob("*.jsonl"))
    
    if not jsonl_files:
        return {"messages": []}
    
    jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    latest_file = jsonl_files[0]
    
    messages = []
    
    try:
        with open(latest_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        for line in lines[-limit:]:  # Pega as últimas N linhas
            if line.strip():
                try:
                    data = json.loads(line)
                    
                    if data.get('type') == 'user' and data.get('message'):
                        msg = data['message']
                        if isinstance(msg, dict) and msg.get('role') == 'user':
                            messages.append({
                                'role': 'user',
                                'content': msg.get('content', ''),
                                'timestamp': data.get('timestamp')
                            })
                    
                    elif data.get('type') == 'assistant' and data.get('message'):
                        msg = data['message']
                        if 'content' in msg and isinstance(msg['content'], list):
                            # Pega apenas o texto, ignora ferramentas
                            text_content = ''
                            for content in msg['content']:
                                if content.get('type') == 'text':
                                    text_content += content.get('text', '')
                            
                            if text_content:
                                messages.append({
                                    'role': 'assistant',
                                    'content': text_content,
                                    'timestamp': data.get('timestamp')
                                })
                    
                except json.JSONDecodeError:
                    pass
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {
        "messages": messages,
        "file": latest_file.name,
        "total": len(messages)
    }