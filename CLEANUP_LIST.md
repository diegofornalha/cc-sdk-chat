# 🧹 Lista de Limpeza - cc-sdk-chat

## 📦 **Dependências Não Utilizadas** (requirements.txt)

### ❌ Para Remover:
```
pyjwt==2.8.0           # JWT removido completamente
bcrypt==4.1.2          # Não encontrado em uso
bleach==6.1.0          # Não encontrado em uso
validators==0.22.0     # Não encontrado em uso
cryptography==41.0.7   # Não encontrado em uso
regex==2023.10.3       # Não encontrado em uso (Python tem 're' nativo)
pathlib==1.0.1         # Redundante (builtin no Python 3.4+)
asyncio==3.4.3         # Redundante (builtin no Python 3.4+)
```

### ⚠️ Verificar Necessidade:
```
redis==5.0.1           # Usado apenas em rate_limiter.py
python-dateutil==2.8.2 # Pode ser substituído por datetime nativo
```

## 📁 **Arquivos Órfãos/Não Utilizados**

### Core:
- `/api/core/claude_handler_simple.py` - Não referenciado em lugar nenhum
- `/api/core/claude_handler.py` - Versão antiga? (verificar se server.py usa)

### Logs/Temporários:
- `/logs/api.log` - Arquivo de log (limpar periodicamente)
- `__pycache__/` - Diretórios de cache Python (remover todos)
- `*.pyc` - Arquivos compilados Python

### Documentação Antiga:
- `/api/security_fixes.md` - Documentação antiga de segurança
- `/api/logging_examples.env` - Arquivo de exemplo não necessário

## 🔧 **Imports Não Utilizados**

### /api/routes/session_routes.py:
```python
# Remover:
from pathlib import Path  # linha 11 - não usado
import redis  # linha 13 - foi removido mas ainda importado?
```

## 💀 **Código Morto/Comentado**

### /api/server.py:
- Verificar se ainda usa `claude_handler` ou mudou para `claude_handler_simple`
- Remover imports de rotas não usadas se houver

### /api/routes/:
- Verificar se todas as rotas em `/routes/` estão sendo importadas no server.py

## 🗑️ **Comando de Limpeza Sugerido**

```bash
# 1. Remover caches Python
find /Users/2a/.claude/cc-sdk-chat -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find /Users/2a/.claude/cc-sdk-chat -name "*.pyc" -delete

# 2. Limpar logs antigos
echo "" > /Users/2a/.claude/cc-sdk-chat/logs/api.log

# 3. Atualizar requirements.txt (remover as 8 dependências listadas)
```

## 📋 **Novo requirements.txt Sugerido**

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
sse-starlette==1.8.2
pydantic==2.5.0

# Monitoramento  
structlog==23.2.0
psutil==5.9.6

# Opcional (verificar uso)
redis==5.0.1  # Se manter rate limiting com Redis
```

## 🎯 **Impacto da Limpeza**

- **Redução de dependências**: De 17 para ~8 pacotes
- **Menos superfície de ataque**: Removendo libs de segurança não usadas
- **Mais rápido para instalar**: Menos dependências
- **Mais fácil manutenção**: Menos código para manter

## ⚡ **Ações Prioritárias**

1. **Remover `pyjwt` do requirements.txt** (já não usa JWT)
2. **Remover `pathlib` e `asyncio`** (são builtin)
3. **Deletar `claude_handler_simple.py`** se não estiver em uso
4. **Limpar todos os `__pycache__`**
5. **Verificar qual handler está usando**: `claude_handler.py` ou outro?

## 🔍 **Necessita Investigação Adicional**

1. Redis está sendo usado em produção ou apenas desenvolvimento?
2. O arquivo `server.py` está usando qual handler de Claude?
3. Todas as rotas em `/routes/` estão ativas?
4. Os arquivos em `/tests/` estão atualizados?