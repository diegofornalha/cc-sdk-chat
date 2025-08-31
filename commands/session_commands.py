"""
Session Slash Commands - Comandos slash para sessões.

Implementa comandos no formato /sessions:comando inspirado no CLI oficial.
"""

from typing import List
from .base import BaseCommand, CommandResult


class SessionListCommand(BaseCommand):
    """Comando /sessions:list"""
    
    @property
    def name(self) -> str:
        return "sessions:list"
    
    @property
    def description(self) -> str:
        return "Lista todas as sessões do projeto atual"
    
    async def execute(self, args: List[str]) -> CommandResult:
        """Lista sessões do projeto."""
        # TODO: Implementar listagem real
        sessions_data = [
            {"id": "a1b2c3d4", "title": "Debug Chat API", "status": "ativa", "messages": 23},
            {"id": "e5f6g7h8", "title": "Implementar TUI", "status": "pausada", "messages": 45},
        ]
        
        result_msg = "📋 Sessões encontradas:\n"
        for session in sessions_data:
            result_msg += f"  🔸 {session['id']}: {session['title']} ({session['messages']} msgs)\n"
        
        return CommandResult(success=True, message=result_msg, data=sessions_data)


class SessionRestoreCommand(BaseCommand):
    """Comando /sessions:restore"""
    
    @property
    def name(self) -> str:
        return "sessions:restore"
    
    @property 
    def description(self) -> str:
        return "Restaura sessão específica por ID"
    
    async def execute(self, args: List[str]) -> CommandResult:
        """Restaura sessão específica."""
        if not args:
            return CommandResult(
                success=False,
                message="❌ ID da sessão é obrigatório. Uso: /sessions:restore <session_id>"
            )
        
        session_id = args[0]
        
        # TODO: Implementar restauração real
        return CommandResult(
            success=True,
            message=f"✅ Sessão {session_id} restaurada com sucesso"
        )


class SessionNewCommand(BaseCommand):
    """Comando /sessions:new"""
    
    @property
    def name(self) -> str:
        return "sessions:new"
    
    @property
    def description(self) -> str:
        return "Cria nova sessão com título opcional"
    
    async def execute(self, args: List[str]) -> CommandResult:
        """Cria nova sessão."""
        title = " ".join(args) if args else "Nova Sessão"
        
        # TODO: Implementar criação real
        new_session_id = f"new_{hash(title) % 10000:04d}"
        
        return CommandResult(
            success=True,
            message=f"✨ Nova sessão criada: {new_session_id} - '{title}'"
        )


class SessionDeleteCommand(BaseCommand):
    """Comando /sessions:delete"""
    
    @property
    def name(self) -> str:
        return "sessions:delete"
    
    @property
    def description(self) -> str:
        return "Remove sessão específica"
    
    async def execute(self, args: List[str]) -> CommandResult:
        """Remove sessão."""
        if not args:
            return CommandResult(
                success=False,
                message="❌ ID da sessão é obrigatório. Uso: /sessions:delete <session_id>"
            )
        
        session_id = args[0]
        
        # TODO: Implementar remoção real com confirmação
        return CommandResult(
            success=True,
            message=f"🗑️ Sessão {session_id} removida"
        )


class SessionSlashCommands:
    """Registry de comandos slash para sessões."""
    
    def __init__(self):
        from .base import CommandRegistry
        self.registry = CommandRegistry()
        self._register_commands()
    
    def _register_commands(self):
        """Registra todos os comandos de sessão."""
        commands = [
            SessionListCommand(),
            SessionRestoreCommand(), 
            SessionNewCommand(),
            SessionDeleteCommand()
        ]
        
        for cmd in commands:
            self.registry.register(cmd)
        
        # Aliases úteis
        self.registry.register_alias("ls", "sessions:list")
        self.registry.register_alias("restore", "sessions:restore")
        self.registry.register_alias("new", "sessions:new")
    
    async def handle_input(self, user_input: str) -> CommandResult:
        """Processa input do usuário buscando comandos slash."""
        parsed = self.registry.parse_slash_command(user_input)
        
        if not parsed:
            return CommandResult(
                success=False,
                message="Não é um comando slash válido"
            )
        
        command_name, args = parsed
        return await self.registry.execute_command(command_name, args)
    
    def get_help(self) -> str:
        """Retorna ajuda dos comandos de sessão."""
        return self.registry.get_help_text()