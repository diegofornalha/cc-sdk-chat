#!/bin/bash

echo "=========================================="
echo "Iniciando Suthub Claude SDK Chat"
echo "=========================================="
echo ""

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Por favor, instale o Docker primeiro."
    exit 1
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
    exit 1
fi

# Parar containers existentes se estiverem rodando
echo "🔄 Parando containers existentes..."
docker-compose down

# Construir as imagens
echo ""
echo "🔨 Construindo imagens Docker..."
docker-compose build

# Iniciar os containers
echo ""
echo "🚀 Iniciando containers..."
docker-compose up -d

# Aguardar os serviços iniciarem
echo ""
echo "⏳ Aguardando serviços iniciarem..."
sleep 5

# Verificar status dos containers
echo ""
echo "📊 Status dos containers:"
docker-compose ps

# Verificar logs da API
echo ""
echo "📝 Últimas linhas do log da API:"
docker-compose logs --tail=10 api

# Verificar logs do Frontend
echo ""
echo "📝 Últimas linhas do log do Frontend:"
docker-compose logs --tail=10 frontend

# Executar o script do Caddy para adicionar o domínio
echo ""
echo "🌐 Configurando domínio no Caddy..."
if [ -f "./add_suthub_domain.sh" ]; then
    sudo ./add_suthub_domain.sh
else
    echo "⚠️  Script de configuração do Caddy não encontrado. Configure manualmente."
fi

echo ""
echo "=========================================="
echo "✅ Suthub iniciado com sucesso!"
echo "=========================================="
echo ""
echo "📍 URLs de acesso:"
echo "   - Frontend local: http://localhost:3040"
echo "   - API local: http://localhost:8989"
echo "   - Domínio: https://suthub.agentesintegrados.com"
echo ""
echo "💡 Comandos úteis:"
echo "   - Ver logs: docker-compose logs -f"
echo "   - Parar: docker-compose down"
echo "   - Reiniciar: docker-compose restart"
echo "   - Status: docker-compose ps"
echo ""