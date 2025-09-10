# Guia de Execução Local - Chat API + Frontend

## Visão Geral
Este documento fornece instruções completas para executar localmente o sistema de chat integrado com Claude Code SDK.

## Componentes do Sistema
- **Backend**: FastAPI com Claude Code SDK (porta 8992)
- **Frontend**: Next.js com interface de chat (porta 3082)
- **Integração**: SSE (Server-Sent Events) para streaming em tempo real

## Pré-requisitos
- Python 3.11+
- Node.js 18+
- NPM 9+

## Estrutura do Projeto
```
cc-sdk-chat/
├── api/                    # Backend FastAPI
│   ├── server.py          # Servidor principal
│   ├── claude_handler.py  # Handler Claude Code SDK
│   ├── analytics_service.py # Serviço de analytics
│   ├── session_manager.py # Gerenciador de sessões
│   ├── requirements.txt   # Dependências Python
│   └── claude-code-sdk-python/ # SDK como submodule
├── chat/                  # Frontend Next.js
│   ├── package.json       # Dependências Node.js
│   ├── src/              # Código fonte
│   └── components/       # Componentes React
├── commands/             # Sistema de comandos slash
├── config/              # Configurações do sistema
├── session_manager/     # Gerenciamento de sessões compartilhado
├── utils/              # Utilitários compartilhados
├── viewers/            # Interfaces CLI/TUI para visualização
├── .venv/             # Ambiente virtual Python
└── GUIA-EXECUCAO-LOCAL.md # Este guia
```

## Configuração e Execução

### 1. Preparação do Ambiente

#### Criar ambiente virtual Python:
```bash
cd /.claude/api-claude-code-app/cc-sdk-chat
python3 -m venv .venv
```

**Nota**: O ambiente virtual já foi criado e está localizado em `.venv/`

#### Ativar ambiente virtual:
```bash
source .venv/bin/activate
```

#### Instalar dependências da API:
```bash
pip install -r api/requirements.txt
```

### 2. Executar o Backend (API)

```bash
# Na pasta raiz do projeto com venv ativado
source .venv/bin/activate
PORT=8992 python api/server.py
```

**Verificação**: API estará disponível em http://127.0.0.1:8992

Teste o endpoint:
```bash
curl http://127.0.0.1:8992/
# Resposta esperada: {"status":"ok","service":"Claude Chat API"}
```

### 3. Executar o Frontend

```bash
cd chat
npm run dev
```

**Verificação**: Frontend estará disponível em http://localhost:3082

### 4. Verificação da Integração

#### Teste de nova sessão via API:
```bash
curl -X POST http://localhost:8992/api/new-session \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Teste completo no navegador:
1. Acesse http://localhost:3082
2. Envie uma mensagem
3. Verifique se recebe resposta em streaming

## Portas Configuradas

| Serviço | Porta | URL |
|---------|-------|-----|
| API Backend | 8992 | http://127.0.0.1:8992 |
| Frontend | 3082 | http://localhost:3082 |
| Docs API | 8992 | http://127.0.0.1:8992/docs |

## Configuração de CORS

O backend está configurado para aceitar conexões do frontend:
```python
allow_origins=[
    "http://localhost:3082", 
    "http://localhost:3082",
    "http://127.0.0.1:3082",
]
```

## Logs e Monitoramento

### Logs do Backend:
```bash
INFO: Uvicorn running on http://127.0.0.1:8992
INFO: 127.0.0.1 - "POST /api/new-session HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "POST /api/chat HTTP/1.1" 200 OK
```

### Logs do Frontend:
```bash
▲ Next.js 14.2.20
- Local: http://localhost:3082
✓ Ready in 2.3s
```

## Resolução de Problemas

### Problema: Porta já em uso
```bash
# Verificar processo usando a porta
lsof -i :8992
# Encerrar processo se necessário
kill -9 <PID>
```

### Problema: Erro de CORS
- Verificar se o frontend está na porta 3082
- Confirmar configuração de CORS no server.py

### Problema: Dependências não encontradas
```bash
# Reinstalar dependências
pip install -r api/requirements.txt
cd chat && npm install
```

## Comandos Rápidos

### Inicialização Completa:
```bash
# Terminal 1 - Backend
cd /.claude/api-claude-code-app/cc-sdk-chat
source .venv/bin/activate
PORT=8992 python api/server.py

# Terminal 2 - Frontend  
cd /.claude/api-claude-code-app/cc-sdk-chat/chat
npm run dev
```

### Status Atual dos Serviços:
- ✅ **API**: Rodando em background (porta 8992)
- ✅ **Frontend**: Rodando em background (porta 3082)
- ✅ **Integração**: Funcional e testada

### Parar Serviços:
- Backend: `Ctrl+C` no terminal
- Frontend: `Ctrl+C` no terminal

## Arquivos de Configuração

### API - server.py (linha 899):
```python
port = int(os.getenv("PORT", "8991"))  # Padrão 8991, override com PORT=8992
```

### Frontend - package.json:
```json
"scripts": {
  "dev": "next dev -p 3082"
}
```

### Frontend - api.ts:
```typescript
this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8992';
```

## Status da Integração

✅ **Funcionalidades Implementadas:**
- Chat em tempo real via SSE
- Gerenciamento de sessões
- Interface responsiva
- Integração completa API ↔ Frontend

✅ **Testado e Validado:**
- Criação de sessões
- Envio de mensagens
- Streaming de respostas
- Histórico de conversas

## Módulos Adicionais do Sistema

### Viewers (`/viewers/`)
Sistema de interfaces para visualização de sessões:
- **CLI**: Comandos de linha de comando
- **TUI**: Interface de terminal rica (Rich/Textual)
- **Web**: Interface web adicional

### Commands (`/commands/`)
Sistema de comandos contextuais estilo Claude Code:
- Comandos slash (`/sessions`, `/project`, `/config`)
- Integração com sessões e configurações

### Utils (`/utils/`) 
Utilitários compartilhados entre os módulos

---

**Última atualização**: 31/08/2025  
**Status**: ✅ Funcional e testado  
**Localização**: `/.claude/api-claude-code-app/cc-sdk-chat/`