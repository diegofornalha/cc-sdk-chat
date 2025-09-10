# Claude Code SDK for Python

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)](https://github.com/anthropics/claude-code-sdk-python)

SDK Python oficial para integração com Claude Code, permitindo interações programáticas com Claude para desenvolvimento de código, automação e ferramentas de IA.

## Características Principais

- 🚀 **API Simples e Intuitiva** - Interface pythônica para interagir com Claude
- 🔄 **Suporte a Streaming** - Receba respostas em tempo real conforme são geradas
- 🛠️ **Ferramentas Integradas** - Use ferramentas do Claude Code como Read, Write, Bash
- 🎯 **MCP Servers** - Suporte completo para Model Context Protocol
- 🔐 **Gerenciamento de Permissões** - Controle fino sobre execução de ferramentas
- 💬 **Sessões Persistentes** - Mantenha contexto entre múltiplas interações
- ⚡ **Alto Desempenho** - Otimizado para mínima latência e overhead

## Instalação

### Via pip (recomendado)

```bash
pip install claude-code-sdk
```

### Via git (desenvolvimento)

```bash
git clone https://github.com/anthropics/claude-code-sdk-python.git
cd claude-code-sdk-python
pip install -e .
```

### Requisitos

- Python 3.9 ou superior
- Claude Code CLI instalado (`npm install -g @anthropics/claude-code`)
- Conta Anthropic com acesso ao Claude

## Início Rápido

### Exemplo Básico - Query Simples

```python
from claude_code_sdk import query
import asyncio

async def main():
    # Pergunta simples
    async for message in query(prompt="O que é Python?"):
        if hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'text'):
                    print(block.text)

asyncio.run(main())
```

### Exemplo com Opções

```python
from claude_code_sdk import query, ClaudeCodeOptions

async def main():
    options = ClaudeCodeOptions(
        system_prompt="Você é um expert em Python",
        cwd="/home/user/projeto",
        permission_mode="acceptEdits",  # Auto-aceita edições de arquivos
        allowed_tools=["Read", "Write", "Bash"]
    )
    
    async for message in query(
        prompt="Crie um servidor web simples em Python",
        options=options
    ):
        # Processa mensagens
        pass

asyncio.run(main())
```

## Cliente Interativo

Para conversas bidirecionais e controle avançado:

```python
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions
import asyncio

async def main():
    # Cria cliente com configurações
    options = ClaudeCodeOptions(
        system_prompt="Você é um assistente de programação",
        allowed_tools=["Read", "Write"]
    )
    
    client = ClaudeSDKClient(options)
    
    # Conecta ao Claude
    async with client:
        # Envia primeira mensagem
        await client.query("Vamos criar um projeto Python")
        
        # Recebe resposta completa
        async for msg in client.receive_response():
            if hasattr(msg, 'content'):
                for block in msg.content:
                    if hasattr(block, 'text'):
                        print(f"Claude: {block.text}")
        
        # Envia follow-up
        await client.query("Adicione testes unitários")
        
        # Continua recebendo...
        async for msg in client.receive_response():
            # Processa resposta
            pass

asyncio.run(main())
```

## MCP Servers

### Criando um MCP Server Customizado

```python
from claude_code_sdk import tool, create_sdk_mcp_server, ClaudeCodeOptions, query
import asyncio

# Define ferramentas customizadas
@tool("calculate", "Realiza cálculos matemáticos", {"expression": str})
async def calculate(args):
    try:
        result = eval(args["expression"])
        return {
            "content": [{
                "type": "text",
                "text": f"Resultado: {result}"
            }]
        }
    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Erro: {str(e)}"
            }],
            "is_error": True
        }

@tool("get_time", "Retorna a hora atual", {})
async def get_time(args):
    from datetime import datetime
    return {
        "content": [{
            "type": "text",
            "text": f"Hora atual: {datetime.now().isoformat()}"
        }]
    }

async def main():
    # Cria servidor MCP
    calculator_server = create_sdk_mcp_server(
        name="calculator",
        version="1.0.0",
        tools=[calculate, get_time]
    )
    
    # Usa com Claude
    options = ClaudeCodeOptions(
        mcp_servers={"calc": calculator_server},
        allowed_tools=["calculate", "get_time"]
    )
    
    async for msg in query(
        prompt="Quanto é 2 + 2? E que horas são?",
        options=options
    ):
        # Claude usará as ferramentas customizadas
        pass

asyncio.run(main())
```

## Gerenciamento de Permissões

### Controle Dinâmico de Ferramentas

```python
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions
import asyncio

async def tool_permission_handler(context):
    """Callback para aprovar/negar uso de ferramentas."""
    tool_name = context.tool_name
    
    # Lógica customizada de permissão
    if tool_name == "Bash":
        command = context.arguments.get("command", "")
        if "rm" in command or "delete" in command:
            return {
                "type": "deny",
                "reason": "Comandos destrutivos não permitidos"
            }
    
    return {"type": "allow"}

async def main():
    options = ClaudeCodeOptions(
        can_use_tool=tool_permission_handler
    )
    
    async with ClaudeSDKClient(options) as client:
        await client.query("Execute ls -la")
        # Processamento...

asyncio.run(main())
```

## Tratamento de Erros

```python
from claude_code_sdk import (
    query, 
    ClaudeSDKError,
    CLINotFoundError,
    TimeoutError,
    ValidationError
)
import asyncio

async def main():
    try:
        async for msg in query(prompt="Olá Claude"):
            # Processa mensagens
            pass
            
    except CLINotFoundError as e:
        print(f"Claude Code não está instalado: {e}")
        print("Instale com: npm install -g @anthropics/claude-code")
        
    except TimeoutError as e:
        print(f"Timeout após {e.timeout}s")
        
    except ValidationError as e:
        print(f"Erro de validação no campo {e.field}: {e}")
        
    except ClaudeSDKError as e:
        print(f"Erro geral do SDK: {e}")

asyncio.run(main())
```

## Streaming de Mensagens

```python
from claude_code_sdk import ClaudeSDKClient, TextBlock, ToolUseBlock
import asyncio

async def main():
    async with ClaudeSDKClient() as client:
        await client.query("Escreva um poema sobre Python")
        
        async for message in client.receive_messages():
            # Processa diferentes tipos de blocos
            if hasattr(message, 'content'):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(block.text, end='', flush=True)
                    elif isinstance(block, ToolUseBlock):
                        print(f"\n[Usando ferramenta: {block.name}]")

asyncio.run(main())
```

## Configurações Avançadas

### ClaudeCodeOptions

```python
from claude_code_sdk import ClaudeCodeOptions, PermissionMode

options = ClaudeCodeOptions(
    # Prompt do sistema
    system_prompt="Você é um expert em DevOps",
    
    # Diretório de trabalho
    cwd="/home/user/projeto",
    
    # Modo de permissão
    permission_mode=PermissionMode.BYPASS_PERMISSIONS,  # Cuidado!
    
    # Ferramentas permitidas
    allowed_tools=["Read", "Write", "Bash", "GitRead"],
    
    # Ferramentas bloqueadas
    blocked_tools=["DeleteFile"],
    
    # MCP Servers
    mcp_servers={
        "custom": my_mcp_server
    },
    
    # Hooks para eventos
    hooks={
        "before_tool_use": [my_before_hook],
        "after_tool_use": [my_after_hook]
    },
    
    # Limite de turnos
    max_turns=10,
    
    # Callback de permissão
    can_use_tool=my_permission_handler
)
```

## Exemplos Práticos

### Análise de Código

```python
async def analyze_code(file_path: str):
    options = ClaudeCodeOptions(
        system_prompt="Você é um revisor de código especializado",
        allowed_tools=["Read"]
    )
    
    prompt = f"Analise o código em {file_path} e sugira melhorias"
    
    async for msg in query(prompt=prompt, options=options):
        # Processa análise
        pass
```

### Geração de Testes

```python
async def generate_tests(module_path: str):
    options = ClaudeCodeOptions(
        allowed_tools=["Read", "Write"],
        cwd=os.path.dirname(module_path)
    )
    
    prompt = f"""
    Leia o módulo {module_path} e crie testes unitários 
    abrangentes usando pytest
    """
    
    async for msg in query(prompt=prompt, options=options):
        # Testes serão criados automaticamente
        pass
```

### Automação de DevOps

```python
async def setup_ci_cd(project_dir: str):
    options = ClaudeCodeOptions(
        cwd=project_dir,
        allowed_tools=["Read", "Write", "Bash"],
        system_prompt="Você é um especialista em CI/CD"
    )
    
    prompt = """
    Configure GitHub Actions para este projeto Python:
    1. Testes com pytest
    2. Linting com ruff
    3. Deploy automático
    """
    
    async for msg in query(prompt=prompt, options=options):
        # CI/CD será configurado
        pass
```

## Diferenças do SDK Oficial Anthropic

Este SDK é específico para Claude Code e oferece:

1. **Integração Nativa com CLI** - Funciona diretamente com Claude Code instalado
2. **Suporte a Ferramentas Locais** - Read, Write, Bash executam no seu ambiente
3. **MCP Servers In-Process** - Servers rodam no mesmo processo Python
4. **Controle de Permissões** - Callbacks para aprovar/negar ferramentas
5. **Sessões Persistentes** - Mantém contexto entre execuções
6. **Streaming Bidirecional** - Envie e receba mensagens a qualquer momento

## Arquitetura

```
claude_code_sdk/
├── __init__.py          # Exports principais e versionamento
├── client.py            # ClaudeSDKClient para interações bidirecionais
├── query.py             # Função query() para one-shot
├── types.py             # Tipos e modelos de dados
├── _errors.py           # Hierarquia de exceções
└── _internal/           # Implementação interna
    ├── client.py        # Cliente interno
    ├── query.py         # Query engine
    ├── message_parser.py # Parser de mensagens
    └── transport/       # Camada de transporte
        └── subprocess_cli.py # Transporte via CLI
```

## Desenvolvimento

### Instalando para Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/anthropics/claude-code-sdk-python.git
cd claude-code-sdk-python

# Crie ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Instale em modo desenvolvimento
pip install -e ".[dev]"
```

### Executando Testes

```bash
# Testes unitários
pytest tests/

# Com cobertura
pytest --cov=claude_code_sdk tests/

# Linting
ruff check .
mypy claude_code_sdk/
```

### Contribuindo

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

## Suporte e Documentação

- **Documentação Completa**: [https://claude-code-sdk.readthedocs.io](https://claude-code-sdk.readthedocs.io)
- **Issues**: [GitHub Issues](https://github.com/anthropics/claude-code-sdk-python/issues)
- **Discussões**: [GitHub Discussions](https://github.com/anthropics/claude-code-sdk-python/discussions)
- **Changelog**: [CHANGELOG.md](https://github.com/anthropics/claude-code-sdk-python/blob/main/CHANGELOG.md)

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Agradecimentos

- Time Anthropic pelo Claude e Claude Code
- Comunidade Python por feedback e contribuições
- Todos os contribuidores do projeto