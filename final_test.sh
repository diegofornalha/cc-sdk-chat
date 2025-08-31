#!/bin/bash

echo "╔════════════════════════════════════════════════════╗"
echo "║     TESTE FINAL - MIGRAÇÃO DE SESSÃO              ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# 1. Verificar serviços
echo "1️⃣  Verificando serviços..."
BACKEND_CHECK=$(curl -s http://localhost:8990/api/health 2>/dev/null || echo "OFFLINE")
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3040 2>/dev/null)

if [[ "$BACKEND_CHECK" == *"healthy"* ]] || [[ "$BACKEND_CHECK" == *"ok"* ]] || [[ "$BACKEND_CHECK" != "OFFLINE" ]]; then
    echo "   ✅ Backend: ONLINE (porta 8990)"
else
    echo "   ❌ Backend: OFFLINE"
    echo "   Iniciando backend..."
    cd /home/suthub/.claude/api-claude-code-app/cc-sdk-chat
    python api/server.py > /dev/null 2>&1 &
    sleep 3
fi

if [ "$FRONTEND_CHECK" == "200" ]; then
    echo "   ✅ Frontend: ONLINE (porta 3040)"
else
    echo "   ⚠️  Frontend: Status $FRONTEND_CHECK"
fi

# 2. Verificar sessões disponíveis
echo ""
echo "2️⃣  Sessões disponíveis no sistema:"
SESSIONS=$(curl -s http://localhost:8990/api/real-sessions 2>/dev/null)
if [ $? -eq 0 ]; then
    SESSION_COUNT=$(echo "$SESSIONS" | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])" 2>/dev/null)
    echo "   📊 Total: $SESSION_COUNT sessões"
    echo "$SESSIONS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, session in enumerate(data['sessions'][:3]):
    print(f'      • {session}')
if len(data['sessions']) > 3:
    print(f'      ... e mais {len(data[\"sessions\"]) - 3} sessões')
" 2>/dev/null
else
    echo "   ❌ Erro ao verificar sessões"
fi

# 3. Testar criação de nova sessão
echo ""
echo "3️⃣  Testando criação de nova sessão via API..."
RESPONSE=$(curl -s -X POST http://localhost:8990/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "Teste final de migração", "session_id": null}' \
    2>/dev/null | head -100)

SESSION_ID=$(echo "$RESPONSE" | grep -o '"session_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$SESSION_ID" ]; then
    echo "   ✅ Session ID recebido: $SESSION_ID"
    
    # Validar UUID
    if [[ $SESSION_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
        echo "   ✅ UUID válido"
    else
        echo "   ❌ UUID inválido"
    fi
else
    echo "   ❌ Nenhum session_id retornado"
fi

# 4. URLs de acesso
echo ""
echo "4️⃣  URLs para teste manual:"
echo "   🌐 Frontend: http://localhost:3040/"
echo "   🧪 Teste: http://localhost:3040/test-migration.html"
echo "   📊 API: http://localhost:8990/api/real-sessions"

# 5. Resumo
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║                    RESUMO                         ║"
echo "╚════════════════════════════════════════════════════╝"

if [ -n "$SESSION_ID" ] && [[ $SESSION_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
    echo "✅ Sistema funcionando corretamente!"
    echo "   • Backend retorna session_id real: $SESSION_ID"
    echo "   • Frontend deve migrar automaticamente de temp-* para UUID"
    echo ""
    echo "📝 Para testar manualmente:"
    echo "   1. Acesse http://localhost:3040/"
    echo "   2. Digite uma mensagem"
    echo "   3. Verifique no console do navegador (F12)"
    echo "   4. Interface deve mostrar sessão real, não temp-*"
else
    echo "❌ Problemas detectados no sistema"
    echo "   Verifique os logs para mais detalhes"
fi

echo ""
echo "════════════════════════════════════════════════════"