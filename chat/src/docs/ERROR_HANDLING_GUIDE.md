# 🛡️ Guia de Tratamento de Erros - Sistema Robusto

## 📋 Visão Geral

Este sistema implementa um tratamento de erros robusto e resiliente para a aplicação, baseado em múltiplas camadas de proteção:

1. **ErrorStore** - Store centralizado para captura e gerenciamento de erros
2. **ChatStore Protegido** - Versão blindada do store principal com validações
3. **Error Boundary** - Captura erros de React com recovery automático
4. **Logger Estruturado** - Sistema de logging integrado
5. **Error Monitor** - Interface visual para monitoramento em tempo real

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    APLICAÇÃO REACT                          │
├─────────────────────────────────────────────────────────────┤
│ ErrorBoundary → ErrorMonitor → Logger → ErrorStore         │
│              ↓                    ↓              ↓          │
│     UI Recovery        Logs      State Recovery             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Como Usar

### 1. Integração Básica

```tsx
// app/layout.tsx
import ErrorBoundary from '@/components/error/ErrorBoundary'
import ErrorMonitor from '@/components/error/ErrorMonitor'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
          {children}
          <ErrorMonitor position="top-right" autoHide={true} />
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

### 2. Usando Store Protegido

```tsx
// Substitua o import do store original
// import useChatStore from '@/stores/chatStore'
import useChatStoreProtected from '@/stores/chatStoreProtected'

function ChatComponent() {
  const { createSession, addMessage } = useChatStoreProtected()
  
  // Todas as operações já estão protegidas automaticamente
  const handleNewSession = () => {
    const sessionId = createSession() // Protegido contra falhas
    // ...
  }
}
```

### 3. Logging Estruturado

```tsx
import { useLogger } from '@/utils/logger'

function MyComponent() {
  const logger = useLogger()
  
  const handleApiCall = async () => {
    logger.startTimer('api-call')
    
    try {
      const response = await fetch('/api/data')
      logger.apiCall('GET', '/api/data', response.status)
      logger.endTimer('api-call')
    } catch (error) {
      logger.error('Falha na API', error, { 
        action: 'fetch-data',
        component: 'MyComponent' 
      })
    }
  }
  
  const handleUserClick = () => {
    logger.userInteraction('button-click', 'MyComponent', { 
      buttonId: 'submit' 
    })
  }
}
```

### 4. Tratamento Manual de Erros

```tsx
import { useErrorActions } from '@/stores/errorStore'
import { handleAsyncError, safeExecute } from '@/components/error/ErrorBoundary'

function AdvancedComponent() {
  const { captureError, createSnapshot } = useErrorActions()
  
  const riskyOperation = async () => {
    // Cria snapshot antes de operação crítica
    createSnapshot(storeState, 'before-risky-operation')
    
    // Execução protegida de operação assíncrona
    const result = await handleAsyncError(
      () => complexAsyncOperation(),
      'complex-async-operation'
    )
    
    if (!result) {
      // Operação falhou mas foi tratada graciosamente
      return
    }
    
    // Execução segura com fallback
    const processedData = safeExecute(
      () => processComplexData(result),
      [], // fallback
      'process-complex-data'
    )
  }
}
```

## 🔧 Configurações

### ErrorStore

```tsx
import useErrorStore from '@/stores/errorStore'

// Configurar comportamento
const errorStore = useErrorStore.getState()
errorStore.updateConfig({
  autoRecovery: true,        // Recovery automático
  persistErrors: false,      // Não persistir erros no storage
  logLevel: 'all',          // Log completo
  maxSnapshots: 5           // Máximo 5 snapshots
})
```

### Logger

```tsx
import logger from '@/utils/logger'

// Configurar nível de log em produção
logger.updateConfig({
  level: 'warn',              // Apenas warnings e erros
  enableConsole: false,       // Sem console em produção
  enableLocalStorage: false,  // Sem storage em produção
  enablePerformanceMetrics: true
})
```

## 📊 Monitoramento

### Error Monitor - Funcionalidades

- **Indicador Compacto**: Mostra contador de erros
- **Painel Expandido**: Lista detalhada de erros
- **Auto-Recovery**: Botões para recuperação manual
- **Filtragem**: Mostrar/ocultar erros resolvidos
- **Limpeza**: Limpar erros resolvidos ou todos

### Estados de Erro

| Severidade | Cor | Comportamento |
|------------|-----|---------------|
| `low` | Azul | Log apenas, sem interferência |
| `medium` | Amarelo | Log + possível recovery |
| `high` | Laranja | Log + recovery + notificação |
| `critical` | Vermelho | Log + recovery + UI de erro |

## 🔄 Recovery e Resilência

### Tipos de Recovery

1. **Rollback**: Volta para snapshot anterior
2. **Reset**: Reseta estado para padrão
3. **Repair**: Tenta reparar estado corrompido
4. **Reload**: Recarrega componente/página

### Snapshots Automáticos

O sistema cria snapshots automaticamente:
- Antes de operações críticas (migração de sessão)
- Antes de mutations complexas
- A cada N operações (configurável)

### Validações de Integridade

- **Session Validation**: Estrutura de sessões
- **ID Validation**: Formato de IDs (UUID, temp-, etc)
- **Data Integrity**: Checksums para detectar corrupção

## 🐛 Debug e Desenvolvimento

### Logs Estruturados

```javascript
// Console em desenvolvimento
[12:34:56.789] INFO Store Action: createSession { sessionId: 'temp-123', category: 'store' }
[12:34:56.790] DEBUG Component mount: ChatInterface { props: {...} }
[12:34:56.850] WARN Session validation failed { issues: ['Missing title'] }
[12:34:56.851] ERROR API GET /api/session 500 { duration: 1200ms }
```

### Error Monitor UI

- Clique no ícone para expandir
- Clique nos erros para ver detalhes
- Botões de recovery manual
- Filtros e limpeza

### LocalStorage (Dev)

```javascript
// Acessar logs salvos
const logs = JSON.parse(localStorage.getItem('app-logs') || '[]')
console.table(logs.slice(-10)) // Últimos 10 logs
```

## ⚠️ Boas Práticas

### DO's

✅ **Use stores protegidos** em production
✅ **Capture erros contextualizados** com sessionId, action, etc.
✅ **Crie snapshots** antes de operações críticas
✅ **Valide dados** na entrada e saída
✅ **Use logging estruturado** para debugging

### DON'Ts

❌ **Não ignore erros** - sempre capture ou trate
❌ **Não abuse de try/catch** - use funções utilitárias
❌ **Não deixe estado inconsistente** - sempre valide
❌ **Não persista erros** em produção por padrão
❌ **Não exponha stack traces** para usuários finais

## 🧪 Testes

### Testando Error Handling

```tsx
// Simular erro para teste
const errorStore = useErrorStore.getState()
errorStore.captureError(new Error('Test error'), {
  actionName: 'test-error',
  severity: 'high'
})

// Verificar recovery
expect(errorStore.errors.size).toBe(1)
await errorStore.attemptAutoRecovery(errorId)
expect(errorStore.errors.get(errorId)?.recovered).toBe(true)
```

### Performance Testing

```tsx
const logger = useLogger()

// Testar operação lenta
logger.startTimer('slow-operation')
await slowOperation()
const duration = logger.endTimer('slow-operation')
expect(duration).toBeLessThan(1000) // Menos de 1s
```

## 🚀 Deploy e Produção

### Configuração Recomendada

```env
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_ERROR_PERSISTENCE=false
ENABLE_PERFORMANCE_METRICS=true
MAX_ERROR_SNAPSHOTS=3
AUTO_RECOVERY_ENABLED=true
```

### Monitoring Externo

Integre com serviços de monitoramento:

```tsx
// Exemplo: Sentry integration
import * as Sentry from '@sentry/react'

const errorStore = useErrorStore.getState()
errorStore.updateConfig({
  onError: (error) => {
    if (error.severity === 'critical') {
      Sentry.captureException(error)
    }
  }
})
```

## 📚 Referência da API

### ErrorStore

- `captureError(error, context)` - Captura erro
- `createSnapshot(state, label)` - Cria snapshot
- `attemptAutoRecovery(errorId)` - Tenta recovery
- `rollbackToSnapshot(snapshotId)` - Rollback
- `clearRecoveredErrors()` - Limpa erros resolvidos

### Logger

- `debug/info/warn/error/fatal(message, context)` - Logging
- `startTimer/endTimer(operationId)` - Métricas
- `timeOperation(id, operation, context)` - Timing automático
- `storeAction(actionName, sessionId, payload)` - Log de store

### Utilidades

- `handleAsyncError(operation, context)` - Async protegido
- `safeExecute(operation, fallback, context)` - Execução segura
- `withErrorBoundary(Component, props)` - HOC de proteção

---

**Implementado com foco em resilência, observabilidade e experiência do usuário.**