#!/usr/bin/env python3
"""
Configuração de Separação de Sessões
Mantém sessões web e terminal completamente independentes
"""

# IMPORTANTE: SESSÕES DEVEM PERMANECER SEPARADAS
SESSION_SEPARATION_CONFIG = {
    "enabled": True,
    "mode": "independent",

    # Sessão web usa ID fixo
    "web_session": {
        "id": "00000000-0000-0000-0000-000000000001",
        "description": "Sessão do navegador/web - mantida separada",
        "unify_with_terminal": False
    },

    # Sessões terminal mantêm seus próprios UUIDs
    "terminal_sessions": {
        "keep_separate": True,
        "preserve_original_id": True,
        "description": "Cada sessão do terminal mantém seu próprio arquivo JSONL"
    },

    # Desabilita toda unificação
    "unification": {
        "enabled": False,
        "auto_merge": False,
        "force_merge": False,
        "sync_to_unified": False
    },

    # Monitoramento apenas observa, não modifica
    "monitoring": {
        "enabled": True,
        "mode": "observe_only",
        "modify_files": False,
        "consolidate": False
    }
}

def should_unify_sessions() -> bool:
    """Retorna se sessões devem ser unificadas"""
    return SESSION_SEPARATION_CONFIG["unification"]["enabled"]

def get_session_mode() -> str:
    """Retorna o modo de operação das sessões"""
    return SESSION_SEPARATION_CONFIG["mode"]

def is_unification_disabled() -> bool:
    """Verifica se unificação está desabilitada"""
    return not SESSION_SEPARATION_CONFIG["unification"]["enabled"]

# Exporta configuração
__all__ = [
    'SESSION_SEPARATION_CONFIG',
    'should_unify_sessions',
    'get_session_mode',
    'is_unification_disabled'
]