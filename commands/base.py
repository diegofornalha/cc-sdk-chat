"""
Base Commands - Sistema base para comandos slash contextuais.

Inspirado no sistema de comandos do Claude Code CLI oficial.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass
import re


@dataclass
class CommandResult:
    """Resultado de execução de comando."""
    success: bool
    message: str
    data: Optional[Any] = None


class BaseCommand(ABC):
    """Classe base para comandos slash."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Nome do comando."""
        pass
    
    @property 
    @abstractmethod
    def description(self) -> str:
        """Descrição do comando."""
        pass
    
    @abstractmethod
    async def execute(self, args: List[str]) -> CommandResult:
        """Executa o comando."""
        pass


class CommandRegistry:
    """Registry de comandos contextuais estilo Claude Code."""
    
    def __init__(self):
        self.commands: Dict[str, BaseCommand] = {}
        self.aliases: Dict[str, str] = {}
        
    def register(self, command: BaseCommand):
        """Registra um comando."""
        self.commands[command.name] = command
    
    def register_alias(self, alias: str, command_name: str):
        """Registra alias para comando."""
        self.aliases[alias] = command_name
    
    def parse_slash_command(self, input_text: str) -> Optional[tuple]:
        """
        Parseia comandos slash estilo Claude Code.
        
        Formatos suportados:
        - /sessions:list
        - /project:switch nome-projeto  
        - /config:show
        """
        if not input_text.startswith('/'):
            return None
            
        # Remove / inicial
        command_text = input_text[1:].strip()
        
        # Parse formato namespace:comando args
        if ':' in command_text:
            namespace_cmd, args_text = command_text.split(':', 1)
            args_text = args_text.strip()
            
            # Extrai comando e argumentos
            parts = args_text.split() if args_text else []
            command = parts[0] if parts else ''
            args = parts[1:] if len(parts) > 1 else []
            
            full_command = f"{namespace_cmd}:{command}"
            return (full_command, args)
        
        # Parse formato simples /comando args
        parts = command_text.split()
        command = parts[0] if parts else ''
        args = parts[1:] if len(parts) > 1 else []
        
        return (command, args)
    
    async def execute_command(self, command_name: str, args: List[str]) -> CommandResult:
        """Executa comando registrado."""
        # Resolve alias
        if command_name in self.aliases:
            command_name = self.aliases[command_name]
        
        # Busca comando
        if command_name not in self.commands:
            return CommandResult(
                success=False,
                message=f"❌ Comando '{command_name}' não encontrado"
            )
        
        try:
            return await self.commands[command_name].execute(args)
        except Exception as e:
            return CommandResult(
                success=False,
                message=f"❌ Erro ao executar comando: {e}"
            )
    
    def get_available_commands(self) -> Dict[str, str]:
        """Retorna comandos disponíveis com descrições."""
        return {
            name: cmd.description 
            for name, cmd in self.commands.items()
        }
    
    def get_help_text(self) -> str:
        """Gera texto de ajuda para comandos."""
        help_text = "🎯 Comandos Slash Disponíveis:\n\n"
        
        # Agrupa comandos por namespace
        namespaces = {}
        for name, cmd in self.commands.items():
            if ':' in name:
                namespace, command = name.split(':', 1)
                if namespace not in namespaces:
                    namespaces[namespace] = []
                namespaces[namespace].append((command, cmd.description))
            else:
                if 'geral' not in namespaces:
                    namespaces['geral'] = []
                namespaces['geral'].append((name, cmd.description))
        
        # Formata ajuda por namespace
        for namespace, commands in namespaces.items():
            help_text += f"📁 {namespace.title()}:\n"
            for cmd_name, description in commands:
                help_text += f"  /{namespace}:{cmd_name} - {description}\n"
            help_text += "\n"
        
        # Adiciona aliases
        if self.aliases:
            help_text += "🔗 Aliases:\n"
            for alias, cmd in self.aliases.items():
                help_text += f"  {alias} → {cmd}\n"
        
        return help_text