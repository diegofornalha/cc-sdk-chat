# 📚 Documentação - CC SDK Chat API

## 🗂️ Índice de Documentação

### 🚀 Quick Start
- **[GUIA-EXECUCAO-LOCAL.md](./GUIA-EXECUCAO-LOCAL.md)** - Rode o projeto em 5 minutos
  - Para: Desenvolvedores querendo testar rapidamente
  - Foco: Comandos diretos sem explicações profundas

### ⚙️ Configuração Completa
- **[SETUP.md](./SETUP.md)** - Configuração detalhada do ambiente
  - Para: DevOps, administradores
  - Foco: Setup robusto com todas as opções

### 📡 API Reference
- **[API_DOCS.md](./API_DOCS.md)** - Documentação técnica completa da API
  - Para: Desenvolvedores integrando com a API
  - Foco: Especificações detalhadas de cada endpoint
  
- **[ENDPOINTS_MASTER_LIST.md](./ENDPOINTS_MASTER_LIST.md)** - Lista rápida de todos endpoints
  - Para: Referência rápida durante desenvolvimento
  - Foco: Overview sem detalhes profundos

### 🏗️ Arquitetura
- **[SISTEMA_CONSOLIDADO.md](./SISTEMA_CONSOLIDADO.md)** - Visão geral da arquitetura
  - Para: Arquitetos, tech leads
  - Foco: Componentes e suas interações
  
- **[INTEGRACAO-CHAT-API.md](./INTEGRACAO-CHAT-API.md)** - Integração frontend/backend
  - Para: Full-stack developers
  - Foco: Como chat e API se comunicam

### 🔧 Soluções Implementadas
- **[SOLUCAO_SESSAO_UNIFICADA.md](./SOLUCAO_SESSAO_UNIFICADA.md)** ⚠️ **CRÍTICO**
  - Para: TODOS - essencial para operação
  - Foco: Como manter sessões unificadas (force_unified_session.py)
  
- **[SOLUCAO_PORTAS.md](./SOLUCAO_PORTAS.md)** - Histórico de resolução de conflitos
  - Para: Referência histórica
  - Foco: Como resolvemos problemas de portas

### 🛡️ Segurança & Monitoramento
- **[SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)** - Especificações de segurança
  - Para: Security engineers, auditores
  - Foco: Implementações de segurança detalhadas
  
- **[STABILITY_MONITORING.md](./STABILITY_MONITORING.md)** - Sistema de monitoramento
  - Para: SRE, DevOps
  - Foco: Circuit breakers, health checks, métricas

### 📝 Logging & Debug
- **[README_LOGGING.md](./README_LOGGING.md)** - Sistema de logging estruturado
  - Para: Desenvolvedores debugando
  - Foco: Como usar e interpretar logs

### 🧪 Testes
- **[TEST_STRATEGY_100_PERCENT.md](./TEST_STRATEGY_100_PERCENT.md)** - Estratégia de testes
  - Para: QA, desenvolvedores
  - Foco: Como alcançar 100% de cobertura
  
- **[TEST_COVERAGE_REPORT.md](./TEST_COVERAGE_REPORT.md)** - Relatório de cobertura atual
  - Para: Métricas e acompanhamento
  - Foco: Status atual dos testes

---

## 🎯 Decisões Arquiteturais Importantes

### SDK Próprio
- Mantemos nosso próprio SDK em `/api/sdk/claude_code_sdk/`
- Decisão por segurança e independência
- Padrão Dual SDK: SDK de referência + SDK de produção

### Sessão Unificada
- **CRÍTICO**: `force_unified_session.py` DEVE estar sempre rodando
- Todas as sessões consolidadas em `00000000-0000-0000-0000-000000000001.jsonl`
- Ver [SOLUCAO_SESSAO_UNIFICADA.md](./SOLUCAO_SESSAO_UNIFICADA.md) para detalhes

### Estrutura de Pastas
```
api/
├── server.py                    # Servidor principal FastAPI
├── force_unified_session.py     # Monitor de sessão (DEVE estar rodando)
├── sdk/claude_code_sdk/         # SDK próprio mantido
├── core/                        # Lógica core
├── docs/                        # Esta documentação
└── examples/                    # Exemplos de uso
```

---

## 💡 Por que 13 documentos?

**Não é redundância, é especialização!** Cada documento serve um propósito específico e um público-alvo distinto. Consolidar tornaria a documentação menos útil, não mais.

*"A complexidade pode ser removida, mas nem sempre deveria ser."*