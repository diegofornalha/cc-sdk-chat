"""
Session Manager - Gerenciamento avançado de sessões Claude Code.

Inspirado no sistema de sessões do CLI oficial:
- discovery.py: Auto-descoberta de projetos
- storage.py: Persistência de sessões
- context.py: Hierarquia de contexto CLAUDE.md
- session.py: Operações de sessão
"""

from .discovery import ProjectDiscovery
from .storage import SessionStorage
from .context import ContextHierarchy
from .session import SessionManager

__all__ = [
    'ProjectDiscovery',
    'SessionStorage', 
    'ContextHierarchy',
    'SessionManager'
]