#!/bin/bash
# Test completo do fluxo da interface

echo "╔════════════════════════════════════════╗"
echo "║   🧪 TESTE DO FLUXO DA INTERFACE       ║"
echo "╚════════════════════════════════════════╝"

# 1. Simular criação de sessão temporária (como a interface faz)
TEMP_SESSION="temp-$(date +%s)-test123"
echo -e "\n1️⃣ Simulando sessão temporária da interface:"
echo "   Session ID temporário: $TEMP_SESSION"

# 2. Enviar mensagem com sessão temporária
echo -e "\n2️⃣ Enviando mensagem com sessão temporária..."

# Fazer request e capturar resposta
RESPONSE=$(curl -s -X POST http://localhost:8990/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Teste de migração de sessão temporária\", \"session_id\": \"$TEMP_SESSION\"}" \
  2>&1)

# Extrair session_id real da resposta
REAL_SESSION_ID=$(echo "$RESPONSE" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)
WAS_MIGRATED=$(echo "$RESPONSE" | grep -o '"migrated":true' | wc -l)

echo "   ✅ Resposta recebida"

# 3. Verificar migração
echo -e "\n3️⃣ Verificando resultado da migração:"
echo "   ├─ Sessão temporária enviada: $TEMP_SESSION"
echo "   ├─ Sessão real retornada: $REAL_SESSION_ID"

if [ "$REAL_SESSION_ID" != "$TEMP_SESSION" ]; then
    echo "   └─ ✅ MIGRAÇÃO DETECTADA!"
    echo ""
    echo "🎉 SUCESSO! Interface deve mostrar:"
    echo "   Sessão: ${REAL_SESSION_ID: -8}"
    
    # 4. Validar sessão migrada
    echo -e "\n4️⃣ Validando sessão real..."
    VALIDATION=$(curl -s http://localhost:8990/api/validate-session/$REAL_SESSION_ID)
    IS_VALID=$(echo $VALIDATION | grep -o '"valid":true' | wc -l)
    
    if [ $IS_VALID -gt 0 ]; then
        echo "   ✅ Sessão real válida!"
    else
        echo "   ⚠️ Sessão não validada"
    fi
else
    echo "   └─ ❌ MIGRAÇÃO FALHOU!"
    echo ""
    echo "⚠️ ERRO: Interface continuará mostrando sessão temporária!"
fi

echo -e "\n╚════════════════════════════════════════╝"