"""
Global Settings Manager - Configurações globais estilo Claude Code CLI.

Gerencia configurações em ~/.claude/settings.json seguindo padrões oficiais.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict


@dataclass 
class GlobalSettings:
    """Configurações globais do usuário."""
    language: str = "pt-br"
    api_endpoint: str = "http://localhost:8992"
    frontend_endpoint: str = "http://localhost:3082"
    auto_save_sessions: bool = True
    max_sessions_history: int = 100
    default_system_prompt: str = ""
    viewer_mode: str = "tui"  # tui, web, cli
    

class GlobalSettingsManager:
    """Gerenciador de configurações globais inspirado no CLI."""
    
    def __init__(self, claude_dir: Optional[str] = None):
        self.claude_dir = Path(claude_dir or os.path.expanduser("~/.claude"))
        self.settings_file = self.claude_dir / "settings.json" 
        self.claude_md_file = self.claude_dir / "CLAUDE.md"
        
        # Garante que diretório existe
        self.claude_dir.mkdir(exist_ok=True)
    
    def load_settings(self) -> GlobalSettings:
        """Carrega configurações globais."""
        if self.settings_file.exists():
            try:
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return GlobalSettings(**data)
            except Exception:
                pass
        
        # Retorna configurações padrão
        return GlobalSettings()
    
    def save_settings(self, settings: GlobalSettings):
        """Salva configurações globais."""
        with open(self.settings_file, 'w', encoding='utf-8') as f:
            json.dump(asdict(settings), f, indent=2, ensure_ascii=False)
    
    def load_global_claude_md(self) -> Optional[str]:
        """Carrega CLAUDE.md global."""
        if self.claude_md_file.exists():
            return self.claude_md_file.read_text(encoding='utf-8')
        return None
    
    def save_global_claude_md(self, content: str):
        """Salva CLAUDE.md global."""
        self.claude_md_file.write_text(content, encoding='utf-8')
    
    def get_projects_dir(self) -> Path:
        """Retorna diretório de projetos descobertos."""
        projects_dir = self.claude_dir / "projects"
        projects_dir.mkdir(exist_ok=True)
        return projects_dir
    
    def get_commands_dir(self) -> Path:
        """Retorna diretório de comandos globais."""
        commands_dir = self.claude_dir / "commands"
        commands_dir.mkdir(exist_ok=True) 
        return commands_dir
    
    def register_project(self, project_name: str, project_path: str):
        """Registra projeto descoberto."""
        projects_file = self.claude_dir / "projects.json"
        
        projects = {}
        if projects_file.exists():
            try:
                with open(projects_file, 'r', encoding='utf-8') as f:
                    projects = json.load(f)
            except Exception:
                pass
        
        projects[project_name] = {
            "path": project_path,
            "discovered_at": str(Path(project_path).stat().st_mtime),
            "active": True
        }
        
        with open(projects_file, 'w', encoding='utf-8') as f:
            json.dump(projects, f, indent=2, ensure_ascii=False)
    
    def get_registered_projects(self) -> Dict[str, Dict]:
        """Obtém projetos registrados."""
        projects_file = self.claude_dir / "projects.json"
        
        if projects_file.exists():
            try:
                with open(projects_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        
        return {}
    
    def setup_initial_config(self):
        """Configura ambiente inicial do usuário."""
        settings = self.load_settings()
        
        # Salva configurações padrão se não existir
        if not self.settings_file.exists():
            self.save_settings(settings)
        
        # Cria CLAUDE.md padrão se não existir
        if not self.claude_md_file.exists():
            default_claude_md = """# Configurações Globais Claude Code

## Configurações Padrão
- Responder sempre em português brasileiro
- Backend na porta 8992
- Frontend na porta 3082
- Focar em consolidação, não criar coisas novas
- Não criar arquivos na raiz sem autorização

## Instruções para IA
Sempre seguir as diretrizes do projeto e manter organização.
"""
            self.save_global_claude_md(default_claude_md)
        
        # Cria diretórios necessários
        self.get_projects_dir()
        self.get_commands_dir()
        
        return settings