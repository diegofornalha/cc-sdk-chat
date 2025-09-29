#!/usr/bin/env python3
"""
Gerenciador de Sessões - Simples e Claro
Mantém sessões completamente isoladas
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class Session:
    """Representa uma sessão de chat"""
    id: str
    source: str  # 'web' ou 'terminal'
    created_at: str
    last_activity: str
    message_count: int = 0
    file_path: Optional[Path] = None

class SessionManager:
    """
    Gerenciador de Sessões Isoladas
    Cada sessão é mantida separada, sem unificação
    """

    # IDs das sessões protegidas
    WEB_SESSION = "00000000-0000-0000-0000-000000000001"
    TERMINAL_SESSION = "4b5f9b35-31b7-4789-88a1-390ecdf21559"

    def __init__(self):
        """Inicializa o gerenciador"""
        self.base_path = Path.home() / ".claude" / "projects"
        self.sessions: Dict[str, Session] = {}

        # Inicializa sessões protegidas
        self._init_protected_sessions()

        logger.info("✅ SessionManager inicializado")

    def _init_protected_sessions(self):
        """Inicializa as sessões protegidas"""
        now = datetime.now().isoformat()

        # Sessão Web
        self.sessions[self.WEB_SESSION] = Session(
            id=self.WEB_SESSION,
            source="web",
            created_at=now,
            last_activity=now
        )

        # Sessão Terminal
        self.sessions[self.TERMINAL_SESSION] = Session(
            id=self.TERMINAL_SESSION,
            source="terminal",
            created_at=now,
            last_activity=now
        )

        logger.info(f"🌐 Sessão Web: {self.WEB_SESSION}")
        logger.info(f"💻 Sessão Terminal: {self.TERMINAL_SESSION}")

    def is_protected(self, session_id: str) -> bool:
        """Verifica se é uma sessão protegida"""
        return session_id in [self.WEB_SESSION, self.TERMINAL_SESSION]

    def get_session_file(self, session_id: str) -> Optional[Path]:
        """Retorna o arquivo JSONL de uma sessão"""
        # Procura em todos os projetos
        for project_dir in self.base_path.iterdir():
            if project_dir.is_dir():
                session_file = project_dir / f"{session_id}.jsonl"
                if session_file.exists():
                    return session_file
        return None

    def read_session(self, session_id: str) -> List[Dict[str, Any]]:
        """Lê mensagens de uma sessão"""
        session_file = self.get_session_file(session_id)

        if not session_file:
            logger.warning(f"Sessão não encontrada: {session_id}")
            return []

        messages = []
        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try:
                            msg = json.loads(line)

                            # Filtrar mensagens unificadas em sessões protegidas
                            if self.is_protected(session_id):
                                # Pula mensagens unificadas
                                if msg.get("originalSession") or msg.get("unified_at"):
                                    continue

                            messages.append(msg)
                        except json.JSONDecodeError:
                            continue

            logger.info(f"✅ {len(messages)} mensagens lidas de {session_id[:8]}...")

        except Exception as e:
            logger.error(f"❌ Erro ao ler sessão: {e}")

        return messages

    def write_message(self, session_id: str, message: Dict[str, Any]) -> bool:
        """Escreve mensagem em uma sessão"""

        # Bloqueia unificação em sessões protegidas
        if self.is_protected(session_id):
            if message.get("originalSession") or message.get("unified_at"):
                logger.warning(f"⛔ Bloqueada tentativa de unificar sessão protegida {session_id[:8]}...")
                return False

        # Encontra ou cria arquivo
        session_file = self.get_session_file(session_id)
        if not session_file:
            # Cria no projeto padrão
            project_dir = self.base_path / "-Users-2a--claude-cc-sdk-chat-api"
            project_dir.mkdir(parents=True, exist_ok=True)
            session_file = project_dir / f"{session_id}.jsonl"

        try:
            # Adiciona timestamp se não tiver
            if 'timestamp' not in message:
                message['timestamp'] = datetime.now().isoformat()

            # Escreve mensagem
            with open(session_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(message, ensure_ascii=False) + '\n')

            # Atualiza sessão na memória
            if session_id in self.sessions:
                self.sessions[session_id].message_count += 1
                self.sessions[session_id].last_activity = datetime.now().isoformat()

            logger.info(f"✍️ Mensagem escrita em {session_id[:8]}...")
            return True

        except Exception as e:
            logger.error(f"❌ Erro ao escrever: {e}")
            return False

    def list_sessions(self) -> List[Dict[str, Any]]:
        """Lista todas as sessões disponíveis"""
        sessions = []

        # Busca todas as sessões em disco
        for project_dir in self.base_path.iterdir():
            if project_dir.is_dir():
                for jsonl_file in project_dir.glob("*.jsonl"):
                    session_id = jsonl_file.stem

                    # Informações básicas
                    session_info = {
                        "id": session_id,
                        "project": project_dir.name,
                        "file": str(jsonl_file),
                        "is_protected": self.is_protected(session_id)
                    }

                    # Detecta origem
                    if session_id == self.WEB_SESSION:
                        session_info["source"] = "web"
                    elif session_id == self.TERMINAL_SESSION:
                        session_info["source"] = "terminal"
                    else:
                        session_info["source"] = "unknown"

                    # Estatísticas
                    try:
                        with open(jsonl_file, 'r') as f:
                            lines = f.readlines()
                            session_info["message_count"] = len(lines)

                            # Pega timestamp da última linha
                            if lines:
                                try:
                                    last_msg = json.loads(lines[-1])
                                    session_info["last_activity"] = last_msg.get("timestamp")
                                except:
                                    pass
                    except:
                        session_info["message_count"] = 0

                    sessions.append(session_info)

        # Ordena por última atividade
        sessions.sort(key=lambda s: s.get("last_activity", ""), reverse=True)

        logger.info(f"📋 {len(sessions)} sessões encontradas")
        return sessions

    def get_session_info(self, session_id: str) -> Dict[str, Any]:
        """Retorna informações detalhadas de uma sessão"""
        session_file = self.get_session_file(session_id)

        if not session_file:
            return {"error": "Sessão não encontrada"}

        info = {
            "id": session_id,
            "file": str(session_file),
            "project": session_file.parent.name,
            "is_protected": self.is_protected(session_id),
            "source": "unknown"
        }

        # Detecta origem
        if session_id == self.WEB_SESSION:
            info["source"] = "web"
        elif session_id == self.TERMINAL_SESSION:
            info["source"] = "terminal"

        # Estatísticas
        messages = self.read_session(session_id)
        info["message_count"] = len(messages)

        if messages:
            # Primeira e última mensagem
            info["first_message"] = messages[0].get("timestamp")
            info["last_message"] = messages[-1].get("timestamp")

            # Conta mensagens por tipo
            user_msgs = sum(1 for m in messages if m.get("type") == "user" or
                          (m.get("message") and m["message"].get("role") == "human"))
            assistant_msgs = sum(1 for m in messages if m.get("type") == "assistant" or
                               (m.get("message") and m["message"].get("role") == "assistant"))

            info["user_messages"] = user_msgs
            info["assistant_messages"] = assistant_msgs

        return info

    def clean_unified_messages(self, session_id: str) -> int:
        """Remove mensagens unificadas de uma sessão protegida"""
        if not self.is_protected(session_id):
            logger.warning(f"Sessão {session_id[:8]}... não é protegida")
            return 0

        session_file = self.get_session_file(session_id)
        if not session_file:
            return 0

        clean_messages = []
        removed_count = 0

        try:
            # Lê todas as mensagens
            with open(session_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try:
                            msg = json.loads(line)

                            # Remove se for unificada
                            if msg.get("originalSession") or msg.get("unified_at"):
                                removed_count += 1
                                logger.debug(f"Removendo mensagem unificada de {msg.get('originalSession', 'unknown')}")
                            else:
                                clean_messages.append(line)
                        except:
                            clean_messages.append(line)

            # Reescreve arquivo limpo
            if removed_count > 0:
                with open(session_file, 'w', encoding='utf-8') as f:
                    f.writelines(clean_messages)

                logger.info(f"🧹 Removidas {removed_count} mensagens unificadas de {session_id[:8]}...")

        except Exception as e:
            logger.error(f"❌ Erro ao limpar: {e}")

        return removed_count

    def monitor_protection(self):
        """Monitora e protege sessões contra unificação"""
        for session_id in [self.WEB_SESSION, self.TERMINAL_SESSION]:
            removed = self.clean_unified_messages(session_id)
            if removed > 0:
                logger.warning(f"⚠️ Detectada e bloqueada tentativa de unificação em {session_id[:8]}...")

# Instância global
_manager = None

def get_manager() -> SessionManager:
    """Retorna instância global do gerenciador"""
    global _manager
    if _manager is None:
        _manager = SessionManager()
    return _manager