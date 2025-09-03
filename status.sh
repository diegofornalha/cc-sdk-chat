#!/bin/bash

# Script para verificar status do sistema

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}📊 Status do Claude Chat System${NC}"
echo "================================"

# Carrega configuração
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

API_PORT=${NEXT_PUBLIC_API_PORT:-8990}
FRONTEND_PORT=${NEXT_PUBLIC_FRONTEND_PORT:-3082}

# Verifica API
echo -n "🔧 API (porta $API_PORT): "
if curl -s http://localhost:$API_PORT/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Online${NC}"
    
    # Testa health detalhado
    HEALTH=$(curl -s http://localhost:$API_PORT/health/detailed | python3 -c "import sys, json; data = json.load(sys.stdin); print(f\"Status: {data.get('status', 'unknown')}\")" 2>/dev/null || echo "Status: erro ao obter")
    echo "   $HEALTH"
else
    echo -e "${RED}✗ Offline${NC}"
fi

# Verifica Frontend
echo -n "🎨 Frontend (porta $FRONTEND_PORT): "
if curl -s http://localhost:$FRONTEND_PORT/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Online${NC}"
else
    echo -e "${RED}✗ Offline${NC}"
fi

echo ""
echo "📝 URLs de Acesso:"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   API: http://localhost:$API_PORT"
echo "   API Docs: http://localhost:$API_PORT/docs"

# Verifica processos
echo ""
echo "🔄 Processos em execução:"

# API Process
API_PROC=$(ps aux | grep "uvicorn server:app" | grep -v grep | head -1)
if [ ! -z "$API_PROC" ]; then
    API_PID=$(echo $API_PROC | awk '{print $2}')
    API_MEM=$(echo $API_PROC | awk '{print $4}')
    echo -e "   API: PID $API_PID (Mem: ${API_MEM}%)"
else
    echo -e "   API: ${RED}Não encontrado${NC}"
fi

# Frontend Process
FRONT_PROC=$(ps aux | grep "next dev" | grep -v grep | head -1)
if [ ! -z "$FRONT_PROC" ]; then
    FRONT_PID=$(echo $FRONT_PROC | awk '{print $2}')
    FRONT_MEM=$(echo $FRONT_PROC | awk '{print $4}')
    echo -e "   Frontend: PID $FRONT_PID (Mem: ${FRONT_MEM}%)"
else
    echo -e "   Frontend: ${RED}Não encontrado${NC}"
fi

# Verifica logs recentes
echo ""
echo "📜 Últimas linhas dos logs:"
if [ -f logs/api.log ]; then
    echo "   API (últimos erros):"
    tail -5 logs/api.log | grep -i error | head -2 || echo "     Sem erros recentes"
fi

if [ -f logs/frontend.log ]; then
    echo "   Frontend (últimos avisos):"
    tail -5 logs/frontend.log | grep -i warn | head -2 || echo "     Sem avisos recentes"
fi