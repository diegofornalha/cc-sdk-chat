"""
Project Discovery - Auto-descoberta de projetos Claude Code.

Implementa funcionalidade similar ao Claude Code UI para encontrar
automaticamente projetos e sessões em ~/.claude/projects/
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class ProjectInfo:
    """Informações de um projeto descoberto."""
    name: str
    path: str
    claude_config: Optional[str] = None
    last_session: Optional[str] = None
    session_count: int = 0


class ProjectDiscovery:
    """Descoberta automática de projetos Claude Code."""
    
    def __init__(self, claude_dir: Optional[str] = None):
        self.claude_dir = Path(claude_dir or os.path.expanduser("~/.claude"))
        self.projects_dir = self.claude_dir / "projects"
        
    def discover_projects(self) -> List[ProjectInfo]:
        """Descobre projetos automaticamente similar ao Claude Code UI."""
        projects = []
        
        # Busca em ~/.claude/projects/
        if self.projects_dir.exists():
            for project_path in self.projects_dir.iterdir():
                if project_path.is_dir():
                    project_info = self._analyze_project(project_path)
                    if project_info:
                        projects.append(project_info)
        
        # Busca projetos com .claude/ na máquina
        projects.extend(self._find_claude_projects())
        
        return sorted(projects, key=lambda p: p.name)
    
    def _analyze_project(self, project_path: Path) -> Optional[ProjectInfo]:
        """Analisa um diretório de projeto."""
        try:
            # Verifica se tem configuração Claude
            claude_config = None
            if (project_path / "CLAUDE.md").exists():
                claude_config = str(project_path / "CLAUDE.md")
            elif (project_path / ".claude").exists():
                claude_config = str(project_path / ".claude")
            
            # Conta sessões existentes
            session_count = self._count_sessions(project_path)
            
            return ProjectInfo(
                name=project_path.name,
                path=str(project_path),
                claude_config=claude_config,
                session_count=session_count
            )
        except Exception:
            return None
    
    def _find_claude_projects(self) -> List[ProjectInfo]:
        """Encontra projetos com .claude/ no sistema."""
        projects = []
        
        # Busca comum em diretórios de desenvolvimento
        search_paths = [
            Path.home() / "projects",
            Path.home() / "dev", 
            Path.home() / "code",
            Path.home() / "workspace"
        ]
        
        for search_path in search_paths:
            if search_path.exists():
                projects.extend(self._scan_for_claude_dirs(search_path))
                
        return projects
    
    def _scan_for_claude_dirs(self, base_path: Path, max_depth: int = 3) -> List[ProjectInfo]:
        """Escaneia diretórios procurando por .claude/"""
        projects = []
        
        try:
            for item in base_path.iterdir():
                if item.is_dir() and not item.name.startswith('.'):
                    # Verifica se tem .claude/
                    if (item / ".claude").exists():
                        project_info = self._analyze_project(item)
                        if project_info:
                            projects.append(project_info)
                    
                    # Recursão limitada
                    elif max_depth > 0:
                        projects.extend(self._scan_for_claude_dirs(item, max_depth - 1))
        except PermissionError:
            pass
            
        return projects
    
    def _count_sessions(self, project_path: Path) -> int:
        """Conta sessões de um projeto."""
        session_count = 0
        
        # Busca por arquivos de sessão
        for pattern in ["*.session", "*.claude_session", "session_*.json"]:
            session_count += len(list(project_path.glob(f"**/{pattern}")))
            
        return session_count
    
    def get_project_context(self, project_path: str) -> Dict:
        """Obtém contexto hierárquico de um projeto."""
        context = {
            "global": self._load_global_context(),
            "project": self._load_project_context(project_path),
            "local": self._load_local_context(project_path)
        }
        return context
    
    def _load_global_context(self) -> Dict:
        """Carrega contexto global ~/.claude/CLAUDE.md"""
        global_claude = self.claude_dir / "CLAUDE.md"
        if global_claude.exists():
            return {"claude_md": global_claude.read_text()}
        return {}
    
    def _load_project_context(self, project_path: str) -> Dict:
        """Carrega contexto do projeto CLAUDE.md"""
        project_claude = Path(project_path) / "CLAUDE.md"
        if project_claude.exists():
            return {"claude_md": project_claude.read_text()}
        return {}
    
    def _load_local_context(self, project_path: str) -> Dict:
        """Carrega contexto local CLAUDE.local.md"""
        local_claude = Path(project_path) / "CLAUDE.local.md"
        if local_claude.exists():
            return {"claude_md": local_claude.read_text()}
        return {}