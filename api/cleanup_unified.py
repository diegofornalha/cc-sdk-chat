#!/usr/bin/env python3
"""
Limpa o arquivo unificado web removendo sessões do terminal que foram incorretamente unificadas
"""

import json
from pathlib import Path
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UNIFIED_WEB_ID = "00000000-0000-0000-0000-000000000001"
UNIFIED_FILE = Path(f"/Users/2a/.claude/projects/-Users-2a--claude-cc-sdk-chat-api/{UNIFIED_WEB_ID}.jsonl")
BACKUP_DIR = Path("/Users/2a/.claude/cc-sdk-chat/api/backups")

def backup_file(file_path: Path) -> Path:
    """Cria backup do arquivo antes de limpar"""
    BACKUP_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"{file_path.stem}_backup_{timestamp}.jsonl"

    if file_path.exists():
        with open(file_path, 'r', encoding='utf-8') as src:
            with open(backup_path, 'w', encoding='utf-8') as dst:
                dst.write(src.read())

    logger.info(f"✅ Backup criado: {backup_path}")
    return backup_path

def is_terminal_entry(entry: dict) -> bool:
    """Verifica se é uma entrada do terminal que foi unificada"""
    # Verifica campos que indicam unificação automática
    if entry.get("originalSession"):
        return True
    if entry.get("unified_at"):
        return True
    if entry.get("source") == "claude_code_auto":
        return True

    # Se o sessionId é diferente do ID web e tem outros indicadores
    session_id = entry.get("sessionId", "")
    if session_id and session_id != UNIFIED_WEB_ID:
        # Mas só se tem outros campos suspeitos
        if any(key in entry for key in ["originalSession", "unified_at", "source"]):
            return True

    return False

def cleanup_unified_file():
    """Remove entradas do terminal do arquivo web unificado"""
    if not UNIFIED_FILE.exists():
        logger.error(f"❌ Arquivo não encontrado: {UNIFIED_FILE}")
        return

    # Faz backup primeiro
    backup_path = backup_file(UNIFIED_FILE)

    # Lê todas as entradas
    all_entries = []
    terminal_entries = []
    web_entries = []

    try:
        with open(UNIFIED_FILE, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if line.strip():
                    try:
                        entry = json.loads(line)
                        all_entries.append(entry)

                        # Classifica a entrada
                        if is_terminal_entry(entry):
                            terminal_entries.append(entry)
                        else:
                            web_entries.append(entry)

                    except json.JSONDecodeError as e:
                        logger.warning(f"⚠️ Linha {line_num} ignorada (JSON inválido): {e}")

    except Exception as e:
        logger.error(f"❌ Erro ao ler arquivo: {e}")
        return

    # Mostra estatísticas
    logger.info(f"\n📊 Estatísticas do arquivo:")
    logger.info(f"   Total de entradas: {len(all_entries)}")
    logger.info(f"   Entradas web originais: {len(web_entries)}")
    logger.info(f"   Entradas terminal unificadas: {len(terminal_entries)}")

    if terminal_entries:
        # Mostra algumas entradas do terminal que serão removidas
        logger.info(f"\n🗑️ Removendo {len(terminal_entries)} entradas do terminal:")
        sessions_found = set()
        for entry in terminal_entries[:5]:  # Mostra até 5 exemplos
            orig_session = entry.get("originalSession", entry.get("sessionId", "unknown"))
            if orig_session not in sessions_found:
                sessions_found.add(orig_session)
                logger.info(f"   - Sessão: {orig_session}")

        # Reescreve o arquivo apenas com entradas web
        with open(UNIFIED_FILE, 'w', encoding='utf-8') as f:
            for entry in web_entries:
                json.dump(entry, f, ensure_ascii=False)
                f.write('\n')

        logger.info(f"\n✅ Arquivo limpo! Mantidas {len(web_entries)} entradas web originais")
        logger.info(f"💾 Backup disponível em: {backup_path}")

        # Salva entradas do terminal em arquivo separado para referência
        terminal_file = BACKUP_DIR / f"terminal_entries_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
        with open(terminal_file, 'w', encoding='utf-8') as f:
            for entry in terminal_entries:
                json.dump(entry, f, ensure_ascii=False)
                f.write('\n')
        logger.info(f"📄 Entradas do terminal salvas em: {terminal_file}")

    else:
        logger.info("\n✅ Arquivo já está limpo! Nenhuma entrada do terminal encontrada.")

    return len(terminal_entries)

def main():
    """Executa limpeza"""
    logger.info("🧹 Iniciando limpeza do arquivo web unificado...")
    logger.info(f"📁 Arquivo: {UNIFIED_FILE}")

    removed = cleanup_unified_file()

    if removed and removed > 0:
        logger.info(f"\n🎉 Limpeza concluída! {removed} entradas do terminal removidas.")
        logger.info("💡 Para evitar futuras unificações:")
        logger.info("   1. O interceptador foi criado em session_interceptor.py")
        logger.info("   2. Configure o hook claude_code_hook.py no Claude Code")
        logger.info("   3. A API agora bloqueia tentativas de unificação")
    else:
        logger.info("\n✨ Arquivo já estava limpo!")

if __name__ == "__main__":
    main()