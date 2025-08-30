#!/bin/bash
# Script para iniciar API e Frontend

echo "Iniciando servidores do cc-sdk-chat..."

# Mata processos antigos
echo "Parando servidores antigos..."
pkill -f "python3.*server.py" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 2

# Inicia API
echo "Iniciando API na porta 8990..."
cd /home/suthub/.claude/api-claude-code-app/cc-sdk-chat/api
python3 server.py &
API_PID=$!
echo "API iniciada com PID: $API_PID"

# Aguarda API iniciar
sleep 3

# Inicia Frontend
echo "Iniciando Frontend na porta 3040..."
cd /home/suthub/.claude/api-claude-code-app/cc-sdk-chat/chat
npm run dev &
FRONTEND_PID=$!
echo "Frontend iniciado com PID: $FRONTEND_PID"

echo ""
echo "Servidores iniciados!"
echo "API: http://localhost:8990"
echo "Frontend: http://localhost:3040"
echo ""
echo "Para parar os servidores, use: pkill -f server.py && pkill -f next-server"

# Mantém script rodando
wait