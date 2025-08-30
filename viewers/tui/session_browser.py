"""
Session Browser TUI - Interface rica para navegação de sessões.

Inspirado no viewer de sessões do Claude Code CLI oficial.
"""

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.layout import Layout
from rich.text import Text
from rich.tree import Tree
from rich.live import Live
from datetime import datetime
from typing import List, Dict, Optional
import json


class SessionBrowser:
    """Browser TUI para sessões Claude Code."""
    
    def __init__(self):
        self.console = Console()
        self.sessions = []
        self.current_project = None
        
    def show_sessions_dashboard(self):
        """Exibe dashboard principal de sessões."""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="footer", size=3)
        )
        
        layout["main"].split_row(
            Layout(name="projects", ratio=1),
            Layout(name="sessions", ratio=2),
            Layout(name="details", ratio=1)
        )
        
        # Header
        header = Panel(
            Text("🤖 Claude Code - Session Browser", justify="center", style="bold blue"),
            subtitle="Inspirado no CLI oficial"
        )
        layout["header"].update(header)
        
        # Projects tree
        projects_tree = self._create_projects_tree()
        layout["projects"].update(Panel(projects_tree, title="📁 Projetos"))
        
        # Sessions table  
        sessions_table = self._create_sessions_table()
        layout["sessions"].update(Panel(sessions_table, title="💬 Sessões"))
        
        # Details panel
        details = self._create_details_panel()
        layout["details"].update(Panel(details, title="ℹ️ Detalhes"))
        
        # Footer
        footer = Panel(
            Text("⌨️ [q]uit | [r]efresh | [n]ew session | [Enter] open session", 
                 justify="center", style="dim")
        )
        layout["footer"].update(footer)
        
        self.console.print(layout)
    
    def _create_projects_tree(self) -> Tree:
        """Cria árvore de projetos similar ao Claude Code."""
        tree = Tree("🏠 Claude Projects")
        
        # Projetos descobertos automaticamente
        projects = [
            {"name": "cc-sdk-chat", "sessions": 12, "active": True},
            {"name": "api-claude-code", "sessions": 8, "active": False},
            {"name": "claude-viewer", "sessions": 5, "active": False}
        ]
        
        for project in projects:
            node_text = f"{'🟢' if project['active'] else '⚪'} {project['name']}"
            node_text += f" ({project['sessions']} sessões)"
            
            project_node = tree.add(node_text)
            
            # Subdiretórios com contexto
            if project['active']:
                project_node.add("📄 CLAUDE.md")
                project_node.add("⚙️ .claude/settings.json")
                project_node.add("📁 .claude/commands/")
        
        return tree
    
    def _create_sessions_table(self) -> Table:
        """Cria tabela de sessões estilo Claude Code."""
        table = Table(show_header=True, header_style="bold magenta")
        
        table.add_column("ID", style="dim", width=8)
        table.add_column("Status", justify="center", width=8)
        table.add_column("Título", style="cyan", min_width=20)
        table.add_column("Msgs", justify="right", width=6)
        table.add_column("Última Atividade", style="green", width=15)
        table.add_column("Custo", justify="right", width=8)
        
        # Sessões de exemplo
        sessions = [
            ("a1b2c3d4", "🟢 Ativa", "Debug do Chat API", "23", "2 min atrás", "$0.12"),
            ("e5f6g7h8", "⏸️ Pausada", "Implementar TUI", "45", "1h atrás", "$0.34"),
            ("i9j0k1l2", "✅ Completa", "Fix bugs frontend", "67", "3h atrás", "$0.89"),
            ("m3n4o5p6", "🔄 Sync", "Reorganizar projeto", "12", "5h atrás", "$0.05"),
        ]
        
        for session in sessions:
            table.add_row(*session)
            
        return table
    
    def _create_details_panel(self) -> Text:
        """Cria painel de detalhes da sessão selecionada."""
        details = Text()
        details.append("📊 Sessão Selecionada\n\n", style="bold")
        details.append("ID: ", style="bold")
        details.append("a1b2c3d4\n", style="cyan")
        details.append("Título: ", style="bold") 
        details.append("Debug do Chat API\n", style="green")
        details.append("Mensagens: ", style="bold")
        details.append("23\n")
        details.append("Tokens: ", style="bold")
        details.append("2.1k entrada, 1.8k saída\n")
        details.append("Custo Total: ", style="bold")
        details.append("$0.12\n", style="yellow")
        details.append("\nÚltimas mensagens:\n", style="bold")
        details.append("• Implementar modal de senha\n", style="dim")
        details.append("• Corrigir porta do servidor\n", style="dim")
        details.append("• Verificar funcionamento API\n", style="dim")
        
        return details
    
    def show_session_timeline(self, session_id: str):
        """Exibe timeline de uma sessão específica."""
        panel = Panel.fit(
            Text(f"📈 Timeline da Sessão {session_id}", justify="center"),
            style="bold blue"
        )
        self.console.print(panel)
        
        # Timeline de mensagens
        timeline_table = Table(show_header=True, header_style="bold cyan")
        timeline_table.add_column("Tempo", style="green", width=12)
        timeline_table.add_column("Tipo", width=10)
        timeline_table.add_column("Conteúdo", min_width=40)
        timeline_table.add_column("Tokens", justify="right", width=8)
        
        messages = [
            ("14:32:15", "👤 User", "pode remover o modal de senha da tela inicial", "85"),
            ("14:32:20", "🤖 Claude", "Vou verificar o código do frontend para localizar...", "342"),
            ("14:35:42", "🔧 Tool", "Edit: chat/app/page.tsx", "0"),
            ("14:35:45", "🤖 Claude", "Modal de senha removido com sucesso!", "23"),
        ]
        
        for msg in messages:
            timeline_table.add_row(*msg)
            
        self.console.print(timeline_table)
    
    def show_project_context(self, project_path: str):
        """Exibe contexto hierárquico do projeto."""
        self.console.print(Panel.fit("📋 Contexto Hierárquico", style="bold yellow"))
        
        context_tree = Tree("🏗️ Hierarquia de Contexto")
        
        # Global context
        global_node = context_tree.add("🌍 Global (~/.claude/CLAUDE.md)")
        global_node.add("responda sempre em pt br")
        global_node.add("backend sempre 8990, frontend sempre 3040")
        
        # Project context  
        project_node = context_tree.add("📁 Projeto (CLAUDE.md)")
        project_node.add("aqui é focado para API funcional e Debug")
        project_node.add("o principal é o nosso chat")
        
        # Local context
        local_node = context_tree.add("🏠 Local (.claude/)")
        local_node.add("configurações locais")
        local_node.add("comandos personalizados")
        
        self.console.print(context_tree)
    
    def interactive_browser(self):
        """Browser interativo no estilo Claude Code CLI."""
        try:
            while True:
                self.show_sessions_dashboard()
                
                self.console.print("\n📝 Comandos disponíveis:")
                self.console.print("  [bold]r[/bold] - Refresh")
                self.console.print("  [bold]n[/bold] - Nova sessão") 
                self.console.print("  [bold]t[/bold] - Timeline")
                self.console.print("  [bold]c[/bold] - Contexto")
                self.console.print("  [bold]q[/bold] - Quit")
                
                cmd = input("\n> ").strip().lower()
                
                if cmd == 'q':
                    break
                elif cmd == 'r':
                    self.console.clear()
                    continue
                elif cmd == 'n':
                    self._create_new_session()
                elif cmd == 't':
                    self.show_session_timeline("a1b2c3d4")
                elif cmd == 'c':
                    self.show_project_context("/current/project")
                else:
                    self.console.print("❌ Comando inválido", style="red")
                
                input("\nPressione Enter para continuar...")
                self.console.clear()
                
        except KeyboardInterrupt:
            self.console.print("\n\n👋 Até logo!")
    
    def _create_new_session(self):
        """Cria nova sessão interativamente."""
        self.console.print(Panel.fit("✨ Nova Sessão", style="bold green"))
        
        title = input("Título da sessão: ").strip()
        if title:
            session_id = f"new_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.console.print(f"✅ Sessão criada: {session_id}")
            self.console.print(f"🏷️ Título: {title}")
        else:
            self.console.print("❌ Sessão cancelada", style="red")


if __name__ == "__main__":
    browser = SessionBrowser()
    browser.interactive_browser()