# 📌 Session ID Consistency - Documentação Importante

## 🎯 Objetivo
Manter um **Session ID fixo e consistente** para garantir que todas as mensagens sejam salvas no mesmo arquivo JSONL, preservando o histórico completo das conversas.

## 🔑 Session ID Unificado
```
00000000-0000-0000-0000-000000000001
```

## ⚙️ Implementação

### 1. Configuração no Frontend (`chat/src/lib/api.ts`)

```typescript
class ChatAPI {
  // ID fixo para manter histórico unificado (UUID válido especial)
  private readonly UNIFIED_SESSION_ID = '00000000-0000-0000-0000-000000000001';
  private readonly USE_UNIFIED_SESSION = true; // SEMPRE true para manter consistência
  
  constructor() {
    // SEMPRE usa sessão unificada com ID fixo
    if (this.USE_UNIFIED_SESSION) {
      this.sessionId = this.UNIFIED_SESSION_ID;
      console.log('📝 Usando Session ID Unificado:', this.sessionId);
      console.log('💾 Todas as conversas serão salvas no mesmo arquivo JSONL');
    }
  }
  
  setSessionId(sessionId: string | null) {
    // NÃO permite mudança quando em modo unificado
    if (this.USE_UNIFIED_SESSION) {
      console.log('⚠️ Modo de sessão unificada ativo. Session ID mantido:', this.UNIFIED_SESSION_ID);
      return;
    }
  }
}
```

## 🚨 IMPORTANTE - Não Modificar!

### Por que isso é crítico?

1. **Histórico Unificado**: Todas as conversas são salvas em um único arquivo JSONL, permitindo continuidade e contexto completo.

2. **Compatibilidade com Claude Code SDK**: O SDK espera um UUID válido específico para funcionar corretamente.

3. **Persistência de Dados**: Mudar o Session ID criaria novos arquivos JSONL, fragmentando o histórico.

4. **Integração com API**: A API FastAPI está configurada para trabalhar com este Session ID específico.

## 📁 Estrutura de Arquivos

```
/Users/2a/.claude/projects/
├── -Users-2a--claude/
│   └── [outros session IDs].jsonl
└── -Users-2a--claude-cc-sdk-chat-api/
    └── 00000000-0000-0000-0000-000000000001.jsonl  ← ARQUIVO PRINCIPAL
```

## ⚠️ Problemas que Ocorrem se Mudar

1. **Criação de novos arquivos JSONL**: Cada novo Session ID cria um arquivo separado
2. **Perda de contexto**: O histórico fica fragmentado em múltiplos arquivos
3. **Inconsistência na interface**: A página pode mostrar "Sessão vazia" mesmo com histórico
4. **Falha no streaming**: As respostas podem não aparecer em tempo real

## ✅ Verificação de Funcionamento

Para verificar se está funcionando corretamente:

1. Abra o console do navegador (F12)
2. Deve aparecer:
   ```
   📝 Usando Session ID Unificado: 00000000-0000-0000-0000-000000000001
   💾 Todas as conversas serão salvas no mesmo arquivo JSONL
   ```

3. Ao tentar mudar o Session ID, deve aparecer:
   ```
   ⚠️ Modo de sessão unificada ativo. Session ID mantido: 00000000-0000-0000-0000-000000000001
   ```

## 🔧 Configuração da API

A API também precisa estar configurada para aceitar este Session ID:
- Validação de UUID aceita o formato especial `00000000-0000-0000-0000-000000000001`
- Mapeamento correto para o diretório do projeto
- Salvamento no arquivo JSONL correto

## 📝 Notas Adicionais

- **Data de Implementação**: 10 de Setembro de 2025
- **Razão**: Manter consistência e unificação do histórico de conversas
- **Testado com**: Claude Code SDK v0.0.21, Next.js 14.2.20, FastAPI 0.104.1

## 🔒 Regra de Ouro

> **NUNCA modifique o Session ID unificado ou desative o modo USE_UNIFIED_SESSION**
> 
> Isso garantirá que todas as conversas continuem sendo salvas no mesmo arquivo e o histórico seja preservado.

---

*Este documento é crítico para o funcionamento correto do sistema. Mantenha-o sempre atualizado e consulte antes de fazer mudanças relacionadas ao Session ID.*