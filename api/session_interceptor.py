#!/usr/bin/env python3
"""
Interceptador de Sessões - Bloqueia unificação automática do Claude Code
Este módulo intercepta tentativas de escrever sessões do terminal no arquivo web
"""

import json
import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SessionInterceptor:
    """Intercepta e redireciona escritas de sessão"""

    UNIFIED_WEB_ID = "00000000-0000-0000-0000-000000000001"

    def __init__(self):
        self.projects_dir = Path("/Users/2a/.claude/projects")
        self.web_session_file = self.projects_dir / "-Users-2a--claude-cc-sdk-chat-api" / f"{self.UNIFIED_WEB_ID}.jsonl"
        self.blocked_writes = 0
        self.redirected_sessions = set()

    def is_terminal_session(self, session_data: Dict[str, Any]) -> bool:
        """Verifica se é uma sessão do terminal"""
        # Detecta sessões do terminal por vários indicadores
        if session_data.get("originalSession"):
            return True
        if session_data.get("source") == "claude_code_auto":
            return True
        if session_data.get("unified_at"):
            return True
        # Verifica se o ID é diferente do web
        if session_data.get("sessionId") and session_data["sessionId"] != self.UNIFIED_WEB_ID:
            return True
        return False

    def should_block_write(self, file_path: str, data: Dict[str, Any]) -> bool:
        """Determina se deve bloquear a escrita"""
        # Se é o arquivo web unificado
        if self.UNIFIED_WEB_ID in file_path:
            # E os dados são de uma sessão terminal
            if self.is_terminal_session(data):
                return True
        return False

    def get_terminal_session_file(self, session_id: str) -> Path:
        """Obtém o arquivo correto para uma sessão do terminal"""
        # Remove prefixos se houver
        clean_id = session_id.split("/")[-1].replace(".jsonl", "")

        # Diretório para sessões do terminal
        terminal_dir = self.projects_dir / "-Users-2a--claude"
        terminal_dir.mkdir(parents=True, exist_ok=True)

        return terminal_dir / f"{clean_id}.jsonl"

    def redirect_write(self, data: Dict[str, Any]) -> Optional[Path]:
        """Redireciona escrita para o arquivo correto"""
        # Obtém o ID da sessão original
        original_session = data.get("originalSession")
        if not original_session:
            session_id = data.get("sessionId")
            if session_id and session_id != self.UNIFIED_WEB_ID:
                original_session = session_id

        if original_session:
            correct_file = self.get_terminal_session_file(original_session)

            # Log do redirecionamento
            if original_session not in self.redirected_sessions:
                logger.warning(f"🚫 BLOQUEANDO unificação automática do Claude Code")
                logger.info(f"   ➡️ Sessão terminal: {original_session}")
                logger.info(f"   📁 Redirecionando para: {correct_file}")
                self.redirected_sessions.add(original_session)

            self.blocked_writes += 1
            return correct_file

        return None

    def write_to_correct_file(self, data: Dict[str, Any], file_path: Path) -> bool:
        """Escreve dados no arquivo correto"""
        try:
            # Garante que o diretório existe
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Adiciona dados ao arquivo
            with open(file_path, "a", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
                f.write("\n")

            return True
        except Exception as e:
            logger.error(f"Erro ao escrever em {file_path}: {e}")
            return False

    def intercept_and_redirect(self, file_path: str, data: Dict[str, Any]) -> bool:
        """Intercepta e redireciona tentativas de unificação"""
        # Verifica se deve bloquear
        if self.should_block_write(file_path, data):
            # Tenta redirecionar
            correct_file = self.redirect_write(data)
            if correct_file:
                # Escreve no arquivo correto
                return self.write_to_correct_file(data, correct_file)

        # Permite escrita normal
        return False

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do interceptador"""
        return {
            "blocked_writes": self.blocked_writes,
            "redirected_sessions": list(self.redirected_sessions),
            "active": True,
            "mode": "blocking_unification"
        }

# Instância global
_interceptor = SessionInterceptor()

def intercept_session_write(file_path: str, data: Dict[str, Any]) -> bool:
    """Função principal para interceptar escritas"""
    return _interceptor.intercept_and_redirect(file_path, data)

def get_interceptor_stats() -> Dict[str, Any]:
    """Obtém estatísticas do interceptador"""
    return _interceptor.get_stats()

if __name__ == "__main__":
    # Teste do interceptador
    test_data = {
        "sessionId": "00000000-0000-0000-0000-000000000001",
        "originalSession": "4b5f9b35-31b7-4789-88a1-390ecdf21559",
        "source": "claude_code_auto",
        "unified_at": datetime.now().isoformat(),
        "message": "Test message"
    }

    web_file = "/Users/2a/.claude/projects/-Users-2a--claude-cc-sdk-chat-api/00000000-0000-0000-0000-000000000001.jsonl"

    print("🧪 Testando interceptador...")
    print(f"   Arquivo alvo: {web_file}")
    print(f"   Dados contém originalSession: {test_data.get('originalSession')}")

    if _interceptor.should_block_write(web_file, test_data):
        print("   ✅ Escrita seria BLOQUEADA (correto!)")
        redirect = _interceptor.redirect_write(test_data)
        if redirect:
            print(f"   ➡️ Redirecionaria para: {redirect}")
    else:
        print("   ❌ Escrita NÃO seria bloqueada (incorreto)")

    print(f"\n📊 Estatísticas: {_interceptor.get_stats()}")