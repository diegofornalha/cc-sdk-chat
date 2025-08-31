# Exemplo de Uso do ThinkingBlock

## Como importar:
```tsx
import { ThinkingBlock } from '@/components/chat/blocks/ThinkingBlock'
```

## Uso básico:
```tsx
<ThinkingBlock 
  content="Este é o conteúdo do raciocínio que será mostrado quando expandido..."
/>
```

## Integração no ChatMessage:

Para integrar o ThinkingBlock no ChatMessage quando o conteúdo contém pensamento:

```tsx
// No ChatMessage.tsx, adicione a importação:
import { ThinkingBlock } from './blocks/ThinkingBlock'

// Modifique a função renderContent() para detectar e renderizar blocos de pensamento:
const renderContent = () => {
  if (typeof content === 'object' && content.thinking) {
    return (
      <>
        <ThinkingBlock content={content.thinking} />
        {content.text && <div className="markdown-content prose prose-sm dark:prose-invert max-w-none" 
          dangerouslySetInnerHTML={{ __html: marked(content.text) }} />}
      </>
    )
  }

  // Restante do código atual...
}
```

## Funcionalidades:
- ✅ Toggle colapsável usando `<details>` e `<summary>`
- ✅ Ícone 💡 e texto "Ver raciocínio"
- ✅ Seta que rotaciona ao expandir/colapsar
- ✅ Estilos cinza/itálico para o conteúdo expandido
- ✅ Animação suave ao abrir/fechar
- ✅ Borda lateral para destaque visual
- ✅ Integração com tema escuro/claro