"""
Commands - Sistema de comandos contextuais estilo Claude Code.

Implementa comandos slash e contextuais inspirados no CLI oficial:
- /sessions:comando
- /project:comando  
- /config:comando
"""

from .base import CommandRegistry, BaseCommand
from .session_commands import SessionSlashCommands
from .viewer_commands import ViewerSlashCommands

__all__ = [
    'CommandRegistry',
    'BaseCommand',
    'SessionSlashCommands', 
    'ViewerSlashCommands'
]