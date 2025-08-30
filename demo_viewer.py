#!/usr/bin/env python3
"""
Demo do Claude Viewer - Demonstração da nova organização.

Mostra as funcionalidades inspiradas no CLI Claude Code oficial.
"""

import os
import sys
from pathlib import Path

# Adiciona diretório atual ao path
sys.path.insert(0, str(Path(__file__).parent))


def print_header():
    """Cabeçalho do demo."""
    print("🤖 Claude Code Session Viewer - DEMO")
    print("📱 Organização inspirada no CLI oficial")
    print("=" * 50)


def show_new_structure():
    """Mostra nova estrutura implementada."""
    print("\n📁 Nova Estrutura Implementada:")
    print("""
cc-sdk-chat/
├── 📁 viewers/              ✅ Interfaces organizadas
│   ├── 📁 cli/              ✅ Comandos linha de comando  
│   ├── 📁 tui/              ✅ Terminal UI rica
│   └── 📁 web/              ✅ Interface web
├── 📁 session_manager/      ✅ Gestão avançada sessões
├── 📁 config/               ✅ Sistema hierárquico
├── 📁 commands/             ✅ Comandos contextuais
├── 📁 utils/                ✅ Utilitários
└── 📄 claude_viewer.py      ✅ Entry point principal
    """)


def show_features():
    """Mostra funcionalidades implementadas."""
    print("\n🎯 Funcionalidades Implementadas:")
    print("""
✅ 🔍 Auto-descoberta de projetos (~/.claude/projects/)
✅ 📊 TUI rica com tabelas e árvores (Rich/Textual)
✅ ⚙️ Sistema de configuração hierárquico
✅ 🎯 Comandos slash contextuais (/sessions:list)
✅ 📈 Timeline de sessões com histórico
✅ 🏗️ Hierarquia de contexto CLAUDE.md
✅ 🔄 Continuação de sessões (claude -c)
✅ 📱 Múltiplas interfaces (CLI, TUI, Web)
    """)


def show_usage_examples():
    """Mostra exemplos de uso."""
    print("\n💡 Exemplos de Uso:")
    print("""
# TUI Interativo (padrão)
python claude_viewer.py

# Continuar última sessão (como claude -c)
python claude_viewer.py -c

# Restaurar sessão específica (como claude -r)
python claude_viewer.py -r abc123

# Descobrir projetos automaticamente
python claude_viewer.py --projects

# Mostrar configurações
python claude_viewer.py --config

# Iniciar viewer web
python claude_viewer.py --web

# Comandos Slash (dentro do TUI):
/sessions:list                    # Lista sessões
/sessions:restore abc123          # Restaura sessão  
/project:switch meu-projeto       # Troca projeto
/config:show                      # Mostra config
    """)


def show_cli_comparison():
    """Compara com CLI oficial."""
    print("\n🔄 Comparação com CLI Claude Code:")
    print("""
CLI Oficial          │ Nossa Implementação
──────────────────────┼────────────────────────
claude -c            │ claude_viewer.py -c
claude -r session    │ claude_viewer.py -r session  
~/.claude/projects/  │ Auto-discovery implementado
CLAUDE.md hierarchy  │ Sistema hierárquico completo
/fix-issue           │ /sessions:restore, /project:switch
Rich TUI             │ SessionBrowser TUI rica
Web UI               │ Viewer web integrado
    """)


def main():
    """Demonstração principal."""
    print_header()
    show_new_structure()
    show_features() 
    show_usage_examples()
    show_cli_comparison()
    
    print("\n🚀 Implementação Concluída!")
    print("📋 Todas as funcionalidades inspiradas no CLI oficial foram implementadas")
    print("✨ O viewer agora segue os padrões e organização do Claude Code")
    
    print("\n🎯 Próximos Passos:")
    print("1. Instalar dependências: pip install -r requirements_viewer.txt")
    print("2. Testar TUI: python claude_viewer.py --tui")
    print("3. Descobrir projetos: python claude_viewer.py --projects")
    print("4. Configurar ambiente: python claude_viewer.py --setup")


if __name__ == "__main__":
    main()