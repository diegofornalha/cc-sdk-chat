#!/usr/bin/env python3
"""
Claude Viewer - Interface principal inspirada no CLI Claude Code.

Entry point unificado para todas as funcionalidades:
- TUI rico para navegação de sessões
- CLI commands estilo Claude Code
- Discovery automático de projetos
- Sistema de configuração hierárquico

Uso:
    python claude_viewer.py              # TUI interativo
    python claude_viewer.py -c           # Continuar última sessão
    python claude_viewer.py -r abc123    # Restaurar sessão específica
    python claude_viewer.py --projects   # Descobrir projetos
"""

import asyncio
import sys
from pathlib import Path

# Adiciona diretório atual ao path
sys.path.insert(0, str(Path(__file__).parent))

from viewers.cli.session_commands import SessionCommands


async def main():
    """Entry point principal do Claude Viewer."""
    print("🤖 Claude Code Session Viewer")
    print("📱 Inspirado no CLI oficial da Anthropic")
    print("=" * 50)
    
    # Executa comandos CLI
    session_cmd = SessionCommands()
    parser = session_cmd.create_parser()
    args = parser.parse_args()
    
    await session_cmd.run_command(args)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Até logo!")
        sys.exit(0)