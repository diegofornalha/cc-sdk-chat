# 📖 Documentação CC-SDK-CHAT

## 🎯 Início Rápido
Para documentação completa do sistema, consulte: **[SISTEMA_CONSOLIDADO.md](./SISTEMA_CONSOLIDADO.md)**

## 📚 Documentos Disponíveis

### Essencial
- **[SISTEMA_CONSOLIDADO.md](./SISTEMA_CONSOLIDADO.md)** - Documentação completa e atualizada do sistema

### Referências Técnicas
- **[API_DOCS.md](./API_DOCS.md)** - Documentação detalhada dos endpoints da API
- **[SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)** - Implementações de segurança
- **[STABILITY_MONITORING.md](./STABILITY_MONITORING.md)** - Sistema de monitoramento e estabilidade
- **[README_LOGGING.md](./README_LOGGING.md)** - Sistema de logging estruturado

### Guias
- **[GUIA-EXECUCAO-LOCAL.md](./GUIA-EXECUCAO-LOCAL.md)** - Como executar localmente
- **[SETUP.md](./SETUP.md)** - Configuração inicial do ambiente
- **[INTEGRACAO-CHAT-API.md](./INTEGRACAO-CHAT-API.md)** - Integração entre chat e API
- **[SOLUCAO_PORTAS.md](./SOLUCAO_PORTAS.md)** - Configuração de portas e rede

## 🚀 Quick Start

```bash
# Backend
cd api && source .venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8991 --reload

# Frontend  
cd chat && npm run dev
```

Acesse: http://localhost:3082

## 📝 Notas
- Documentação consolidada em 10/09/2025
- Arquivos redundantes foram removidos e unificados em SISTEMA_CONSOLIDADO.md
- Para problemas específicos, consulte os documentos de referência técnica

---
*Use SISTEMA_CONSOLIDADO.md como referência principal*