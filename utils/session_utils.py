"""
Session Utils - Utilitários para extrair IDs de sessão reais.

Extrai IDs corretos dos arquivos .jsonl em ~/.claude/projects/
"""

import json
import os
from pathlib import Path
from typing import Optional, Dict, List
import glob


class SessionUtils:
    """Utilitários para trabalhar com sessões Claude Code reais."""
    
    @staticmethod
    def get_current_session_id() -> Optional[str]:
        """
        Extrai ID da sessão ativa atual do arquivo .jsonl.
        
        Returns:
            ID da sessão no formato: 70fcbdbd-4e34-4770-be69-d85c76ba7c8b
        """
        claude_projects = Path.home() / ".claude" / "projects"
        
        if not claude_projects.exists():
            return None
        
        # Busca arquivos .jsonl mais recentes
        jsonl_files = []
        for project_dir in claude_projects.iterdir():
            if project_dir.is_dir():
                for jsonl_file in project_dir.glob("*.jsonl"):
                    jsonl_files.append(jsonl_file)
        
        if not jsonl_files:
            return None
        
        # Ordena por modificação mais recente
        jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        latest_file = jsonl_files[0]
        
        try:
            # Lê primeira linha para pegar sessionId
            with open(latest_file, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                if first_line:
                    data = json.loads(first_line)
                    return data.get('sessionId')
        except Exception:
            pass
        
        return None
    
    @staticmethod
    def get_session_from_file(file_path: str) -> Optional[str]:
        """
        Extrai sessionId de um arquivo .jsonl específico.
        
        Args:
            file_path: Caminho para arquivo .jsonl
            
        Returns:
            ID da sessão ou None se não encontrado
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                if first_line:
                    data = json.loads(first_line)
                    return data.get('sessionId')
        except Exception:
            pass
        
        return None
    
    @staticmethod
    def list_all_sessions() -> List[Dict[str, str]]:
        """
        Lista todas as sessões disponíveis.
        
        Returns:
            Lista de dicts com info das sessões
        """
        claude_projects = Path.home() / ".claude" / "projects"
        sessions = []
        
        if not claude_projects.exists():
            return sessions
        
        for project_dir in claude_projects.iterdir():
            if project_dir.is_dir():
                for jsonl_file in project_dir.glob("*.jsonl"):
                    session_id = SessionUtils.get_session_from_file(str(jsonl_file))
                    if session_id:
                        sessions.append({
                            'id': session_id,
                            'file': str(jsonl_file),
                            'project': project_dir.name,
                            'modified': jsonl_file.stat().st_mtime
                        })
        
        # Ordena por modificação mais recente
        sessions.sort(key=lambda s: s['modified'], reverse=True)
        return sessions
    
    @staticmethod
    def get_session_stats(session_id: str) -> Optional[Dict]:
        """
        Obtém estatísticas de uma sessão específica.
        
        Args:
            session_id: ID da sessão
            
        Returns:
            Dict com estatísticas ou None
        """
        claude_projects = Path.home() / ".claude" / "projects"
        
        if not claude_projects.exists():
            return None
        
        # Busca arquivo com este session_id
        for project_dir in claude_projects.iterdir():
            if project_dir.is_dir():
                for jsonl_file in project_dir.glob("*.jsonl"):
                    if jsonl_file.stem == session_id:
                        return SessionUtils._analyze_jsonl_file(str(jsonl_file))
        
        return None
    
    @staticmethod 
    def _analyze_jsonl_file(file_path: str) -> Dict:
        """Analisa arquivo .jsonl para extrair estatísticas."""
        stats = {
            'message_count': 0,
            'user_messages': 0,
            'assistant_messages': 0,
            'total_input_tokens': 0,
            'total_output_tokens': 0,
            'total_cost': 0.0,
            'tools_used': set(),
            'first_message': None,
            'last_message': None
        }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if line.strip():
                        try:
                            data = json.loads(line)
                            
                            # Primeira e última mensagem
                            if line_num == 1:
                                stats['first_message'] = data.get('timestamp')
                            stats['last_message'] = data.get('timestamp')
                            
                            # Conta mensagens por tipo
                            if 'message' in data:
                                msg = data['message']
                                role = msg.get('role')
                                
                                if role == 'user':
                                    stats['user_messages'] += 1
                                elif role == 'assistant':
                                    stats['assistant_messages'] += 1
                                
                                stats['message_count'] += 1
                                
                                # Conta tokens se disponível
                                if 'usage' in msg:
                                    usage = msg['usage']
                                    stats['total_input_tokens'] += usage.get('input_tokens', 0)
                                    stats['total_output_tokens'] += usage.get('output_tokens', 0)
                                
                                # Detecta ferramentas usadas
                                if 'content' in msg and isinstance(msg['content'], list):
                                    for content_block in msg['content']:
                                        if isinstance(content_block, dict) and content_block.get('type') == 'tool_use':
                                            tool_name = content_block.get('name')
                                            if tool_name:
                                                stats['tools_used'].add(tool_name)
                                                
                        except json.JSONDecodeError:
                            continue
                            
        except Exception:
            pass
        
        # Converte set para list para serialização
        stats['tools_used'] = list(stats['tools_used'])
        return stats