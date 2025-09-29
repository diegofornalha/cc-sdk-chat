#!/usr/bin/env python3
"""
Gerenciador Simplificado de Sessões
Apenas mantém sessões separadas sem unificação
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class UnifiedSessionManager:
    """Gerenciador simplificado - NÃO unifica sessões"""

    def __init__(self, project_path=None):
        """Inicializa gerenciador vazio"""
        self.is_running = False
        logger.info("✅ Gerenciador simplificado inicializado (sem unificação)")

    def consolidate_existing_files(self):
        """NÃO consolida - mantém separado"""
        logger.info("⛔ Unificação DESABILITADA")
        return 0

    def sync_file_to_unified(self, source_file):
        """NÃO sincroniza - mantém separado"""
        return 0

    def force_consolidate_file(self, session_id):
        """NÃO força consolidação"""
        logger.warning(f"⚠️ Tentativa de consolidação bloqueada para: {session_id}")
        return False

    async def start_monitor(self):
        """NÃO monitora"""
        self.is_running = False
        logger.info("🚫 Monitor de unificação desabilitado")

    async def stop_monitor(self):
        """Para monitor (que nem está rodando)"""
        self.is_running = False

# Função para compatibilidade
def init_unified_manager():
    """Retorna gerenciador vazio"""
    return UnifiedSessionManager()

def stop_unified_manager():
    """Não faz nada"""
    pass

def get_unified_manager():
    """Retorna None"""
    return None