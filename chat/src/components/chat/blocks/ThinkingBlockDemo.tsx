import React from 'react'
import { ThinkingBlock } from './ThinkingBlock'
import { Card } from '@/components/ui/card'

export function ThinkingBlockDemo() {
  const exampleThinking = `Preciso analisar esta solicitação cuidadosamente.

Primeiro, vou considerar os requisitos:
1. Criar um toggle colapsável
2. Usar <details> e <summary>
3. Implementar estilos cinza/itálico
4. Adicionar o ícone 💡 e texto "Ver raciocínio"

A implementação deve ser simples e seguir os padrões do projeto existente, usando as classes Tailwind já configuradas.

Vou usar o elemento HTML nativo <details> que já fornece funcionalidade de toggle sem necessidade de JavaScript adicional.`

  const shortThinking = "Este é um exemplo mais curto de raciocínio que também funciona perfeitamente no componente."

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-6">Demonstração do ThinkingBlock</h1>
      
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Exemplo com texto longo:</h2>
        <ThinkingBlock content={exampleThinking} />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Exemplo com texto curto:</h2>
        <ThinkingBlock content={shortThinking} />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Funcionamento:</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
          <li>Clique em "💡 Ver raciocínio" para expandir/colapsar</li>
          <li>A seta rotaciona ao expandir</li>
          <li>O conteúdo é mostrado com estilo itálico e cor cinza</li>
          <li>Animação suave ao abrir/fechar</li>
          <li>Borda lateral para destaque visual</li>
        </ul>
      </Card>
    </div>
  )
}