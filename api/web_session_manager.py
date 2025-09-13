#!/usr/bin/env python3
"""
Gerenciador de Sessão Web Dedicada
Mantém sessão 00000000-0000-0000-0000-000000000001 exclusiva para interações web
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import logging

# Configuração de logging
logger = logging.getLogger(__name__)

# IDs especiais
WEB_SESSION_ID = "00000000-0000-0000-0000-000000000001"
PROJECT_NAME = "-Users-2a--claude-cc-sdk-chat-api"


class WebSessionManager:
    """Gerencia sessão dedicada para interações web"""

    def __init__(self):
        """Inicializa o gerenciador de sessão web"""
        self.project_path = Path.home() / ".claude" / "projects" / PROJECT_NAME
        self.web_session_file = self.project_path / f"{WEB_SESSION_ID}.jsonl"

        # Cria arquivo da sessão web se não existir
        self.project_path.mkdir(parents=True, exist_ok=True)
        if not self.web_session_file.exists():
            self._initialize_web_session()

    def _initialize_web_session(self):
        """Inicializa arquivo da sessão web com metadados"""
        initial_data = {
            "type": "session_metadata",
            "sessionId": WEB_SESSION_ID,
            "origin": "web",
            "created": datetime.now().isoformat(),
            "description": "Sessão dedicada para interações via interface web",
            "version": "1.0.0"
        }

        with open(self.web_session_file, 'w', encoding='utf-8') as f:
            f.write(json.dumps(initial_data) + '\n')

        logger.info(f"✨ Sessão web inicializada: {WEB_SESSION_ID}")

    def is_web_session(self, session_id: str) -> bool:
        """Verifica se é a sessão web"""
        return session_id == WEB_SESSION_ID

    def is_terminal_session(self, file_path: Path) -> bool:
        """Identifica se um arquivo é de sessão do terminal"""
        if file_path.name == f"{WEB_SESSION_ID}.jsonl":
            return False

        # Verifica conteúdo do arquivo para detectar origem
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline()
                if first_line:
                    data = json.loads(first_line)
                    # Sessões do terminal geralmente têm userType: external
                    if data.get('userType') == 'external':
                        return True
                    # Ou têm type: summary (do Claude Code CLI)
                    if data.get('type') == 'summary':
                        return True
        except:
            pass

        return False

    async def add_web_message(self, message_data: Dict) -> bool:
        """Adiciona mensagem à sessão web"""
        try:
            # Garante que tem o sessionId correto
            message_data['sessionId'] = WEB_SESSION_ID
            message_data['origin'] = 'web'

            # Adiciona timestamp se não tiver
            if 'timestamp' not in message_data:
                message_data['timestamp'] = datetime.now().isoformat()

            # Escreve no arquivo
            with open(self.web_session_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(message_data) + '\n')

            logger.info(f"📝 Mensagem adicionada à sessão web")
            return True

        except Exception as e:
            logger.error(f"❌ Erro ao adicionar mensagem web: {e}")
            return False

    def get_web_session_stats(self) -> Dict:
        """Retorna estatísticas da sessão web"""
        if not self.web_session_file.exists():
            return {
                "exists": False,
                "messages": 0,
                "size_bytes": 0
            }

        message_count = 0
        user_messages = 0
        assistant_messages = 0
        first_message = None
        last_message = None

        try:
            with open(self.web_session_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try:
                            data = json.loads(line)
                            if data.get('type') in ['user', 'assistant']:
                                message_count += 1
                                if data['type'] == 'user':
                                    user_messages += 1
                                else:
                                    assistant_messages += 1

                                timestamp = data.get('timestamp')
                                if timestamp:
                                    if not first_message or timestamp < first_message:
                                        first_message = timestamp
                                    if not last_message or timestamp > last_message:
                                        last_message = timestamp
                        except:
                            pass
        except:
            pass

        file_size = self.web_session_file.stat().st_size

        return {
            "exists": True,
            "sessionId": WEB_SESSION_ID,
            "messages": message_count,
            "user_messages": user_messages,
            "assistant_messages": assistant_messages,
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2),
            "first_message": first_message,
            "last_message": last_message,
            "file_path": str(self.web_session_file)
        }

    def list_terminal_sessions(self) -> List[Dict]:
        """Lista apenas sessões do terminal (não web)"""
        terminal_sessions = []

        for jsonl_file in self.project_path.glob("*.jsonl"):
            # Pula a sessão web
            if jsonl_file.name == f"{WEB_SESSION_ID}.jsonl":
                continue

            # Verifica se é sessão do terminal
            if self.is_terminal_session(jsonl_file):
                session_info = {
                    "id": jsonl_file.stem,
                    "file": jsonl_file.name,
                    "origin": "terminal",
                    "size_bytes": jsonl_file.stat().st_size,
                    "modified": datetime.fromtimestamp(jsonl_file.stat().st_mtime).isoformat()
                }
                terminal_sessions.append(session_info)

        return terminal_sessions

    def separate_sessions_by_origin(self) -> Dict:
        """Separa sessões por origem (web vs terminal)"""
        web_stats = self.get_web_session_stats()
        terminal_sessions = self.list_terminal_sessions()

        return {
            "web": {
                "sessionId": WEB_SESSION_ID,
                "stats": web_stats,
                "description": "Sessão dedicada para interações via navegador"
            },
            "terminal": {
                "count": len(terminal_sessions),
                "sessions": terminal_sessions,
                "description": "Sessões criadas via Claude Code CLI"
            },
            "summary": {
                "total_sessions": len(terminal_sessions) + (1 if web_stats["exists"] else 0),
                "web_messages": web_stats.get("messages", 0),
                "terminal_sessions": len(terminal_sessions)
            }
        }


# Singleton global
_web_manager_instance: Optional[WebSessionManager] = None


def get_web_session_manager() -> WebSessionManager:
    """Obtém instância singleton do gerenciador de sessão web"""
    global _web_manager_instance
    if _web_manager_instance is None:
        _web_manager_instance = WebSessionManager()
    return _web_manager_instance


# CLI para teste
if __name__ == "__main__":
    import sys

    manager = get_web_session_manager()

    if len(sys.argv) > 1 and sys.argv[1] == "stats":
        # Mostra estatísticas
        print("📊 Estatísticas das Sessões")
        print("=" * 50)

        result = manager.separate_sessions_by_origin()

        print("\n🌐 Sessão Web:")
        web_stats = result["web"]["stats"]
        print(f"  - ID: {WEB_SESSION_ID}")
        print(f"  - Mensagens: {web_stats['messages']}")
        print(f"  - Tamanho: {web_stats['size_mb']} MB")

        print(f"\n💻 Sessões Terminal:")
        print(f"  - Total: {result['terminal']['count']} sessões")
        for session in result["terminal"]["sessions"][:5]:  # Mostra até 5
            print(f"    • {session['id'][:8]}... ({session['size_bytes']} bytes)")

        print(f"\n📈 Resumo:")
        summary = result["summary"]
        print(f"  - Total de sessões: {summary['total_sessions']}")
        print(f"  - Mensagens web: {summary['web_messages']}")
        print(f"  - Sessões terminal: {summary['terminal_sessions']}")

    else:
        print("Uso: python web_session_manager.py stats")