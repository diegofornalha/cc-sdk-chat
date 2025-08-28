#!/bin/bash

# Script de deployment para produção com Docker

set -e  # Para em caso de erro

echo "🚀 CC-SDK-Chat Docker Deployment"
echo "================================"

# Verifica se .env existe
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    echo "⚠️  Por favor, edite o arquivo .env com suas configurações"
    exit 1
fi

# Menu de opções
echo ""
echo "Escolha uma opção:"
echo "1) Build e iniciar todos os containers"
echo "2) Apenas iniciar containers (sem rebuild)"
echo "3) Parar todos os containers"
echo "4) Ver logs da API"
echo "5) Ver logs do Frontend"
echo "6) Rebuild apenas API"
echo "7) Rebuild apenas Frontend"
echo "8) Deploy de produção com Nginx"
echo "9) Remover todos os containers e volumes"
echo "0) Sair"

read -p "Opção: " option

case $option in
    1)
        echo "🔨 Building e iniciando containers..."
        docker-compose build
        docker-compose up -d
        echo "✅ Containers iniciados!"
        echo ""
        echo "📍 Acesse:"
        echo "   Frontend: http://localhost:3040"
        echo "   API: http://localhost:8989"
        echo "   API Docs: http://localhost:8989/docs"
        ;;
    
    2)
        echo "▶️ Iniciando containers..."
        docker-compose up -d
        echo "✅ Containers iniciados!"
        ;;
    
    3)
        echo "⏹️ Parando containers..."
        docker-compose down
        echo "✅ Containers parados!"
        ;;
    
    4)
        echo "📋 Logs da API (Ctrl+C para sair):"
        docker-compose logs -f api
        ;;
    
    5)
        echo "📋 Logs do Frontend (Ctrl+C para sair):"
        docker-compose logs -f frontend
        ;;
    
    6)
        echo "🔨 Rebuild da API..."
        docker-compose build api
        docker-compose up -d api
        echo "✅ API atualizada!"
        ;;
    
    7)
        echo "🔨 Rebuild do Frontend..."
        docker-compose build frontend
        docker-compose up -d frontend
        echo "✅ Frontend atualizado!"
        ;;
    
    8)
        echo "🚀 Deploy de produção com Nginx..."
        docker-compose --profile production up -d
        echo "✅ Produção iniciada!"
        echo "📍 Acesse: http://localhost (porta 80)"
        ;;
    
    9)
        read -p "⚠️  Tem certeza? Isso removerá TODOS os dados! (y/N): " confirm
        if [ "$confirm" = "y" ]; then
            docker-compose down -v
            echo "✅ Todos os containers e volumes removidos!"
        fi
        ;;
    
    0)
        echo "👋 Até logo!"
        exit 0
        ;;
    
    *)
        echo "❌ Opção inválida!"
        exit 1
        ;;
esac

echo ""
echo "🎯 Status dos containers:"
docker-compose ps