#!/usr/bin/env python3
"""
Rotas da API - Simples e Organizadas
Define todos os endpoints da API
"""

from fastapi import APIRouter, HTTPException, Path, Body
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

def create_routes(session_manager) -> APIRouter:
    """Cria e retorna o router com todas as rotas"""

    router = APIRouter(prefix="/api", tags=["API"])

    # ===== HEALTH CHECK =====

    @router.get("/health")
    async def health_check():
        """Verifica se a API está funcionando"""
        return {
            "status": "healthy",
            "service": "Claude Chat API",
            "version": "2.0.0"
        }

    # ===== SESSÕES =====

    @router.get("/sessions")
    async def list_sessions():
        """Lista todas as sessões disponíveis"""
        sessions = session_manager.list_sessions()
        return {
            "sessions": sessions,
            "count": len(sessions)
        }

    @router.get("/session/{session_id}")
    async def get_session(session_id: str = Path(..., description="ID da sessão")):
        """Obtém informações e mensagens de uma sessão"""

        # Informações da sessão
        info = session_manager.get_session_info(session_id)

        if "error" in info:
            raise HTTPException(status_code=404, detail=info["error"])

        # Mensagens da sessão
        messages = session_manager.read_session(session_id)

        return {
            "session": info,
            "messages": messages,
            "total": len(messages)
        }

    # ===== MENSAGENS =====

    @router.post("/session/{session_id}/message")
    async def send_message(
        session_id: str = Path(..., description="ID da sessão"),
        message: Dict[str, Any] = Body(..., description="Mensagem para enviar")
    ):
        """Envia uma mensagem para uma sessão"""

        # Valida sessão
        info = session_manager.get_session_info(session_id)
        if "error" in info:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")

        # Escreve mensagem
        success = session_manager.write_message(session_id, message)

        if not success:
            raise HTTPException(status_code=400, detail="Erro ao enviar mensagem")

        return {
            "status": "success",
            "session_id": session_id,
            "message": "Mensagem enviada"
        }

    # ===== PROTEÇÃO =====

    @router.post("/protect/{session_id}")
    async def protect_session(session_id: str = Path(..., description="ID da sessão")):
        """Protege uma sessão contra unificação"""

        if not session_manager.is_protected(session_id):
            return {
                "status": "info",
                "message": "Apenas sessões especiais podem ser protegidas",
                "protected_sessions": [
                    session_manager.WEB_SESSION,
                    session_manager.TERMINAL_SESSION
                ]
            }

        # Limpa mensagens unificadas
        removed = session_manager.clean_unified_messages(session_id)

        return {
            "status": "success",
            "session_id": session_id,
            "removed_messages": removed,
            "message": f"Sessão protegida. {removed} mensagens unificadas removidas."
        }

    @router.get("/protect/status")
    async def protection_status():
        """Verifica status de proteção das sessões"""

        # Monitora proteção
        session_manager.monitor_protection()

        web_info = session_manager.get_session_info(session_manager.WEB_SESSION)
        terminal_info = session_manager.get_session_info(session_manager.TERMINAL_SESSION)

        return {
            "protection_active": True,
            "protected_sessions": {
                "web": {
                    "id": session_manager.WEB_SESSION,
                    "message_count": web_info.get("message_count", 0),
                    "last_activity": web_info.get("last_message")
                },
                "terminal": {
                    "id": session_manager.TERMINAL_SESSION,
                    "message_count": terminal_info.get("message_count", 0),
                    "last_activity": terminal_info.get("last_message")
                }
            },
            "message": "Sessões protegidas contra unificação"
        }

    # ===== CHAT DEDICADO =====

    @router.post("/web-chat")
    async def web_chat(message: Dict[str, Any] = Body(...)):
        """Chat dedicado para interface web"""

        # Força usar sessão web
        session_id = session_manager.WEB_SESSION

        # Adiciona marcação de origem
        message["source"] = "web"
        message["session_id"] = session_id

        # Escreve mensagem
        success = session_manager.write_message(session_id, message)

        if not success:
            raise HTTPException(status_code=400, detail="Erro ao enviar mensagem")

        return {
            "status": "success",
            "session_id": session_id,
            "source": "web",
            "message": "Mensagem enviada para sessão web"
        }

    @router.post("/terminal-chat")
    async def terminal_chat(message: Dict[str, Any] = Body(...)):
        """Chat dedicado para terminal"""

        # Força usar sessão terminal
        session_id = session_manager.TERMINAL_SESSION

        # Adiciona marcação de origem
        message["source"] = "terminal"
        message["session_id"] = session_id

        # Escreve mensagem
        success = session_manager.write_message(session_id, message)

        if not success:
            raise HTTPException(status_code=400, detail="Erro ao enviar mensagem")

        return {
            "status": "success",
            "session_id": session_id,
            "source": "terminal",
            "message": "Mensagem enviada para sessão terminal"
        }

    # ===== ESTATÍSTICAS =====

    @router.get("/stats")
    async def get_statistics():
        """Retorna estatísticas gerais"""

        sessions = session_manager.list_sessions()

        # Conta sessões por tipo
        web_sessions = sum(1 for s in sessions if s.get("source") == "web")
        terminal_sessions = sum(1 for s in sessions if s.get("source") == "terminal")
        other_sessions = len(sessions) - web_sessions - terminal_sessions

        # Total de mensagens
        total_messages = sum(s.get("message_count", 0) for s in sessions)

        return {
            "total_sessions": len(sessions),
            "sessions_by_type": {
                "web": web_sessions,
                "terminal": terminal_sessions,
                "other": other_sessions
            },
            "total_messages": total_messages,
            "protected_sessions": 2,
            "api_version": "2.0.0"
        }

    return router