#!/bin/bash

# Script para bloquear completamente a unificação
# Torna o arquivo web somente leitura e cria um link simbólico para /dev/null

UNIFIED_FILE="/Users/2a/.claude/projects/-Users-2a--claude-cc-sdk-chat-api/00000000-0000-0000-0000-000000000001.jsonl"
BACKUP_FILE="/Users/2a/.claude/cc-sdk-chat/api/backups/web_session_protected.jsonl"

echo "🔒 Bloqueando unificação automática do Claude Code..."

# Faz backup do estado atual
if [ -f "$UNIFIED_FILE" ]; then
    cp "$UNIFIED_FILE" "$BACKUP_FILE"
    echo "   💾 Backup criado: $BACKUP_FILE"
fi

# Remove o arquivo atual
rm -f "$UNIFIED_FILE"

# Cria um arquivo vazio
touch "$UNIFIED_FILE"

# Torna o arquivo somente leitura
chmod 444 "$UNIFIED_FILE"

echo "   🔐 Arquivo web agora é somente leitura"
echo "   ✅ Unificação bloqueada!"
echo ""
echo "Para desbloquear, execute:"
echo "   chmod 644 $UNIFIED_FILE"