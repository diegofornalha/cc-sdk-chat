# 🐳 Claude Code Docker - Guia Completo de Containerização

## 📋 Índice
- [Visão Geral](#visão-geral)
- [Configurações Implementadas](#configurações-implementadas)
- [Como Funciona](#como-funciona)
- [Instalação](#instalação)
- [Uso](#uso)
- [Troubleshooting](#troubleshooting)
- [Scripts Auxiliares](#scripts-auxiliares)

## 🎯 Visão Geral

Esta documentação descreve a configuração completa do **Claude Code SDK Chat** em containers Docker, com bypass de permissões e execução automatizada.

### Características Principais:
- ✅ **API Backend**: FastAPI com Claude Code SDK (porta 8992)
- ✅ **Frontend**: Next.js com chat em tempo real (porta 3082)
- ✅ **Usuário não-root** (appuser - UID 1002)
- ✅ **Bypass completo de permissões Claude Code**
- ✅ **Sem prompts de confirmação**
- ✅ **Configuração persistente**
- ✅ **Compatível com automação e CI/CD**

## ⚙️ Configurações Implementadas

### 1. Estrutura de Containers

```
┌─────────────────────────────────────┐
│         Claude Code Chat           │
├─────────────────────────────────────┤
│  🚀 API Backend (8992)             │
│  - FastAPI + Claude Code SDK       │
│  - Python 3.11                     │
│  - Usuário: appuser (1002)         │
│                                     │
│  🌐 Frontend (3082)                │
│  - Next.js                         │
│  - Usuário: appuser (1002)         │
│                                     │
│  📊 Nginx Proxy (80) [Opcional]    │
│  - Reverse proxy                   │
└─────────────────────────────────────┘
```

### 2. Variáveis de Ambiente Claude Code

Configuração completa para bypass de permissões:

```bash
CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS=true
CLAUDE_AUTO_APPROVE=true
CLAUDE_TRUST_ALL_DIRECTORIES=true
CLAUDE_AUTO_APPROVE_MCP=true
CLAUDE_BYPASS_PERMISSIONS=true
CLAUDE_NO_PROMPT=true
CLAUDE_DISABLE_TELEMETRY=1
```

### 3. Arquitetura dos Dockerfiles

#### API Backend (api/Dockerfile)
```dockerfile
# Baseado em Python 3.11-slim
FROM python:3.11-slim

# Instala Node.js + Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Cria scripts de bypass
RUN echo 'exec claude --dangerously-skip-permissions "$@"' > /usr/local/bin/claude-bypass

# Usuário não-root (UID 1002)
RUN useradd -m -u 1002 -s /bin/bash appuser

# Configurações Claude Code
RUN echo '{"permissions":{"allow":["*"]}}' > /home/appuser/.claude/settings.local.json

# Porta 8992
EXPOSE 8992
```

#### Frontend (chat/Dockerfile)
```dockerfile
# Multi-stage build com Node.js 18
FROM node:18-alpine

# Build otimizado
RUN npm ci && npm run build

# Usuário não-root
USER nextjs

# Porta 3082
EXPOSE 3082
```

### 4. Docker Compose Configuração

```yaml
version: '3.8'

services:
  api:
    build: ./api
    ports: ["8992:8992"]
    environment:
      - CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS=true
      - CLAUDE_AUTO_APPROVE=true
      # ... todas as configurações de bypass
    volumes:
      - ~/.claude:/home/appuser/.claude
      - ./logs/api:/app/logs
    
  frontend:
    build: ./chat
    ports: ["3082:3082"]
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8992
    depends_on: [api]
```

## 🔧 Como Funciona

### Fluxo de Bypass Claude Code

```
┌─────────────────────────────────────┐
│         Container API               │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Usuário: appuser        │   │
│  │      (UID: 1002)            │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │   /usr/local/bin/           │   │
│  │   ├── claude-bypass         │   │
│  │   └── claude-safe (link)    │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │   settings.local.json       │   │
│  │   {"permissions":           │   │
│  │    {"allow":["*"]}}         │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │    Claude Code CLI          │   │
│  │    (Executa sem prompts)    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Comunicação Entre Containers

```
Frontend (3082) ──HTTP──▶ API (8992) ──Claude SDK──▶ Anthropic
     │                       │
     │                       ├── Sessions Storage
     │                       └── Logs
     │
 Browser ◄────SSE/WebSocket─────┘
```

## 📦 Instalação

### Pré-requisitos
- Docker 24+
- Docker Compose 2+
- Pelo menos 2GB RAM disponível
- 5GB espaço em disco

### Opção 1: Build Completo

```bash
# Clone/navegue para o diretório
cd /home/suthub/.claude/api-claude-code-app/cc-sdk-chat

# Build e inicie os containers
docker compose up -d --build

# Verifique se está rodando
docker ps | grep cc-sdk
```

### Opção 2: Build Seletivo

```bash
# Apenas API
docker compose up -d api --build

# Apenas Frontend
docker compose up -d frontend --build

# Com Nginx Proxy
docker compose --profile proxy up -d --build
```

### Opção 3: Desenvolvimento

```bash
# Com hot reload (volumes de código)
cp .env.example .env.docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## 🚀 Uso

### Comandos Básicos

```bash
# Iniciar serviços
docker compose up -d

# Parar serviços
docker compose down

# Rebuild específico
docker compose up -d api --build

# Ver logs
docker compose logs -f api
docker compose logs -f frontend

# Status dos serviços
docker compose ps
```

### Acessar os Serviços

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Frontend | http://localhost:3082 | Interface do chat |
| API | http://localhost:8992 | Backend API |
| API Docs | http://localhost:8992/docs | Documentação Swagger |
| Healthcheck | http://localhost:8992/ | Status da API |

### Usando Claude Code no Container

```bash
# Acessar container da API
docker exec -it cc-sdk-api bash

# Usar Claude com bypass (todas as formas funcionam)
claude "crie um arquivo hello.py"
claude-safe "liste os arquivos"
cs "execute python hello.py"

# Do host (sem entrar no container)
docker exec cc-sdk-api claude-bypass "crie um script test.sh"
```

### Exemplos Práticos

```bash
# Criar arquivo via Claude no container
docker exec cc-sdk-api claude-bypass "crie um arquivo config.json com configurações da API"

# Analisar código
docker exec cc-sdk-api claude-bypass "analise o arquivo server.py e sugira otimizações"

# Executar comandos do sistema
docker exec cc-sdk-api claude-bypass "mostre o status dos processos Python"

# Gerar documentação
docker exec cc-sdk-api claude-bypass "gere documentação para a API baseada no código"
```

## 🔍 Verificação e Testes

### Health Check dos Serviços

```bash
# Verificar saúde dos containers
docker compose ps

# Teste manual de endpoints
curl http://localhost:8992/
curl http://localhost:3082/

# Logs de healthcheck
docker inspect cc-sdk-api | jq '.[0].State.Health'
```

### Teste Completo do Sistema

```bash
#!/bin/bash
echo "=== Testando Sistema Claude Code Docker ==="

# 1. Verificar containers rodando
echo "1. Containers:"
docker ps --filter name=cc-sdk --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Testar API
echo -e "\n2. Testando API:"
curl -s http://localhost:8992/ | jq .

# 3. Testar criação de sessão
echo -e "\n3. Testando nova sessão:"
SESSION=$(curl -s -X POST http://localhost:8992/api/new-session | jq -r '.session_id')
echo "Session ID: $SESSION"

# 4. Testar Claude Bypass
echo -e "\n4. Testando Claude bypass:"
docker exec cc-sdk-api claude-bypass --version

# 5. Testar Frontend
echo -e "\n5. Testando Frontend:"
curl -s http://localhost:3082/ | head -n 5

echo -e "\n=== Testes concluídos ==="
```

### Monitoramento de Recursos

```bash
# Uso de recursos dos containers
docker stats cc-sdk-api cc-sdk-frontend

# Logs em tempo real
docker compose logs -f --tail=50

# Espaço usado pelos volumes
docker system df
```

## 🛠️ Troubleshooting

### Problema: "EROFS: read-only file system"

**Causa**: Volume montado como somente leitura  
**Solução**: Remover `:ro` do docker-compose.yml:
```yaml
volumes:
  - ~/.claude:/home/appuser/.claude  # Sem :ro
```

### Problema: "Permission denied" em volumes

**Causa**: UID/GID incompatível  
**Solução**: Ajustar UID no Dockerfile:
```bash
# Verificar UID do host
id -u

# No Dockerfile
RUN useradd -m -u $(id -u) -s /bin/bash appuser
```

### Problema: "Claude ainda pede confirmação"

**Causa**: Configurações de bypass não aplicadas  
**Solução**: Verificar variáveis de ambiente:
```bash
docker exec cc-sdk-api env | grep CLAUDE
docker exec cc-sdk-api cat /home/appuser/.claude/settings.local.json
```

### Problema: "Port already in use"

**Causa**: Porta já ocupada no host  
**Solução**: Alterar porta no .env.docker:
```bash
API_PORT=8991
FRONTEND_PORT=3041
```

### Problema: Container não inicia

**Solução**: Verificar logs específicos:
```bash
docker compose logs api
docker compose logs frontend

# Rebuild forçado
docker compose down
docker compose up --build --force-recreate
```

### Problema: Frontend não conecta na API

**Causa**: Configuração de rede incorreta  
**Solução**: Verificar NEXT_PUBLIC_API_URL:
```bash
# Para desenvolvimento local
NEXT_PUBLIC_API_URL=http://localhost:8992

# Para containers Docker
NEXT_PUBLIC_API_URL=http://api:8992
```

## 📁 Scripts Auxiliares

### install-bypass-runtime.sh

Script para instalar bypass em container já rodando:

```bash
#!/bin/bash
CONTAINER_NAME="cc-sdk-api"

echo "=== Instalando Claude Bypass no Container $CONTAINER_NAME ==="

# 1. Criar script claude-bypass
docker exec $CONTAINER_NAME bash -c 'cat > /tmp/claude-bypass << "EOF"
#!/bin/bash
export CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS=true
export CLAUDE_AUTO_APPROVE=true
export CLAUDE_TRUST_ALL_DIRECTORIES=true
export CLAUDE_AUTO_APPROVE_MCP=true
export CLAUDE_BYPASS_PERMISSIONS=true
export CLAUDE_NO_PROMPT=true
export CLAUDE_DISABLE_TELEMETRY=1
exec claude --dangerously-skip-permissions "$@"
EOF'

# 2. Instalar script
docker exec --user root $CONTAINER_NAME bash -c 'mv /tmp/claude-bypass /usr/local/bin/claude-bypass'
docker exec --user root $CONTAINER_NAME bash -c 'chmod +x /usr/local/bin/claude-bypass'

# 3. Criar links
docker exec --user root $CONTAINER_NAME bash -c 'ln -sf /usr/local/bin/claude-bypass /usr/local/bin/claude-safe'

# 4. Configurar settings.local.json
docker exec --user appuser $CONTAINER_NAME bash -c 'mkdir -p /home/appuser/.claude'
docker exec --user appuser $CONTAINER_NAME bash -c 'echo "{\"permissions\":{\"allow\":[\"*\"],\"deny\":[],\"ask\":[]},\"trustWorkspace\":true,\"autoApprove\":true,\"dangerouslySkipPermissions\":true}" > /home/appuser/.claude/settings.local.json'

echo "✅ Bypass instalado com sucesso!"
```

### docker-logs.sh

Script para monitoramento de logs:

```bash
#!/bin/bash
echo "=== Logs do Sistema Claude Code Docker ==="

case "$1" in
  api)
    docker compose logs -f api
    ;;
  frontend)
    docker compose logs -f frontend
    ;;
  all)
    docker compose logs -f
    ;;
  *)
    echo "Uso: $0 {api|frontend|all}"
    echo "Containers disponíveis:"
    docker compose ps --format "table {{.Service}}\t{{.Status}}"
    ;;
esac
```

### docker-backup.sh

Script para backup de dados:

```bash
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "=== Backup Claude Code Docker ==="

# Backup configurações Claude
docker exec cc-sdk-api tar -czf - /home/appuser/.claude > "$BACKUP_DIR/claude-config.tar.gz"

# Backup sessões
docker exec cc-sdk-api tar -czf - /app/sessions > "$BACKUP_DIR/sessions.tar.gz"

# Backup logs
docker compose logs > "$BACKUP_DIR/container-logs.txt"

echo "✅ Backup salvo em: $BACKUP_DIR"
```

## 🎯 Resumo dos Comandos

| Comando | Descrição |
|---------|-----------|
| `docker compose up -d` | Iniciar todos os serviços |
| `docker compose down` | Parar todos os serviços |
| `docker compose logs -f api` | Ver logs da API |
| `docker exec -it cc-sdk-api bash` | Acessar container da API |
| `claude-bypass "comando"` | Executar Claude com bypass |
| `docker compose ps` | Status dos containers |
| `docker compose pull` | Atualizar imagens |
| `docker compose up --build` | Rebuild e restart |

## ✅ Checklist de Verificação

- [ ] Docker e Docker Compose instalados
- [ ] Portas 8992 e 3082 disponíveis
- [ ] Arquivo .env.docker configurado
- [ ] Claude Code API Key configurada (se necessário)
- [ ] Containers construídos com sucesso
- [ ] Health checks passando
- [ ] API respondendo em localhost:8992
- [ ] Frontend carregando em localhost:3082
- [ ] Bypass do Claude funcionando
- [ ] Comunicação entre containers OK

## 🚨 Importante

⚠️ **Segurança**: O bypass remove TODAS as confirmações de segurança do Claude Code. Use apenas em:
- Ambientes de desenvolvimento
- Containers isolados
- Redes privadas
- Aplicações controladas

⚠️ **Produção**: Para produção, considere:
- Limitar permissões específicas em vez de `"allow": ["*"]`
- Usar secrets management para API keys
- Implementar rate limiting
- Configurar monitoramento adequado

⚠️ **Volumes**: Configure volumes apropriadamente para:
- Persistência de sessões: `./data/sessions:/app/sessions`
- Logs centralizados: `./logs:/app/logs`
- Configurações Claude: `~/.claude:/home/appuser/.claude`

## 📚 Referências

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Claude Code CLI Documentation](https://docs.anthropic.com/claude-code)
- [FastAPI Container Documentation](https://fastapi.tiangolo.com/deployment/docker/)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)

## 🔄 Versionamento

- **v1.0.0**: Configuração inicial completa
- **Docker Engine**: 24.0+
- **Docker Compose**: 2.0+
- **Claude Code CLI**: Latest
- **Python**: 3.11
- **Node.js**: 18

---

**Última atualização**: 31 de Agosto de 2025  
**Versão**: 1.0.0  
**Autor**: Sistema configurado via Claude Code  
**Localização**: `/home/suthub/.claude/api-claude-code-app/cc-sdk-chat/`