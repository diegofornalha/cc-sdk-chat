#!/usr/bin/env python3
"""
Gerenciador de Sessões Isoladas
Inspirado no neo4j-agent - mantém sessões completamente separadas
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class SessionState:
    """Estado de uma sessão isolada"""
    session_id: str
    created_at: str
    last_access: str
    message_count: int = 0
    source: str = "unknown"
    is_isolated: bool = True
    allow_unification: bool = False

class IsolatedSessionManager:
    """
    Gerenciador que mantém sessões completamente isoladas.
    Inspirado no CommandStreamManager do neo4j-agent.
    """

    # Sessões que NUNCA devem ser unificadas
    PROTECTED_SESSIONS = {
        "00000000-0000-0000-0000-000000000001",  # Web dedicado
        "4b5f9b35-31b7-4789-88a1-390ecdf21559"   # Terminal dedicado
    }

    def __init__(self, project_path: Path = None):
        """Inicializa o gerenciador com sessões isoladas"""
        self.project_path = project_path or Path.home() / ".claude" / "projects"
        self.active_sessions: Dict[str, SessionState] = {}
        self.session_locks: Dict[str, asyncio.Lock] = {}
        self._running = False

        # Inicializar sessões protegidas
        self._init_protected_sessions()

        logger.info(f"🔒 Gerenciador de Sessões Isoladas iniciado")
        logger.info(f"📁 Caminho do projeto: {self.project_path}")

    def _init_protected_sessions(self):
        """Inicializa as sessões protegidas"""
        now = datetime.now().isoformat()

        # Sessão Web dedicada
        self.active_sessions["00000000-0000-0000-0000-000000000001"] = SessionState(
            session_id="00000000-0000-0000-0000-000000000001",
            created_at=now,
            last_access=now,
            source="web",
            is_isolated=True,
            allow_unification=False
        )

        # Sessão Terminal dedicada
        self.active_sessions["4b5f9b35-31b7-4789-88a1-390ecdf21559"] = SessionState(
            session_id="4b5f9b35-31b7-4789-88a1-390ecdf21559",
            created_at=now,
            last_access=now,
            source="terminal",
            is_isolated=True,
            allow_unification=False
        )

        logger.info("🛡️ Sessões protegidas inicializadas:")
        logger.info("  - Web: 00000000-0000-0000-0000-000000000001")
        logger.info("  - Terminal: 4b5f9b35-31b7-4789-88a1-390ecdf21559")

    def is_protected_session(self, session_id: str) -> bool:
        """Verifica se uma sessão está protegida contra unificação"""
        return session_id in self.PROTECTED_SESSIONS

    async def get_session_lock(self, session_id: str) -> asyncio.Lock:
        """Obtém lock exclusivo para uma sessão"""
        if session_id not in self.session_locks:
            self.session_locks[session_id] = asyncio.Lock()
        return self.session_locks[session_id]

    async def process_message(self, session_id: str, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa uma mensagem mantendo isolamento total.

        IMPORTANTE: Rejeita tentativas de unificação para sessões protegidas.
        """
        # Verificar se é tentativa de unificação
        if self._is_unification_attempt(message):
            original_session = message.get("originalSession", "")

            # Bloquear unificação de sessões protegidas
            if self.is_protected_session(session_id) or self.is_protected_session(original_session):
                logger.warning(f"⛔ BLOQUEADO: Tentativa de unificar sessão protegida")
                logger.warning(f"  - Sessão alvo: {session_id}")
                logger.warning(f"  - Sessão origem: {original_session}")

                # Retornar mensagem indicando bloqueio
                return {
                    "status": "blocked",
                    "reason": "protected_session",
                    "message": "Sessão protegida contra unificação",
                    "session_id": session_id,
                    "timestamp": datetime.now().isoformat()
                }

        # Processar mensagem normalmente se não for unificação
        async with await self.get_session_lock(session_id):
            # Atualizar estado da sessão
            if session_id not in self.active_sessions:
                self.active_sessions[session_id] = SessionState(
                    session_id=session_id,
                    created_at=datetime.now().isoformat(),
                    last_access=datetime.now().isoformat(),
                    source=message.get("source", "unknown")
                )

            state = self.active_sessions[session_id]
            state.last_access = datetime.now().isoformat()
            state.message_count += 1

            # Adicionar metadados de isolamento
            message["_isolated"] = True
            message["_session_state"] = asdict(state)
            message["_processed_at"] = datetime.now().isoformat()

            return message

    def _is_unification_attempt(self, message: Dict[str, Any]) -> bool:
        """Detecta se é uma tentativa de unificação"""
        unification_markers = [
            "originalSession",
            "unified_at",
            "source" in message and "claude_code_auto" in str(message.get("source", ""))
        ]
        return any(unification_markers)

    def get_session_file(self, session_id: str) -> Path:
        """
        Retorna o arquivo JSONL da sessão.
        IMPORTANTE: Cada sessão tem seu próprio arquivo isolado.
        """
        # Procurar em todos os projetos
        for project_dir in self.project_path.iterdir():
            if project_dir.is_dir():
                session_file = project_dir / f"{session_id}.jsonl"
                if session_file.exists():
                    return session_file

        # Se não encontrar, criar no projeto padrão
        default_project = self.project_path / "-Users-2a--claude-cc-sdk-chat-api"
        default_project.mkdir(parents=True, exist_ok=True)
        return default_project / f"{session_id}.jsonl"

    def read_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """Lê mensagens de uma sessão isolada"""
        session_file = self.get_session_file(session_id)

        if not session_file.exists():
            logger.info(f"📄 Arquivo de sessão não encontrado: {session_file}")
            return []

        messages = []
        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        msg = json.loads(line)

                        # Filtrar mensagens unificadas se for sessão protegida
                        if self.is_protected_session(session_id):
                            if not self._is_unification_attempt(msg):
                                messages.append(msg)
                        else:
                            messages.append(msg)

            logger.info(f"✅ Lidas {len(messages)} mensagens da sessão {session_id[:8]}...")

        except Exception as e:
            logger.error(f"❌ Erro ao ler sessão: {e}")

        return messages

    async def write_message(self, session_id: str, message: Dict[str, Any]) -> bool:
        """
        Escreve mensagem em uma sessão isolada.
        Bloqueia tentativas de unificação em sessões protegidas.
        """
        # Processar mensagem com proteção
        processed = await self.process_message(session_id, message)

        # Se foi bloqueada, não escrever
        if processed.get("status") == "blocked":
            logger.warning(f"🚫 Escrita bloqueada para sessão {session_id[:8]}...")
            return False

        # Escrever no arquivo isolado
        session_file = self.get_session_file(session_id)

        try:
            with open(session_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(processed, ensure_ascii=False) + '\n')

            logger.info(f"✍️ Mensagem escrita na sessão isolada {session_id[:8]}...")
            return True

        except Exception as e:
            logger.error(f"❌ Erro ao escrever: {e}")
            return False

    def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retorna status de uma sessão"""
        if session_id not in self.active_sessions:
            return None

        state = self.active_sessions[session_id]
        return {
            "session_id": state.session_id,
            "created_at": state.created_at,
            "last_access": state.last_access,
            "message_count": state.message_count,
            "source": state.source,
            "is_isolated": state.is_isolated,
            "is_protected": self.is_protected_session(session_id),
            "allow_unification": state.allow_unification
        }

    def list_active_sessions(self) -> List[Dict[str, Any]]:
        """Lista todas as sessões ativas"""
        sessions = []
        for session_id, state in self.active_sessions.items():
            sessions.append({
                "session_id": state.session_id,
                "source": state.source,
                "message_count": state.message_count,
                "is_protected": self.is_protected_session(session_id),
                "last_access": state.last_access
            })
        return sessions

    async def monitor_unification_attempts(self):
        """
        Monitora e bloqueia tentativas de unificação em tempo real.
        """
        self._running = True
        logger.info("👁️ Monitor de proteção iniciado")

        while self._running:
            try:
                # Verificar arquivos das sessões protegidas
                for session_id in self.PROTECTED_SESSIONS:
                    session_file = self.get_session_file(session_id)

                    if session_file.exists():
                        # Ler última linha para detectar unificação
                        with open(session_file, 'r', encoding='utf-8') as f:
                            lines = f.readlines()
                            if lines:
                                last_line = lines[-1]
                                try:
                                    last_msg = json.loads(last_line)

                                    # Se detectar unificação, limpar
                                    if self._is_unification_attempt(last_msg):
                                        logger.warning(f"🔍 Detectada tentativa de unificação em {session_id[:8]}...")

                                        # Reescrever arquivo sem mensagens unificadas
                                        clean_messages = []
                                        for line in lines:
                                            msg = json.loads(line)
                                            if not self._is_unification_attempt(msg):
                                                clean_messages.append(line)

                                        with open(session_file, 'w', encoding='utf-8') as f:
                                            f.writelines(clean_messages)

                                        logger.info(f"🧹 Arquivo limpo: removidas mensagens unificadas")

                                except json.JSONDecodeError:
                                    pass

                await asyncio.sleep(2)  # Verificar a cada 2 segundos

            except Exception as e:
                logger.error(f"❌ Erro no monitor: {e}")
                await asyncio.sleep(5)

    async def stop_monitor(self):
        """Para o monitor de proteção"""
        self._running = False
        logger.info("🛑 Monitor de proteção parado")

# Instância global do gerenciador
isolated_manager = None

def get_isolated_manager() -> IsolatedSessionManager:
    """Obtém instância do gerenciador isolado"""
    global isolated_manager
    if isolated_manager is None:
        isolated_manager = IsolatedSessionManager()
    return isolated_manager

async def init_isolated_manager():
    """Inicializa o gerenciador e inicia monitor"""
    manager = get_isolated_manager()

    # Iniciar monitor em background
    asyncio.create_task(manager.monitor_unification_attempts())

    logger.info("✅ Gerenciador de Sessões Isoladas pronto")
    return manager