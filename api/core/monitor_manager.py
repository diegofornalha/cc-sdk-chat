#!/usr/bin/env python3
"""
Gerenciador do Monitor de Sessões
Responsável por inicializar, monitorar e manter o monitor de sessões saudável
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any
import threading
import subprocess
import psutil

# Adiciona o diretório pai ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from monitor_unified_session import UnifiedSessionMonitor

logger = logging.getLogger(__name__)

class MonitorManager:
    """Gerencia o ciclo de vida do monitor de sessões"""
    
    def __init__(self, auto_start: bool = True):
        self.monitor: Optional[UnifiedSessionMonitor] = None
        self.monitor_task: Optional[asyncio.Task] = None
        self.health_check_task: Optional[asyncio.Task] = None
        self.auto_start = auto_start
        self.is_running = False
        self.last_health_check = None
        self.health_status = {
            "status": "stopped",
            "last_check": None,
            "uptime": 0,
            "files_monitored": 0,
            "bytes_processed": 0,
            "errors": [],
            "restarts": 0,
            "last_activity": None
        }
        self.start_time = None
        self.restart_count = 0
        self.max_restart_attempts = 5
        self.restart_cooldown = 30  # segundos
        self.last_restart_time = None
        
    async def start(self) -> bool:
        """Inicia o monitor de sessões"""
        try:
            if self.is_running:
                logger.info("Monitor já está em execução")
                return True
            
            logger.info("Iniciando monitor de sessões...")
            
            # Cria instância do monitor
            self.monitor = UnifiedSessionMonitor()
            
            # Inicia o monitor em background
            self.monitor_task = asyncio.create_task(self._run_monitor())
            
            # Inicia health checks
            self.health_check_task = asyncio.create_task(self._health_check_loop())
            
            self.is_running = True
            self.start_time = datetime.now()
            self.health_status["status"] = "running"
            
            logger.info("✅ Monitor de sessões iniciado com sucesso")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao iniciar monitor: {e}")
            self.health_status["status"] = "error"
            self.health_status["errors"].append({
                "time": datetime.now().isoformat(),
                "error": str(e)
            })
            return False
    
    async def stop(self) -> bool:
        """Para o monitor de sessões"""
        try:
            if not self.is_running:
                logger.info("Monitor já está parado")
                return True
            
            logger.info("Parando monitor de sessões...")
            
            # Cancela tasks
            if self.monitor_task:
                self.monitor_task.cancel()
                try:
                    await self.monitor_task
                except asyncio.CancelledError:
                    pass
            
            if self.health_check_task:
                self.health_check_task.cancel()
                try:
                    await self.health_check_task
                except asyncio.CancelledError:
                    pass
            
            self.is_running = False
            self.health_status["status"] = "stopped"
            
            logger.info("✅ Monitor de sessões parado com sucesso")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao parar monitor: {e}")
            return False
    
    async def restart(self) -> bool:
        """Reinicia o monitor de sessões"""
        try:
            # Verifica cooldown de restart
            if self.last_restart_time:
                time_since_restart = (datetime.now() - self.last_restart_time).total_seconds()
                if time_since_restart < self.restart_cooldown:
                    logger.warning(f"Restart muito frequente. Aguardando {self.restart_cooldown - time_since_restart:.0f}s")
                    return False
            
            # Verifica limite de restarts
            if self.restart_count >= self.max_restart_attempts:
                logger.error(f"Limite de restart atingido ({self.max_restart_attempts})")
                self.health_status["status"] = "failed"
                return False
            
            logger.info(f"Reiniciando monitor (tentativa {self.restart_count + 1}/{self.max_restart_attempts})...")
            
            # Para o monitor
            await self.stop()
            
            # Aguarda um pouco
            await asyncio.sleep(2)
            
            # Reinicia
            success = await self.start()
            
            if success:
                self.restart_count += 1
                self.last_restart_time = datetime.now()
                self.health_status["restarts"] = self.restart_count
                logger.info("✅ Monitor reiniciado com sucesso")
            
            return success
            
        except Exception as e:
            logger.error(f"Erro ao reiniciar monitor: {e}")
            return False
    
    async def _run_monitor(self):
        """Executa o monitor com tratamento de erros"""
        consecutive_errors = 0
        max_consecutive_errors = 5
        
        while self.is_running:
            try:
                # Executa o monitor
                await self.monitor.monitor_and_unify()
                consecutive_errors = 0  # Reset contador de erros
                
            except asyncio.CancelledError:
                logger.info("Monitor cancelado")
                break
                
            except Exception as e:
                consecutive_errors += 1
                logger.error(f"Erro no monitor ({consecutive_errors}/{max_consecutive_errors}): {e}")
                
                self.health_status["errors"].append({
                    "time": datetime.now().isoformat(),
                    "error": str(e)
                })
                
                # Se muitos erros consecutivos, tenta restart
                if consecutive_errors >= max_consecutive_errors:
                    logger.error("Muitos erros consecutivos. Tentando restart...")
                    asyncio.create_task(self.restart())
                    break
                
                # Aguarda antes de tentar novamente
                await asyncio.sleep(5)
    
    async def _health_check_loop(self):
        """Loop de verificação de saúde"""
        while self.is_running:
            try:
                await self._perform_health_check()
                await asyncio.sleep(10)  # Check a cada 10 segundos
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Erro no health check: {e}")
    
    async def _perform_health_check(self):
        """Realiza verificação de saúde do monitor"""
        try:
            now = datetime.now()
            self.last_health_check = now
            
            # Verifica se o monitor existe e está respondendo
            if not self.monitor:
                self.health_status["status"] = "error"
                self.health_status["errors"].append({
                    "time": now.isoformat(),
                    "error": "Monitor não inicializado"
                })
                return
            
            # Obtém estatísticas do monitor
            stats = self.monitor.get_stats()
            
            # Atualiza status de saúde
            self.health_status["last_check"] = now.isoformat()
            self.health_status["files_monitored"] = stats.get("monitored_files", 0)
            self.health_status["bytes_processed"] = stats.get("total_bytes_processed", 0)
            
            # Calcula uptime
            if self.start_time:
                uptime = (now - self.start_time).total_seconds()
                self.health_status["uptime"] = uptime
            
            # Verifica atividade recente
            if stats.get("total_bytes_processed", 0) > 0:
                self.health_status["last_activity"] = now.isoformat()
            
            # Limpa erros antigos (mantém apenas últimos 10)
            if len(self.health_status["errors"]) > 10:
                self.health_status["errors"] = self.health_status["errors"][-10:]
            
            # Determina status geral
            if self.is_running and self.monitor_task and not self.monitor_task.done():
                self.health_status["status"] = "healthy"
            else:
                self.health_status["status"] = "degraded"
                
        except Exception as e:
            logger.error(f"Erro ao verificar saúde: {e}")
            self.health_status["status"] = "error"
    
    def get_health_status(self) -> Dict[str, Any]:
        """Retorna o status de saúde atual"""
        return self.health_status.copy()
    
    async def ensure_running(self):
        """Garante que o monitor está rodando (para auto-start)"""
        if self.auto_start and not self.is_running:
            logger.info("Auto-start habilitado. Iniciando monitor...")
            await self.start()

# Singleton global do gerenciador
_manager_instance: Optional[MonitorManager] = None

def get_monitor_manager() -> MonitorManager:
    """Retorna a instância singleton do gerenciador"""
    global _manager_instance
    if not _manager_instance:
        _manager_instance = MonitorManager(auto_start=True)
    return _manager_instance

async def init_monitor_manager():
    """Inicializa o gerenciador do monitor (para ser chamado no startup)"""
    manager = get_monitor_manager()
    await manager.ensure_running()
    return manager

# CLI para testes
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Gerenciador do Monitor de Sessões")
    parser.add_argument("command", choices=["start", "stop", "restart", "status"],
                       help="Comando a executar")
    
    args = parser.parse_args()
    
    # Configura logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    async def main():
        manager = MonitorManager(auto_start=False)
        
        if args.command == "start":
            success = await manager.start()
            if success:
                print("✅ Monitor iniciado")
                # Mantém rodando
                try:
                    while True:
                        await asyncio.sleep(1)
                except KeyboardInterrupt:
                    await manager.stop()
            else:
                print("❌ Falha ao iniciar monitor")
                
        elif args.command == "stop":
            success = await manager.stop()
            print("✅ Monitor parado" if success else "❌ Falha ao parar monitor")
            
        elif args.command == "restart":
            success = await manager.restart()
            print("✅ Monitor reiniciado" if success else "❌ Falha ao reiniciar monitor")
            
        elif args.command == "status":
            status = manager.get_health_status()
            print(json.dumps(status, indent=2))
    
    asyncio.run(main())