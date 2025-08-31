"""
Utils - Utilitários para integração com Claude Code.

Inclui funções para extrair IDs de sessão reais dos arquivos .jsonl
em ~/.claude/projects/
"""

from .session_utils import SessionUtils

__all__ = ['SessionUtils']