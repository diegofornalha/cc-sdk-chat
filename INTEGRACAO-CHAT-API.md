# Integração Chat Frontend com API Backend - Guia Completo

## Visão Geral
Este documento descreve o processo completo de integração entre o frontend Next.js (chat) e o backend FastAPI com Claude Code SDK.

## Problema Inicial
- A API estava configurada para rodar na porta 8989, mas essa porta estava ocupada por outro processo
- O frontend estava configurado para conectar na porta 8989
- Havia incompatibilidade entre as configurações de CORS
- O Claude Code SDK Python não estava instalado corretamente no ambiente virtual

## Solução Implementada

### 1. Configuração do Ambiente Virtual e Dependências

#### Verificação do ambiente virtual existente:
```bash
ls -la ~/.claude/cc-sdk-chat/.venv/bin/
```

#### Instalação do Claude Code SDK como submodule:
```bash
cd /home/suthub/.claude/cc-sdk-chat/api
git submodule update --init --recursive
```

#### Instalação do SDK no ambiente virtual:
```bash
~/.claude/cc-sdk-chat/.venv/bin/pip install -e claude-code-sdk-python
```

**Nota:** Foi necessário usar `--break-system-packages` devido ao ambiente gerenciado:
```bash
pip3 install --break-system-packages -e claude-code-sdk-python
```

### 2. Configuração da API Backend

#### Mudança de porta (8989 → 8990)
Como a porta 8989 estava ocupada, alteramos para 8990:

**Arquivo:** `/home/suthub/.claude/cc-sdk-chat/api/server.py` (linha 532-534)
```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8990, reload=False)
```

#### Configuração de CORS
Adicionamos suporte para localhost e 127.0.0.1:

**Arquivo:** `/home/suthub/.claude/cc-sdk-chat/api/server.py` (linhas 76-88)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3040", 
        "http://localhost:3000",
        "http://127.0.0.1:3040",  # Adicionado
        "https://suthub.agentesintegrados.com",
        "http://suthub.agentesintegrados.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3. Configuração do Frontend

#### Atualização da URL da API
Mudamos a URL base para conectar na nova porta:

**Arquivo:** `/home/suthub/.claude/cc-sdk-chat/chat/src/lib/api.ts` (linhas 45-46 e 50)
```typescript
// Em desenvolvimento, usa localhost
this.baseUrl = 'http://localhost:8990';

// SSR ou ambiente Node.js
this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8990';
```

### 4. Comandos de Execução

#### Iniciar o Backend (API):
```bash
cd /home/suthub/.claude/cc-sdk-chat/api
~/.claude/cc-sdk-chat/.venv/bin/python server.py
```

#### Iniciar o Frontend (Chat):
```bash
cd /home/suthub/.claude/cc-sdk-chat/chat
npm run dev
```

### 5. Teste da Integração

#### Verificar criação de sessão:
```bash
curl -X POST http://localhost:8990/api/new-session
```
Resposta esperada:
```json
{"session_id":"196c7ded-b50a-4c19-86ae-c21cc48f3826"}
```

## Estrutura Final

### Serviços em Execução:
- **Frontend Next.js:** http://localhost:3040
- **Backend FastAPI:** http://localhost:8990

### Fluxo de Comunicação:
1. Usuário acessa http://localhost:3040
2. Frontend envia requisições para http://localhost:8990/api/
3. API processa com Claude Code SDK
4. Respostas retornam via SSE (Server-Sent Events)

## Problemas Resolvidos

1. ✅ **Porta ocupada:** Mudança de 8989 para 8990
2. ✅ **CORS:** Adição de origens permitidas
3. ✅ **Dependências:** Instalação correta do Claude Code SDK
4. ✅ **Ambiente virtual:** Uso do venv correto
5. ✅ **Configuração de URLs:** Sincronização frontend-backend

## Observações Importantes

### Diferença entre execução local vs Docker:
- **Local:** Usa processos Python e Node.js diretamente
- **Docker:** Usaria containers isolados (configurado mas não em uso)

### Variáveis de Ambiente:
- O frontend detecta automaticamente o ambiente (produção vs desenvolvimento)
- Em produção (suthub.agentesintegrados.com), usa proxy reverso
- Em desenvolvimento, conecta diretamente na API local

### Processo de Background:
Os serviços foram iniciados com `run_in_background=true` para manter execução contínua:
```python
# API em background
~/.claude/cc-sdk-chat/.venv/bin/python server.py  # bash_8

# Frontend em background  
cd /home/suthub/.claude/cc-sdk-chat/chat && npm run dev  # bash_10
```

## Comandos Úteis

### Verificar processos:
```bash
ps aux | grep server.py
ps aux | grep "next dev"
```

### Parar processos:
```bash
# Para API
pkill -f "python server.py"

# Para Frontend
pkill -f "next dev"
```

### Logs e monitoramento:
```bash
# Ver output da API
curl http://localhost:8990/

# Testar chat
curl -X POST http://localhost:8990/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "teste", "session_id": "test-123"}'
```

## Conclusão

A integração foi realizada com sucesso através de:
1. Correção das dependências Python
2. Ajuste de portas para evitar conflitos
3. Sincronização das configurações de CORS
4. Atualização das URLs no frontend

O sistema está funcional e pronto para uso em ambiente de desenvolvimento.