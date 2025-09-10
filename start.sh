#!/bin/bash

# Script inteligente de inicialização do sistema
# Detecta portas disponíveis e configura automaticamente

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando Claude Chat System...${NC}"

# Carrega variáveis de ambiente se existirem
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo -e "${GREEN}✓ Variáveis de ambiente carregadas de .env.local${NC}"
fi

# Define portas padrão ou usa as do ambiente
API_PORT=${NEXT_PUBLIC_API_PORT:-8990}
FRONTEND_PORT=${NEXT_PUBLIC_FRONTEND_PORT:-3082}

# Função para verificar se porta está disponível
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Função para encontrar porta livre próxima
find_free_port() {
    local start_port=$1
    local port=$start_port
    
    while ! check_port $port; do
        echo -e "${YELLOW}⚠️  Porta $port em uso, tentando próxima...${NC}"
        port=$((port + 1))
        
        # Evita loop infinito
        if [ $port -gt $((start_port + 100)) ]; then
            echo -e "${RED}❌ Não foi possível encontrar porta livre${NC}"
            exit 1
        fi
    done
    
    echo $port
}

# Verifica e ajusta porta da API
if ! check_port $API_PORT; then
    echo -e "${YELLOW}⚠️  Porta $API_PORT da API está em uso${NC}"
    
    # Pergunta ao usuário o que fazer
    echo "Opções:"
    echo "1) Matar processo na porta $API_PORT"
    echo "2) Usar porta alternativa"
    echo "3) Cancelar"
    read -p "Escolha [1-3]: " choice
    
    case $choice in
        1)
            echo -e "${YELLOW}Encerrando processo na porta $API_PORT...${NC}"
            lsof -i :$API_PORT | tail -n +2 | awk '{print $2}' | xargs kill -TERM 2>/dev/null || true
            sleep 2
            ;;
        2)
            API_PORT=$(find_free_port $API_PORT)
            echo -e "${GREEN}✓ Usando porta alternativa $API_PORT para API${NC}"
            
            # Atualiza .env.local
            sed -i "" "s/NEXT_PUBLIC_API_PORT=.*/NEXT_PUBLIC_API_PORT=$API_PORT/" .env.local
            ;;
        3)
            echo -e "${RED}Cancelado pelo usuário${NC}"
            exit 0
            ;;
    esac
fi

# Verifica e ajusta porta do Frontend
if ! check_port $FRONTEND_PORT; then
    echo -e "${YELLOW}⚠️  Porta $FRONTEND_PORT do frontend está em uso${NC}"
    
    echo "Opções:"
    echo "1) Matar processo na porta $FRONTEND_PORT"
    echo "2) Usar porta alternativa"
    echo "3) Cancelar"
    read -p "Escolha [1-3]: " choice
    
    case $choice in
        1)
            echo -e "${YELLOW}Encerrando processo na porta $FRONTEND_PORT...${NC}"
            lsof -i :$FRONTEND_PORT | tail -n +2 | awk '{print $2}' | xargs kill -TERM 2>/dev/null || true
            sleep 2
            ;;
        2)
            FRONTEND_PORT=$(find_free_port $FRONTEND_PORT)
            echo -e "${GREEN}✓ Usando porta alternativa $FRONTEND_PORT para frontend${NC}"
            
            # Atualiza .env.local
            sed -i "" "s/NEXT_PUBLIC_FRONTEND_PORT=.*/NEXT_PUBLIC_FRONTEND_PORT=$FRONTEND_PORT/" .env.local
            ;;
        3)
            echo -e "${RED}Cancelado pelo usuário${NC}"
            exit 0
            ;;
    esac
fi

# Atualiza variáveis de ambiente para os processos
export NEXT_PUBLIC_API_PORT=$API_PORT
export NEXT_PUBLIC_FRONTEND_PORT=$FRONTEND_PORT
export NEXT_PUBLIC_API_URL="http://localhost:$API_PORT"

echo -e "${GREEN}📍 Configuração:${NC}"
echo -e "   API: http://localhost:${API_PORT}"
echo -e "   Frontend: http://localhost:${FRONTEND_PORT}"

# Inicia API
echo -e "${YELLOW}🔧 Iniciando API na porta $API_PORT...${NC}"
cd api
source ../.venv/bin/activate
nohup uvicorn server:app --host 127.0.0.1 --port $API_PORT --reload > ../logs/api.log 2>&1 &
API_PID=$!
cd ..

# Aguarda API iniciar
sleep 3

# Verifica se API iniciou
if curl -s http://localhost:$API_PORT/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API iniciada com sucesso (PID: $API_PID)${NC}"
else
    echo -e "${RED}❌ Falha ao iniciar API${NC}"
    tail -n 20 logs/api.log
    exit 1
fi

# Inicia Frontend
echo -e "${YELLOW}🎨 Iniciando Frontend na porta $FRONTEND_PORT...${NC}"
cd chat
nohup npm run dev -- -p $FRONTEND_PORT > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Aguarda frontend iniciar
sleep 5

# Salva PIDs para shutdown
echo $API_PID > .api.pid
echo $FRONTEND_PID > .frontend.pid

echo -e "${GREEN}✅ Sistema iniciado com sucesso!${NC}"
echo ""
echo -e "${GREEN}🌐 Acesse: http://localhost:${FRONTEND_PORT}${NC}"
echo ""
echo "Para parar o sistema, execute: ./stop.sh"
echo "Para ver logs: tail -f logs/api.log ou tail -f logs/frontend.log"

# Opção de abrir no navegador
read -p "Abrir no navegador? [S/n]: " open_browser
if [[ "$open_browser" != "n" ]]; then
    if command -v xdg-open > /dev/null; then
        xdg-open "http://localhost:${FRONTEND_PORT}"
    elif command -v open > /dev/null; then
        open "http://localhost:${FRONTEND_PORT}"
    fi
fi