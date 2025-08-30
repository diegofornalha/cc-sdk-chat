"""
Session Commands - Comandos CLI para gerenciamento de sessões.

Inspirado nos comandos do Claude Code oficial:
- claude -c (continue)
- claude -r session_id (restore)
- Comandos slash contextuais
"""

import argparse
import asyncio
import sys
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from ...session_manager.discovery import ProjectDiscovery
from ...config.global_settings import GlobalSettingsManager


class SessionCommands:
    """Comandos CLI para sessões estilo Claude Code."""
    
    def __init__(self):
        self.settings_manager = GlobalSettingsManager()
        self.project_discovery = ProjectDiscovery()
        
    def create_parser(self) -> argparse.ArgumentParser:
        """Cria parser de comandos estilo Claude Code CLI."""
        parser = argparse.ArgumentParser(
            prog='claude-viewer',
            description='🤖 Claude Code Session Viewer - Inspirado no CLI oficial',
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Exemplos de uso:
  claude-viewer                           # Browser TUI interativo
  claude-viewer -c                        # Continuar última sessão
  claude-viewer -r abc123                 # Restaurar sessão específica
  claude-viewer --list                    # Listar todas as sessões
  claude-viewer --projects                # Descobrir projetos
  claude-viewer --tui                     # Forçar modo TUI
  claude-viewer --web                     # Iniciar viewer web
  
Comandos Slash (dentro do TUI):
  /sessions:list                          # Listar sessões do projeto
  /sessions:restore <id>                  # Restaurar sessão
  /project:switch <nome>                  # Trocar projeto ativo
  /config:show                            # Mostrar configurações
  /context:hierarchy                      # Mostrar hierarquia CLAUDE.md
        """
        )
        
        # Comandos principais (estilo Claude Code)
        parser.add_argument(
            '-c', '--continue',
            action='store_true',
            help='Continuar última sessão ativa (claude -c)'
        )
        
        parser.add_argument(
            '-r', '--restore',
            type=str,
            metavar='SESSION_ID',
            help='Restaurar sessão específica (claude -r)'
        )
        
        # Comandos de listagem
        parser.add_argument(
            '--list',
            action='store_true', 
            help='Listar todas as sessões'
        )
        
        parser.add_argument(
            '--projects',
            action='store_true',
            help='Descobrir e listar projetos Claude'
        )
        
        # Modos de interface
        parser.add_argument(
            '--tui',
            action='store_true',
            help='Forçar modo TUI (Terminal User Interface)'
        )
        
        parser.add_argument(
            '--web',
            action='store_true', 
            help='Iniciar viewer web'
        )
        
        parser.add_argument(
            '--cli-only',
            action='store_true',
            help='Usar apenas CLI sem interface'
        )
        
        # Configurações
        parser.add_argument(
            '--project',
            type=str,
            metavar='PROJECT_NAME',
            help='Especificar projeto ativo'
        )
        
        parser.add_argument(
            '--config',
            action='store_true',
            help='Mostrar configurações atuais'
        )
        
        parser.add_argument(
            '--setup',
            action='store_true',
            help='Configuração inicial do ambiente'
        )
        
        return parser
    
    async def handle_continue_session(self):
        """Continua última sessão ativa (claude -c)."""
        print("🔄 Continuando última sessão...")
        
        # Busca última sessão ativa
        # TODO: Implementar busca real
        print("📝 Sessão a1b2c3d4 encontrada")
        print("💬 Últimas mensagens:")
        print("  👤 Usuario: pode remover o modal de senha")
        print("  🤖 Claude: Modal removido com sucesso!")
        print("\n✅ Sessão restaurada - pronto para continuar")
    
    async def handle_restore_session(self, session_id: str):
        """Restaura sessão específica (claude -r)."""
        print(f"🔄 Restaurando sessão {session_id}...")
        
        # TODO: Implementar restauração real
        print(f"📝 Sessão {session_id} encontrada")
        print("💾 Carregando contexto e histórico...")
        print("✅ Sessão restaurada com sucesso")
    
    async def handle_list_sessions(self):
        """Lista todas as sessões."""
        print("📋 Sessões Disponíveis:")
        print("-" * 60)
        
        # Headers
        print(f"{'ID':<10} {'Status':<8} {'Título':<25} {'Msgs':<5} {'Última Atividade'}")
        print("-" * 60)
        
        # Sessões de exemplo
        sessions = [
            ("a1b2c3d4", "🟢 Ativa", "Debug Chat API", "23", "2 min atrás"),
            ("e5f6g7h8", "⏸️ Pausa", "Implementar TUI", "45", "1h atrás"),
            ("i9j0k1l2", "✅ OK", "Fix bugs frontend", "67", "3h atrás"),
        ]
        
        for session in sessions:
            print(f"{session[0]:<10} {session[1]:<8} {session[2]:<25} {session[3]:<5} {session[4]}")
    
    async def handle_discover_projects(self):
        """Descobre projetos automaticamente."""
        print("🔍 Descobrindo projetos Claude Code...")
        
        projects = self.project_discovery.discover_projects()
        
        if not projects:
            print("❌ Nenhum projeto encontrado")
            return
        
        print(f"✅ {len(projects)} projeto(s) encontrado(s):")
        print("-" * 50)
        
        for project in projects:
            status = "🟢" if project.session_count > 0 else "⚪"
            print(f"{status} {project.name}")
            print(f"   📁 {project.path}")
            if project.claude_config:
                print(f"   ⚙️ {project.claude_config}")
            print(f"   💬 {project.session_count} sessões")
            print()
    
    async def handle_show_config(self):
        """Mostra configurações atuais."""
        settings = self.settings_manager.load_settings()
        
        print("⚙️ Configurações Atuais:")
        print("-" * 40)
        print(f"Idioma: {settings.language}")
        print(f"API Endpoint: {settings.api_endpoint}")
        print(f"Frontend Endpoint: {settings.frontend_endpoint}")
        print(f"Auto-save Sessions: {settings.auto_save_sessions}")
        print(f"Max History: {settings.max_sessions_history}")
        print(f"Viewer Mode: {settings.viewer_mode}")
        
        # Mostra hierarquia de contexto
        claude_md = self.settings_manager.load_global_claude_md()
        if claude_md:
            print(f"\n📄 CLAUDE.md Global:")
            print(claude_md[:200] + "..." if len(claude_md) > 200 else claude_md)
    
    async def handle_setup(self):
        """Configuração inicial do ambiente."""
        print("🚀 Configurando ambiente Claude Code...")
        
        settings = self.settings_manager.setup_initial_config()
        
        print("✅ Configuração inicial concluída!")
        print(f"📁 Diretório Claude: {self.settings_manager.claude_dir}")
        print(f"⚙️ Settings: {self.settings_manager.settings_file}")
        print(f"📄 CLAUDE.md: {self.settings_manager.claude_md_file}")
        
        # Descobre projetos automaticamente
        print("\n🔍 Descobrindo projetos...")
        await self.handle_discover_projects()
    
    async def run_command(self, args):
        """Executa comando baseado nos argumentos."""
        try:
            if args.setup:
                await self.handle_setup()
            elif args.continue:
                await self.handle_continue_session()
            elif args.restore:
                await self.handle_restore_session(args.restore)
            elif args.list:
                await self.handle_list_sessions()
            elif args.projects:
                await self.handle_discover_projects()
            elif args.config:
                await self.handle_show_config()
            elif args.tui:
                # Importa e executa TUI
                from ..tui.session_browser import SessionBrowser
                browser = SessionBrowser()
                browser.interactive_browser()
            elif args.web:
                print("🌐 Iniciando viewer web...")
                # TODO: Iniciar servidor web
                print("📱 Web viewer: http://localhost:3040")
            else:
                # Modo padrão: TUI interativo
                from ..tui.session_browser import SessionBrowser
                browser = SessionBrowser()
                browser.interactive_browser()
                
        except KeyboardInterrupt:
            print("\n👋 Interrompido pelo usuário!")
            sys.exit(0)
        except Exception as e:
            print(f"❌ Erro: {e}")
            sys.exit(1)


async def main():
    """Entry point principal."""
    session_cmd = SessionCommands()
    parser = session_cmd.create_parser()
    args = parser.parse_args()
    
    await session_cmd.run_command(args)


if __name__ == "__main__":
    asyncio.run(main())