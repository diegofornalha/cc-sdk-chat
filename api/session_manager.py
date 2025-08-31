"""
Session Manager - Gerenciamento avançado de sessões Claude Code.

Cria novas sessões no Claude Code SDK e retorna IDs reais.
"""

import subprocess
import asyncio
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any


class ClaudeCodeSessionManager:
    """Gerenciador de sessões Claude Code SDK."""
    
    def __init__(self):
        self.claude_projects = Path.home() / ".claude" / "projects"
        
    async def create_new_claude_session(self) -> Optional[str]:
        """
        Cria nova sessão no Claude Code SDK e retorna ID real.
        
        Simula uma interação para forçar criação de nova sessão.
        """
        try:
            # Executa comando Claude Code para criar nova sessão
            # Isso forçará a criação de um novo arquivo .jsonl
            process = await asyncio.create_subprocess_exec(
                'claude', 'olá',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd='/home/suthub/.claude/api-claude-code-app/cc-sdk-chat'
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                # Aguarda arquivo ser criado
                await asyncio.sleep(1)
                
                # Busca o arquivo .jsonl mais recente
                return await self.get_latest_session_id()
            else:
                print(f"Erro ao criar sessão Claude: {stderr.decode()}")
                return None
                
        except Exception as e:
            print(f"Erro na criação de sessão: {e}")
            return None
    
    async def get_latest_session_id(self) -> Optional[str]:
        """Obtém ID da sessão mais recente."""
        if not self.claude_projects.exists():
            return None
        
        # Busca arquivos .jsonl mais recentes
        jsonl_files = []
        for project_dir in self.claude_projects.iterdir():
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
    
    async def trigger_session_creation(self) -> Optional[str]:
        """
        Dispara criação de nova sessão via comando direto.
        
        Método alternativo que executa comando Claude diretamente.
        """
        try:
            # Comando simples para criar sessão
            cmd = [
                'python', '-m', 'src', 
                '--no-header',
                'Olá! Nova sessão criada.'
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd='/home/suthub/.claude/api-claude-code-app/claude-code-sdk-python'
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                # Aguarda sessão ser registrada
                await asyncio.sleep(2)
                return await self.get_latest_session_id()
            else:
                print(f"Erro ao criar sessão via SDK: {stderr.decode()}")
                return None
                
        except Exception as e:
            print(f"Erro no trigger de sessão: {e}")
            return None
    
    def get_project_name_for_session(self, session_id: str) -> Optional[str]:
        """Obtém nome do projeto para uma sessão específica."""
        if not self.claude_projects.exists():
            return None
        
        # Busca em qual projeto está a sessão
        for project_dir in self.claude_projects.iterdir():
            if project_dir.is_dir():
                session_file = project_dir / f"{session_id}.jsonl"
                if session_file.exists():
                    return project_dir.name
        
        return None