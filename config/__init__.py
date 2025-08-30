"""
Config - Sistema de configuração hierárquico inspirado no CLI Claude Code.

Implementa hierarquia: Global → Projeto → Local
Similar ao sistema ~/.claude/ do CLI oficial.
"""

from .global_settings import GlobalSettingsManager
from .project_settings import ProjectSettingsManager
from .user_commands import UserCommandsManager

__all__ = [
    'GlobalSettingsManager',
    'ProjectSettingsManager', 
    'UserCommandsManager'
]