# 📚 Documentação Consolidada - CC-SDK-CHAT
**Versão: 0.0.21**

## 🎯 Visão Geral
Sistema de chat integrado com Claude Code SDK, fornecendo interface web para conversas com IA.

## 🏗️ Arquitetura

### Backend (FastAPI)
- **Porta**: 8991
- **Path**: `/Users/2a/.claude/cc-sdk-chat/api`
- **Python**: 3.12+
- **Framework**: FastAPI com middleware de segurança

### Frontend (Next.js)
- **Porta**: 3082  
- **Path**: `/Users/2a/.claude/cc-sdk-chat/chat`
- **Framework**: Next.js 14 com TypeScript

## 🚀 Instalação e Execução

### 1. Backend
```bash
cd /Users/2a/.claude/cc-sdk-chat/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8991 --reload
```

### 2. Frontend
```bash
cd /Users/2a/.claude/cc-sdk-chat/chat
npm install
npm run dev
```

### 3. Acesso
- Frontend: http://localhost:3082
- API Docs: http://localhost:8991/docs

## 🔧 Configurações Principais

### Session ID Fixo
- **ID**: `00000000-0000-0000-0000-000000000001`
- **Localização**: Hardcoded em `/api/core/claude_handler.py`
- **Propósito**: Manter histórico consistente em arquivo único

### Arquivos JSONL
- **Path**: `/Users/2a/.claude/projects/-Users-2a--claude-cc-sdk-chat-api/`
- **Formato**: Um arquivo por sessão (00000000-*.jsonl)
- **Persistência**: Sessões nunca expiram (timeout = 0)

## 📡 Sistema de Streaming Real-Time

### Problema Conhecido
Claude SDK ignora session_id enviado e cria novo ID, causando:
- Respostas salvas em arquivo JSONL diferente
- Frontend não recebe updates em tempo real
- Necessidade de refresh manual

### Solução Implementada
1. **Polling do JSONL** (`/api/realtime/latest/{project}`)
   - Frontend faz polling a cada 300ms
   - Monitora arquivo JSONL mais recente
   - Processa mensagens novas por timestamp

2. **SSE Stream** (`/api/realtime/stream/{project}`)
   - Monitora mudanças no arquivo JSONL
   - Envia eventos quando detecta conteúdo novo
   - Processa tool_use e text separadamente

## 🛡️ Segurança

### Middleware Implementados
- **Rate Limiting**: 60 req/min por IP
- **CORS**: Configurado para localhost:3082
- **Security Headers**: CSP, X-Frame-Options, etc
- **Exception Handling**: Tratamento centralizado de erros

### Monitoramento
- **Logs estruturados**: `/api/logs/api.log`
- **Circuit Breakers**: Proteção contra falhas em cascata
- **Health Check**: `/api/health` com métricas detalhadas

## 📊 APIs Principais

### Chat
```http
POST /api/chat
{
  "message": "string",
  "session_id": "00000000-0000-0000-0000-000000000001"
}
```

### Histórico
```http
GET /api/session-history/{session_id}
GET /api/analytics/projects/{project}/sessions
```

### Real-time
```http
GET /api/realtime/latest/{project}?limit=10
GET /api/realtime/stream/{project}
```

## 🐛 Problemas Conhecidos

### 1. Session ID Inconsistente
- **Causa**: Claude SDK cria novo ID ignorando o enviado
- **Workaround**: Polling do arquivo JSONL mais recente

### 2. Streaming Não Real-time
- **Causa**: Session ID diferente quebra associação
- **Workaround**: Frontend faz polling a cada 300ms

### 3. Rate Limit Muito Restritivo
- **Sintoma**: Bloqueio após muitas requisições
- **Solução**: Ajustar em `/api/middleware/rate_limiter.py`

## 🔍 Debugging

### Logs Úteis
```bash
# API logs
tail -f /Users/2a/.claude/cc-sdk-chat/api/logs/api.log

# Filtrar streaming
tail -f logs/api.log | grep -E "text_chunk|streaming|session_id"

# Ver sessões ativas
curl http://localhost:8991/api/health | jq .sessions
```

### Network Monitor (Frontend)
- Atalho: `Ctrl+Shift+N`
- Mostra requisições em tempo real
- Útil para debug de streaming

## 📝 Comandos do Chat

- `/clear` - Limpa histórico da tela
- `/export` - Exporta conversas
- `/help` - Mostra ajuda
- `/mcp` - Comandos MCP (em desenvolvimento)

## 🚧 Melhorias Futuras

1. **Fix Session ID no SDK**
   - Modificar SDK para aceitar session_id customizado
   - Ou criar wrapper que força ID correto

2. **WebSocket Real**
   - Substituir polling por WebSocket
   - Comunicação bidirecional verdadeira

3. **Autenticação**
   - Adicionar sistema de login
   - Sessões por usuário

4. **Persistência Melhorada**
   - Banco de dados ao invés de JSONL
   - Busca e indexação de histórico

## 📦 Estrutura de Diretórios

```
/Users/2a/.claude/cc-sdk-chat/
├── api/                    # Backend FastAPI
│   ├── core/              # Lógica principal
│   ├── routes/            # Endpoints da API
│   ├── middleware/        # Segurança e logging
│   ├── logs/              # Arquivos de log
│   └── server.py          # Entry point
├── chat/                   # Frontend Next.js
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── lib/          # Utilitários
│   │   └── app/          # Páginas Next.js
│   └── package.json
└── docs/                   # Esta documentação
```

## 🤝 Suporte

Para problemas ou dúvidas:
1. Verificar logs em `/api/logs/api.log`
2. Usar Network Monitor (`Ctrl+Shift+N`)
3. Consultar health check: `http://localhost:8991/api/health`

---

*Documento consolidado em 10/09/2025 - Versão unificada da documentação*