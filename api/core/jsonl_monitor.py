"""
Monitor de JSONL - Monitora mudanças em arquivos JSONL e envia para o frontend.
SOLUÇÃO SIMPLES: Lê qualquer arquivo JSONL modificado e retorna as mensagens.
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, Optional

class JSONLMonitor:
    """Monitor simples de arquivos JSONL."""
    
    def __init__(self):
        self.claude_projects = Path.home() / ".claude" / "projects"
        self.last_check = {}
        
    async def get_latest_messages(self, project_name: str, session_id: str = None) -> list:
        """
        Pega as mensagens mais recentes de QUALQUER arquivo JSONL do projeto.
        Ignora o session_id e pega o arquivo mais recente modificado.
        """
        project_path = self.claude_projects / project_name
        
        if not project_path.exists():
            return []
        
        # Pega TODOS os arquivos JSONL do projeto
        jsonl_files = list(project_path.glob("*.jsonl"))
        
        if not jsonl_files:
            return []
        
        # Ordena por data de modificação (mais recente primeiro)
        jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        
        messages = []
        
        # Lê o arquivo mais recente
        latest_file = jsonl_files[0]
        
        try:
            with open(latest_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        # Converte para formato esperado pelo frontend
                        if data.get('type') == 'assistant' and data.get('message'):
                            msg = data['message']
                            if 'content' in msg and isinstance(msg['content'], list):
                                for content in msg['content']:
                                    if content.get('type') == 'text':
                                        messages.append({
                                            'role': 'assistant',
                                            'content': content.get('text', ''),
                                            'timestamp': data.get('timestamp')
                                        })
                        elif data.get('type') == 'user' and data.get('message'):
                            msg = data['message']
                            if isinstance(msg, dict) and msg.get('role') == 'user':
                                messages.append({
                                    'role': 'user',
                                    'content': msg.get('content', ''),
                                    'timestamp': data.get('timestamp')
                                })
        except Exception as e:
            print(f"Erro ao ler arquivo JSONL: {e}")
        
        return messages
    
    async def stream_updates(self, project_name: str, session_id: str = None) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream de atualizações - monitora mudanças e envia novas mensagens.
        """
        project_path = self.claude_projects / project_name
        last_size = 0
        last_messages = []
        
        while True:
            try:
                # Pega o arquivo mais recente
                jsonl_files = list(project_path.glob("*.jsonl"))
                if jsonl_files:
                    jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
                    latest_file = jsonl_files[0]
                    
                    # Verifica se mudou
                    current_size = latest_file.stat().st_size
                    if current_size != last_size:
                        # Lê novas mensagens
                        messages = await self.get_latest_messages(project_name, session_id)
                        
                        # Envia apenas mensagens novas
                        if len(messages) > len(last_messages):
                            for msg in messages[len(last_messages):]:
                                if msg['role'] == 'assistant':
                                    # Divide em chunks para simular streaming
                                    content = msg['content']
                                    words = content.split()
                                    
                                    for i in range(0, len(words), 3):
                                        chunk = ' '.join(words[i:i+3])
                                        if chunk:
                                            yield {
                                                "type": "text_chunk",
                                                "content": chunk + " ",
                                                "session_id": session_id or "monitor"
                                            }
                                            await asyncio.sleep(0.05)
                        
                        last_size = current_size
                        last_messages = messages
                
            except Exception as e:
                print(f"Erro no monitor: {e}")
            
            # Verifica a cada 100ms
            await asyncio.sleep(0.1)

# Instância global
jsonl_monitor = JSONLMonitor()