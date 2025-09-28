#!/usr/bin/env python3
"""
Hook do Claude Code - Bloqueia unificação automática de sessões
Este script deve ser configurado como hook no Claude Code
"""

import sys
import json
import os
from pathlib import Path

# IDs importantes
UNIFIED_WEB_ID = "00000000-0000-0000-0000-000000000001"
TERMINAL_SESSION_PREFIX = "/Users/2a/.claude/projects/-Users-2a--claude/"

def is_unification_attempt(file_path: str, content: str) -> bool:
    """Detecta tentativas de unificação"""
    # Se está tentando escrever no arquivo web unificado
    if UNIFIED_WEB_ID in file_path:
        # Verifica se o conteúdo tem marcadores de unificação
        if "originalSession" in content or "unified_at" in content or "source" in content:
            return True
    return False

def block_unification():
    """Bloqueia tentativas de unificação"""
    # Lê entrada do hook (se disponível)
    if len(sys.argv) > 1:
        action = sys.argv[1]

        # Se é uma ação de escrita
        if action in ["write", "append"]:
            file_path = sys.argv[2] if len(sys.argv) > 2 else ""

            # Verifica se é o arquivo unificado
            if UNIFIED_WEB_ID in file_path:
                print(f"🚫 BLOQUEADO: Tentativa de unificar sessão do terminal")
                print(f"   Arquivo: {file_path}")
                print(f"   Ação: Unificação automática desabilitada")

                # Retorna código de erro para bloquear a ação
                sys.exit(1)

    # Permite outras operações
    sys.exit(0)

if __name__ == "__main__":
    block_unification()