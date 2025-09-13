#!/usr/bin/env python3
"""
Gerenciador Unificado de Sessões
Combina todas as funcionalidades dos monitores de sessão em um único módulo
"""

import os
import json
import time
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set
# Removido watchdog - usando abordagem assíncrona pura
import logging

# Configuração de logging
logger = logging.getLogger(__name__)

# Session ID unificado
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"
PROJECT_NAME = "-Users-2a--claude-cc-sdk-chat-api"


class UnifiedSessionManager:
    """Gerenciador central para todas as operações de sessão unificada"""

    def __init__(self, project_path: Optional[str] = None):
        """Inicializa o gerenciador de sessões unificadas"""
        if project_path:
            self.project_path = Path(project_path)
        else:
            # Detecta automaticamente o diretório do projeto
            self.project_path = Path.home() / ".claude" / "projects" / PROJECT_NAME

        self.unified_file = self.project_path / f"{UNIFIED_SESSION_ID}.jsonl"
        self.last_processed: Dict[str, int] = {}
        self.processing_files: Set[str] = set()
        self.monitor_task: Optional[asyncio.Task] = None
        self.is_running = False

        # Garante que diretório existe
        self.project_path.mkdir(parents=True, exist_ok=True)

        # Garante que arquivo unificado existe
        if not self.unified_file.exists():
            self.unified_file.touch()
            logger.info(f"✨ Criado arquivo unificado: {self.unified_file.name}")

    def consolidate_existing_files(self) -> int:
        """Consolida todos os arquivos existentes no arquivo unificado"""
        logger.info("🔄 Iniciando consolidação de arquivos existentes...")

        # IMPORTANTE: NÃO consolida mais! Mantém sessões separadas
        logger.info("  ℹ️ Modo de sessões independentes ativado")
        logger.info("  📁 Sessão web: 00000000-0000-0000-0000-000000000001")
        logger.info("  💻 Sessões terminal: mantidas separadas")
        return 0

        # Código antigo comentado para referência
        # Lista todos os arquivos JSONL exceto o unificado
        other_files = [
            f for f in self.project_path.glob("*.jsonl")
            if f.name != f"{UNIFIED_SESSION_ID}.jsonl"
        ]

        if not other_files:
            logger.info("  ✅ Nenhum arquivo extra encontrado")
            return 0

        # Coleta todas as entradas existentes
        all_entries = []

        # Primeiro, lê o arquivo unificado se existir
        if self.unified_file.exists():
            try:
                with open(self.unified_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            try:
                                data = json.loads(line)
                                all_entries.append(data)
                            except json.JSONDecodeError:
                                pass
            except Exception as e:
                logger.error(f"Erro ao ler arquivo unificado: {e}")

        # Depois, processa os outros arquivos
        for file in other_files:
            logger.info(f"  📄 Processando: {file.name}")
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            try:
                                data = json.loads(line)
                                # Força session ID unificado
                                data['sessionId'] = UNIFIED_SESSION_ID
                                all_entries.append(data)
                            except json.JSONDecodeError:
                                pass

                # Deleta arquivo após processar
                file.unlink()
                logger.info(f"  🗑️  Deletado: {file.name}")
            except Exception as e:
                logger.error(f"  ❌ Erro ao processar {file.name}: {e}")

        # Ordena por timestamp
        all_entries.sort(key=lambda x: x.get('timestamp', ''))

        # Reescreve arquivo unificado
        try:
            with open(self.unified_file, 'w', encoding='utf-8') as f:
                for entry in all_entries:
                    f.write(json.dumps(entry) + '\n')
        except Exception as e:
            logger.error(f"Erro ao escrever arquivo unificado: {e}")
            return 0

        logger.info(f"✅ Consolidadas {len(all_entries)} entradas em {UNIFIED_SESSION_ID}.jsonl")
        return len(all_entries)

    def sync_file_to_unified(self, source_file: Path) -> int:
        """Sincroniza conteúdo de um arquivo para o arquivo unificado"""
        if str(source_file) in self.processing_files:
            return 0

        self.processing_files.add(str(source_file))
        lines_added = 0

        try:
            # Aguarda arquivo estabilizar
            time.sleep(0.1)

            # Lê linhas novas do arquivo
            current_size = source_file.stat().st_size
            last_size = self.last_processed.get(str(source_file), 0)

            if current_size > last_size:
                with open(source_file, 'r', encoding='utf-8') as f:
                    f.seek(last_size)
                    new_content = f.read()

                if new_content.strip():
                    # Processa e adiciona ao arquivo unificado
                    with open(self.unified_file, 'a', encoding='utf-8') as f:
                        for line in new_content.split('\n'):
                            if line.strip():
                                try:
                                    data = json.loads(line)
                                    data['sessionId'] = UNIFIED_SESSION_ID
                                    f.write(json.dumps(data) + '\n')
                                    lines_added += 1
                                except json.JSONDecodeError:
                                    pass

                    logger.info(f"  ✅ Sincronizadas {lines_added} linhas de {source_file.name}")

                self.last_processed[str(source_file)] = current_size

        except Exception as e:
            logger.error(f"  ❌ Erro ao sincronizar {source_file.name}: {e}")
        finally:
            self.processing_files.discard(str(source_file))

        return lines_added

    async def monitor_async(self) -> None:
        """Monitor assíncrono - agora apenas observa, não consolida"""
        logger.info(f"🔍 Monitorando: {self.project_path}")
        logger.info(f"📌 Modo: Sessões Independentes")
        logger.info(f"  🌐 Web: 00000000-0000-0000-0000-000000000001.jsonl")
        logger.info(f"  💻 Terminal: arquivos com UUID próprio")

        while self.is_running:
            try:
                # Apenas monitora e reporta, não consolida mais
                jsonl_files = list(self.project_path.glob("*.jsonl"))

                web_session = None
                terminal_sessions = []

                for jsonl_file in jsonl_files:
                    if jsonl_file.name == f"{UNIFIED_SESSION_ID}.jsonl":
                        web_session = jsonl_file
                    else:
                        terminal_sessions.append(jsonl_file)

                # Log periódico do status (a cada 30 segundos)
                if int(time.time()) % 30 == 0:
                    logger.info(f"📊 Status: 1 sessão web, {len(terminal_sessions)} sessões terminal")

                await asyncio.sleep(0.5)  # Verifica a cada 500ms

            except Exception as e:
                logger.error(f"❌ Erro no monitor assíncrono: {e}")
                await asyncio.sleep(1)

    async def start(self) -> None:
        """Inicia o gerenciador de sessões unificadas"""
        if self.is_running:
            logger.warning("Monitor já está em execução")
            return

        logger.info("=" * 60)
        logger.info("🚀 Iniciando Gerenciador Unificado de Sessões")
        logger.info(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 60)

        # Consolidação inicial
        total_consolidated = self.consolidate_existing_files()

        # Inicia monitoramento
        self.is_running = True
        self.monitor_task = asyncio.create_task(self.monitor_async())

        logger.info("👀 Monitoramento iniciado com sucesso")

    async def stop(self) -> None:
        """Para o gerenciador de sessões"""
        if not self.is_running:
            return

        logger.info("⏹️ Parando monitor de sessões...")
        self.is_running = False

        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass

        logger.info("✅ Monitor de sessões parado")

    def get_stats(self) -> Dict:
        """Retorna estatísticas do monitoramento"""
        unified_size = 0
        unified_lines = 0

        if self.unified_file.exists():
            unified_size = self.unified_file.stat().st_size
            try:
                with open(self.unified_file, 'r', encoding='utf-8') as f:
                    unified_lines = sum(1 for _ in f)
            except:
                pass

        return {
            "project_path": str(self.project_path),
            "unified_file": str(self.unified_file),
            "unified_size_bytes": unified_size,
            "unified_size_mb": round(unified_size / (1024 * 1024), 2),
            "unified_lines": unified_lines,
            "monitored_files": len(self.last_processed),
            "is_running": self.is_running
        }

    def force_consolidate_file(self, source_file: Path) -> bool:
        """Força consolidação completa de um arquivo e o deleta"""
        try:
            if not source_file.exists():
                return False

            lines_moved = []
            with open(source_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try:
                            data = json.loads(line)
                            data['sessionId'] = UNIFIED_SESSION_ID
                            lines_moved.append(json.dumps(data) + '\n')
                        except json.JSONDecodeError:
                            pass

            if lines_moved:
                with open(self.unified_file, 'a', encoding='utf-8') as f:
                    f.writelines(lines_moved)

                logger.info(f"✅ Movidas {len(lines_moved)} linhas de {source_file.name}")

            # Deleta arquivo original
            source_file.unlink()
            logger.info(f"🗑️ Arquivo {source_file.name} deletado")

            return True

        except Exception as e:
            logger.error(f"❌ Erro ao consolidar {source_file.name}: {e}")
            return False


# Removida classe FileWatchHandler - usando monitoramento assíncrono direto


# Singleton global do gerenciador
_manager_instance: Optional[UnifiedSessionManager] = None


async def get_unified_manager() -> UnifiedSessionManager:
    """Obtém instância singleton do gerenciador unificado"""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = UnifiedSessionManager()
    return _manager_instance


async def init_unified_manager() -> UnifiedSessionManager:
    """Inicializa e inicia o gerenciador unificado"""
    manager = await get_unified_manager()
    await manager.start()
    return manager


async def stop_unified_manager() -> None:
    """Para o gerenciador unificado se estiver rodando"""
    global _manager_instance
    if _manager_instance:
        await _manager_instance.stop()


# CLI para execução standalone
async def main():
    """Execução standalone do monitor"""
    import signal

    manager = await init_unified_manager()

    # Handler para shutdown graceful
    def signal_handler(sig, frame):
        logger.info("\n🛑 Recebido sinal de interrupção...")
        asyncio.create_task(stop_unified_manager())

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # Mantém rodando
        while manager.is_running:
            await asyncio.sleep(1)

            # Opcionalmente mostra estatísticas periodicamente
            if int(time.time()) % 30 == 0:  # A cada 30 segundos
                stats = manager.get_stats()
                logger.info(f"📊 Stats: {stats['unified_lines']} linhas, {stats['unified_size_mb']} MB")

    except KeyboardInterrupt:
        pass
    finally:
        await stop_unified_manager()
        logger.info("✅ Monitor encerrado com sucesso")


if __name__ == "__main__":
    # Configura logging para execução standalone
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Executa monitor
    asyncio.run(main())