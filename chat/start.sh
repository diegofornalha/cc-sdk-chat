#!/bin/bash

echo "🚀 Iniciando Claude Chat Frontend..."
echo "====================================="

# Garante que estamos no diretório correto
cd /home/codable/Claudable/cc-sdk-chat/chat

# Verifica se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

echo "✅ Iniciando servidor de desenvolvimento na porta 3020..."
echo "🌐 Acesse: http://localhost:3020"
echo "====================================="

# Inicia o servidor
npm run dev