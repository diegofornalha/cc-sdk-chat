#!/bin/bash

# Script para parar o sistema gracefully

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Parando Claude Chat System...${NC}"

# Para API
if [ -f .api.pid ]; then
    API_PID=$(cat .api.pid)
    if ps -p $API_PID > /dev/null; then
        echo -e "${YELLOW}Parando API (PID: $API_PID)...${NC}"
        kill -TERM $API_PID
        sleep 2
        echo -e "${GREEN}✓ API parada${NC}"
    fi
    rm .api.pid
fi

# Para Frontend
if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null; then
        echo -e "${YELLOW}Parando Frontend (PID: $FRONTEND_PID)...${NC}"
        kill -TERM $FRONTEND_PID
        sleep 2
        echo -e "${GREEN}✓ Frontend parado${NC}"
    fi
    rm .frontend.pid
fi

# Limpa processos órfãos se existirem
echo -e "${YELLOW}Verificando processos órfãos...${NC}"

# Busca processos do uvicorn
UVICORN_PIDS=$(ps aux | grep "uvicorn server:app" | grep -v grep | awk '{print $2}')
if [ ! -z "$UVICORN_PIDS" ]; then
    echo -e "${YELLOW}Encontrados processos uvicorn órfãos, encerrando...${NC}"
    echo $UVICORN_PIDS | xargs kill -TERM 2>/dev/null || true
fi

# Busca processos do next
NEXT_PIDS=$(ps aux | grep "next dev" | grep -v grep | awk '{print $2}')
if [ ! -z "$NEXT_PIDS" ]; then
    echo -e "${YELLOW}Encontrados processos Next.js órfãos, encerrando...${NC}"
    echo $NEXT_PIDS | xargs kill -TERM 2>/dev/null || true
fi

echo -e "${GREEN}✅ Sistema parado com sucesso!${NC}"