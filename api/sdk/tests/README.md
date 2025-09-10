# Testes do Claude Code SDK

## 📊 Status dos Testes

Suite de testes completa implementada para validar as funcionalidades críticas do SDK.

## 🧪 Estrutura de Testes

### 1. **test_errors.py** ✅
Testes completos para a hierarquia de exceções do SDK:
- **25 testes passando**
- Cobertura de todas as novas exceções personalizadas
- Validação de atributos específicos de cada erro
- Testes de herança e encadeamento de erros

#### Exceções Testadas:
- `ValidationError` - Validação de entrada
- `TimeoutError` - Operações com timeout
- `AuthenticationError` - Falhas de autenticação
- `RateLimitError` - Limites de taxa excedidos
- `TransportError` - Erros de transporte
- `ProtocolError` - Violações de protocolo
- `ConfigurationError` - Configurações inválidas
- Erros CLI específicos

### 2. **test_client.py** 
Testes para o `ClaudeSDKClient`:
- Inicialização e configuração
- Gerenciamento de conexão
- Envio e recebimento de mensagens
- Funcionalidade de interrupção
- Interface de streaming
- Tratamento de erros
- Context managers

### 3. **test_query.py**
Testes para a função `query`:
- Queries simples com resposta de texto
- Queries com opções customizadas
- Uso de ferramentas (tools)
- Comportamento de streaming
- Tratamento de erros
- Conversações multi-turno

### 4. **conftest.py**
Fixtures compartilhadas para todos os testes:
- Mock de transporte
- Mensagens de exemplo
- Configurações de teste
- Helpers assíncronos

## 🚀 Como Executar os Testes

### Instalar Dependências
```bash
pip install -r requirements-test.txt
```

### Executar Todos os Testes
```bash
# Com cobertura
python -m pytest

# Sem cobertura (mais rápido)
python -m pytest --no-cov

# Verbose
python -m pytest -v
```

### Executar Testes Específicos
```bash
# Apenas testes de erros
python -m pytest tests/test_errors.py

# Apenas uma classe de testes
python -m pytest tests/test_errors.py::TestSpecificErrors

# Apenas um teste específico
python -m pytest tests/test_errors.py::TestSpecificErrors::test_validation_error
```

### Executar com Script Helper
```bash
python run_tests.py
```

## 📈 Cobertura de Código

Para gerar relatório de cobertura:
```bash
python -m pytest --cov=claude_code_sdk --cov-report=html
```

O relatório HTML estará disponível em `htmlcov/index.html`

## 🔧 Configuração

A configuração dos testes está em `pytest.ini`:
- Auto-descoberta de testes
- Modo asyncio automático
- Cobertura mínima de 80%
- Relatórios detalhados

## ✅ Checklist de Testes

- [x] Exceções e tratamento de erros
- [x] Cliente SDK básico
- [x] Função query
- [x] Fixtures e utilities
- [ ] Transporte e comunicação
- [ ] Message parser
- [ ] Integração com MCP
- [ ] Testes de performance
- [ ] Testes e2e

## 🎯 Próximos Passos

1. Aumentar cobertura de código para >80%
2. Adicionar testes de integração
3. Implementar testes de stress/performance
4. Configurar CI/CD com GitHub Actions
5. Adicionar testes de compatibilidade entre versões