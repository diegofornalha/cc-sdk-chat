# 🔐 Guia: Habilitando MCP com Bypass Permissions no Claude SDK

## 📋 Problema Original

O MCP (Model Context Protocol) Neo4j estava solicitando permissões manuais a cada chamada, mesmo em ambiente controlado. O erro típico era:

```
Claude requested permissions to use mcp__neo4j-memory__search_memories, but you haven't granted it yet
```

## ✅ Solução Implementada

### 1. **Configuração Base - SessionConfig**

Localização: `/api/core/claude_handler.py`

```python
@dataclass
class SessionConfig:
    """Configuração para uma sessão de chat."""
    system_prompt: Optional[str] = None
    allowed_tools: List[str] = field(default_factory=list)
    max_turns: Optional[int] = None
    permission_mode: str = 'bypassPermissions'  # ← CRÍTICO: Define bypass como padrão
    cwd: Optional[str] = None
```

### 2. **Garantir Aplicação do Bypass - SEMPRE criar ClaudeCodeOptions**

**❌ Problema anterior:**
```python
# ERRADO - só criava options se havia outras configurações
async def _create_new_client(self, config: SessionConfig) -> ClaudeSDKClient:
    options = None
    if any([config.system_prompt, config.allowed_tools, config.max_turns, config.cwd]):
        options = ClaudeCodeOptions(...)

    client = ClaudeSDKClient(options=options)  # ← Bypass não era aplicado!
```

**✅ Solução correta:**
```python
async def _create_new_client(self, config: SessionConfig) -> ClaudeSDKClient:
    """Cria novo cliente SDK."""
    # SEMPRE cria opções para garantir que permission_mode seja aplicado
    options = ClaudeCodeOptions(
        system_prompt=config.system_prompt if config.system_prompt else None,
        allowed_tools=config.allowed_tools if config.allowed_tools else None,
        max_turns=config.max_turns if config.max_turns else None,
        permission_mode=config.permission_mode,  # SEMPRE inclui bypass
        cwd=config.cwd if config.cwd else None
    )

    # Log de debug para verificar permissões
    self.logger.info(
        f"🔑 Criando cliente com permission_mode: {config.permission_mode}",
        extra={
            "event": "client_options",
            "permission_mode": config.permission_mode,
            "has_allowed_tools": bool(config.allowed_tools),
            "cwd": config.cwd
        }
    )

    client = ClaudeSDKClient(options=options)
    await asyncio.wait_for(client.connect(), timeout=20.0)

    return client
```

## 🔍 Pontos Críticos de Atenção

### 1. **SEMPRE criar ClaudeCodeOptions**
- Mesmo quando não há outras configurações
- O bypass PRECISA ser passado explicitamente

### 2. **Valor correto: 'bypassPermissions'**
- Case sensitive
- Não use: 'bypass', 'Bypass', 'BYPASS_PERMISSIONS'
- Use exatamente: `'bypassPermissions'`

### 3. **Verificação nos logs**
Após implementar, verifique nos logs da API:
```json
{
  "message": "🔑 Criando cliente com permission_mode: bypassPermissions",
  "permission_mode": "bypassPermissions"
}
```

## 📝 Script de Teste

Crie `/api/test_mcp_permissions.py`:

```python
#!/usr/bin/env python3
import asyncio
import aiohttp
import json

async def test_mcp_neo4j():
    api_url = "http://localhost:8991"
    session_id = "00000000-0000-0000-0000-000000000001"

    message = {
        "content": "Use mcp__neo4j-memory__search_memories para buscar memórias",
        "session_id": session_id
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(f"{api_url}/chat", json=message) as resp:
            if resp.status == 200:
                response = await resp.text()
                if "permission" in response.lower() and "denied" in response.lower():
                    print("❌ Bypass NÃO está funcionando")
                else:
                    print("✅ Bypass ESTÁ funcionando!")

asyncio.run(test_mcp_neo4j())
```

## 🚀 Como Aplicar em Novo Projeto

### 1. **No SessionConfig**
```python
permission_mode: str = 'bypassPermissions'  # Defina como padrão
```

### 2. **Ao criar cliente Claude SDK**
```python
# SEMPRE crie options, nunca passe None
options = ClaudeCodeOptions(
    permission_mode='bypassPermissions',
    # ... outras configurações
)
client = ClaudeSDKClient(options=options)
```

### 3. **Para debugging**
Adicione logs ao criar clientes:
```python
logger.info(f"Creating client with permission_mode: {config.permission_mode}")
```

## ⚠️ Troubleshooting

### Problema: "Ainda pede permissão mesmo com bypass"

**Checklist:**
1. ✓ `permission_mode` está definido em SessionConfig?
2. ✓ ClaudeCodeOptions está SEMPRE sendo criado (nunca None)?
3. ✓ O valor é exatamente `'bypassPermissions'`?
4. ✓ O servidor foi reiniciado após as mudanças?
5. ✓ Os logs mostram "permission_mode: bypassPermissions"?

### Problema: "Funciona no terminal mas não na web"

**Solução:**
- Verifique se a API está usando a mesma configuração
- Confirme que a sessão web está usando o mesmo session_id
- Valide nos logs se o cliente está sendo criado com bypass

## 📊 Resultado Esperado

Quando configurado corretamente:

1. **Terminal**: MCP tools executam sem pedir permissão
2. **Web API**: Requisições processam MCP automaticamente
3. **Logs**: Mostram "🔑 Criando cliente com permission_mode: bypassPermissions"
4. **Neo4j**: Consultas executam e retornam dados imediatamente

## 🔧 Configuração Completa

```python
# /api/core/claude_handler.py

@dataclass
class SessionConfig:
    permission_mode: str = 'bypassPermissions'
    # ... outros campos

async def _create_new_client(self, config: SessionConfig):
    # SEMPRE cria options
    options = ClaudeCodeOptions(
        permission_mode=config.permission_mode,  # CRÍTICO
        # ... outros parâmetros
    )

    self.logger.info(f"🔑 permission_mode: {config.permission_mode}")

    client = ClaudeSDKClient(options=options)
    await client.connect()
    return client
```

## 💡 Dica Final

**Em ambiente de desenvolvimento/controlado:**
- Use sempre `bypassPermissions` como padrão
- Evita interrupções no fluxo de trabalho
- Permite automação completa com MCP tools

**Em produção:**
- Considere um sistema de permissões mais granular
- Ou mantenha bypass apenas para ferramentas específicas via `allowed_tools`

---

*Documento criado após resolver o problema de permissões MCP no Claude SDK Chat API*
*Data: 2025-09-13*