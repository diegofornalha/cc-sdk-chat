#!/bin/bash
# Script para iniciar o monitor unificado de sessões

echo "🚀 Iniciando Monitor Unificado de Sessões..."
echo "📅 $(date)"
echo "============================================"

# Diretório base
API_DIR="$(cd "$(dirname "$0")" && pwd)"

# Verifica se já está rodando
if pgrep -f "unified_session_manager.py" > /dev/null; then
    echo "⚠️  Monitor já está em execução!"
    echo "Use 'pkill -f unified_session_manager.py' para parar"
    exit 1
fi

# Inicia o monitor em background
cd "$API_DIR"
nohup python3 unified_session_manager.py > unified_monitor.log 2>&1 &
MONITOR_PID=$!

echo "✅ Monitor iniciado com PID: $MONITOR_PID"
echo "📝 Logs em: $API_DIR/unified_monitor.log"
echo ""
echo "Para parar o monitor:"
echo "  kill $MONITOR_PID"
echo ""
echo "Para ver os logs:"
echo "  tail -f $API_DIR/unified_monitor.log"

# Salva PID para referência
echo $MONITOR_PID > "$API_DIR/unified_monitor.pid"

exit 0