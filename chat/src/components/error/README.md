# Sistema de Error Boundaries

## 📖 Visão Geral

Este sistema implementa uma arquitetura robusta de Error Boundaries para proteger diferentes níveis da aplicação de chat, permitindo isolamento de falhas e recuperação graceful.

## 🚀 Características

### GlobalErrorBoundary
- **Captura Global**: Intercepta erros em toda a árvore de componentes React
- **UI de Fallback**: Interface elegante quando ocorrem erros
- **Logging Estruturado**: Logs detalhados para monitoramento e debugging
- **Recuperação**: Botões para tentar novamente ou recarregar página

### SessionErrorBoundary ⭐ **NOVO**
- **Isolamento por Sessão**: Erros em uma sessão não afetam outras
- **Cleanup Automático**: Remove sessões corrompidas após 3 tentativas
- **Recuperação Graceful**: Permite limpar ou recriar sessões
- **Preserva Estado**: Mantém outras sessões funcionando normalmente

### ChatErrorBoundary
- **Proteção de Streaming**: Recupera estados de chat corrompidos
- **Preservação de Sessão**: Faz backup automático antes de recovery

## 🔧 Como Funciona

### 1. Class Component com Error Boundary
```tsx
class GlobalErrorBoundary extends Component {
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log estruturado para monitoramento
    console.error('Global Error:', error, errorInfo);
  }
}
```

### 2. Integração no Layout Raiz
O Error Boundary está integrado no `providers.tsx`, envolvendo toda a aplicação:

```tsx
<GlobalErrorBoundary>
  <ThemeProvider>
    <Toaster />
    {children}
  </ThemeProvider>
</GlobalErrorBoundary>
```

## 🧪 Como Testar

### Componente de Teste (Apenas Desenvolvimento)
Use o `ErrorBoundaryTest` para simular erros:

```tsx
import { ErrorBoundaryTest } from '@/components/error';

// Em qualquer página de desenvolvimento
<ErrorBoundaryTest />
```

### Teste Manual
1. Adicione este código em qualquer componente para forçar um erro:
```tsx
const [shouldError, setShouldError] = useState(false);

if (shouldError) {
  throw new Error('Teste do Error Boundary');
}
```

## 📊 Logging e Monitoramento

O Error Boundary captura as seguintes informações:

- **Timestamp**: Quando o erro ocorreu
- **Error Details**: Mensagem, stack trace, nome do erro
- **Component Stack**: Árvore de componentes onde ocorreu
- **User Agent**: Informações do browser
- **URL**: Página onde ocorreu o erro
- **Error ID**: Identificador único para rastreamento

```json
{
  "timestamp": "2025-01-27T10:30:00.000Z",
  "error": {
    "message": "Cannot read property of undefined",
    "stack": "Error stack trace...",
    "name": "TypeError"
  },
  "errorInfo": {
    "componentStack": "Component stack trace..."
  },
  "userAgent": "Mozilla/5.0...",
  "url": "https://app.example.com/page",
  "errorId": "abc123"
}
```

## 🎨 UI de Fallback

Quando um erro é capturado, o usuário vê:

- ⚠️ **Ícone de Alerta**: Visual claro de que houve um problema
- 📝 **Mensagem Amigável**: Explicação em português brasileiro
- 🔄 **Botão "Tentar Novamente"**: Redefine o estado do Error Boundary
- 🔄 **Botão "Recarregar Página"**: Força reload completo da página
- 🔍 **Detalhes (Dev)**: Stack trace detalhado apenas em desenvolvimento
- 🆔 **Error ID**: Identificador para suporte técnico

## ⚙️ Customização

### Fallback Customizado
```tsx
<GlobalErrorBoundary fallback={<MeuComponenteCustomizado />}>
  {children}
</GlobalErrorBoundary>
```

### Integração com Serviços de Monitoramento
No `componentDidCatch`, você pode integrar com serviços como:
- Sentry
- LogRocket
- Datadog
- Bugsnag

```tsx
componentDidCatch(error, errorInfo) {
  // Sentry
  Sentry.captureException(error, { contexts: { react: errorInfo } });
  
  // Custom API
  fetch('/api/errors', {
    method: 'POST',
    body: JSON.stringify({ error, errorInfo })
  });
}
```

## 🛡️ Segurança

- Não expõe informações sensíveis em produção
- Logs detalhados apenas em desenvolvimento
- Fallback seguro que mantém a aplicação funcional
- Não interfere com outros Error Boundaries da aplicação

## 📦 Arquivos

- `GlobalErrorBoundary.tsx` - Componente principal
- `ErrorBoundaryTest.tsx` - Componente de teste (dev apenas)
- `index.ts` - Exports do módulo
- `README.md` - Esta documentação

## 🔄 Estados e Fluxo

1. **Estado Normal**: `hasError: false` - Renderiza children normalmente
2. **Erro Capturado**: `getDerivedStateFromError` atualiza estado
3. **Logging**: `componentDidCatch` executa logging
4. **UI Fallback**: Renderiza interface de erro
5. **Recuperação**: Botões permitem reset ou reload
6. **Estado Reset**: Volta ao estado normal após ação do usuário

## ✅ Benefícios

- **UX Superior**: Usuário nunca vê tela branca
- **Debugging Melhorado**: Logs estruturados facilitam investigação  
- **Produção Estável**: Aplicação continua funcionando mesmo com erros
- **Monitoramento**: Visibilidade completa de erros em produção
- **Recuperação Rápida**: Usuário pode resolver problema sem recarregar página