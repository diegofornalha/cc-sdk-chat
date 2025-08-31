import React from 'react'
import { ToolUseBlock } from './ToolUseBlock'

/**
 * Componente de exemplo demonstrando o uso do ToolUseBlock
 * com diferentes tipos de ferramentas e cenários
 */
export function ToolUseBlockExample() {
  const examples = [
    {
      toolName: 'Read',
      inputs: {
        file_path: '/home/user/projeto/src/components/Button.tsx',
        offset: 1,
        limit: 50
      },
      output: `     1→import React from 'react'
     2→import { cn } from '@/lib/utils'
     3→
     4→interface ButtonProps {
     5→  children: React.ReactNode
     6→  className?: string
     7→  onClick?: () => void
     8→}
     9→
    10→export function Button({ children, className, onClick }: ButtonProps) {
    11→  return (
    12→    <button 
    13→      className={cn('px-4 py-2 rounded-md', className)}
    14→      onClick={onClick}
    15→    >
    16→      {children}
    17→    </button>
    18→  )
    19→}`,
      timestamp: new Date(),
      executionTime: 45
    },
    
    {
      toolName: 'Write',
      inputs: {
        file_path: '/home/user/projeto/src/utils/helpers.ts',
        content: `export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}`
      },
      output: 'Arquivo criado com sucesso',
      timestamp: new Date(Date.now() - 120000), // 2 minutos atrás
      executionTime: 78
    },

    {
      toolName: 'Bash',
      inputs: {
        command: 'npm install --save-dev typescript @types/node',
        description: 'Instalar TypeScript e tipos do Node.js'
      },
      output: `npm WARN deprecated @types/node@18.19.4: This package is deprecated
+ typescript@5.3.3
+ @types/node@20.10.5
added 2 packages, and audited 1420 packages in 8s

found 0 vulnerabilities`,
      timestamp: new Date(Date.now() - 300000), // 5 minutos atrás  
      executionTime: 8234
    },

    {
      toolName: 'Grep',
      inputs: {
        pattern: 'interface.*Props',
        path: '/home/user/projeto/src',
        output_mode: 'content',
        '-n': true
      },
      output: `src/components/Button.tsx:4:interface ButtonProps {
src/components/Card.tsx:8:interface CardProps {
src/components/Modal.tsx:12:interface ModalProps {
src/hooks/useAuth.tsx:6:interface AuthProps {`,
      timestamp: new Date(Date.now() - 60000), // 1 minuto atrás
      executionTime: 156
    },

    {
      toolName: 'Task',
      inputs: {
        task_identifier: 'refactor_components',
        execution_prompt: 'Refatorar todos os componentes React para usar TypeScript strict e adicionar testes unitários',
        working_directory: '/home/user/projeto/src/components',
        model: 'sonnet'
      },
      error: `Task failed: Could not find tsconfig.json in working directory.
Please ensure TypeScript is properly configured before running this task.

Stack trace:
  at validateTypeScriptConfig (task-runner.js:45)
  at TaskRunner.execute (task-runner.js:123)
  at async executeTask (index.js:67)`,
      timestamp: new Date(Date.now() - 180000), // 3 minutos atrás
      executionTime: 2341
    },

    {
      toolName: 'WebFetch',
      inputs: {
        url: 'https://api.github.com/repos/facebook/react',
        prompt: 'Extract the repository description, stars count, and latest release information'
      },
      output: {
        description: 'The library for web and native user interfaces.',
        stars: 228543,
        latest_release: {
          tag_name: 'v18.2.0',
          published_at: '2024-01-15T10:30:00Z',
          name: 'React 18.2.0'
        }
      },
      timestamp: new Date(Date.now() - 240000), // 4 minutos atrás
      executionTime: 1567
    },

    {
      toolName: 'MultiEdit',
      inputs: {
        file_path: '/home/user/projeto/src/App.tsx',
        edits: [
          {
            old_string: "import './App.css'",
            new_string: "import './App.css'\nimport { ThemeProvider } from './components/ThemeProvider'"
          },
          {
            old_string: "function App() {\n  return (",
            new_string: "function App() {\n  return (\n    <ThemeProvider>"
          },
          {
            old_string: "  )\n}",
            new_string: "    </ThemeProvider>\n  )\n}"
          }
        ]
      },
      output: 'Successfully applied 3 edits to /home/user/projeto/src/App.tsx',
      timestamp: new Date(Date.now() - 90000), // 1.5 minutos atrás
      executionTime: 234
    }
  ]

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">ToolUseBlock - Exemplos</h1>
        <p className="text-muted-foreground">
          Demonstração do componente com diferentes ferramentas e cenários
        </p>
      </div>

      <div className="space-y-4">
        {examples.map((example, index) => (
          <ToolUseBlock
            key={index}
            toolName={example.toolName}
            inputs={example.inputs}
            output={example.output}
            error={example.error}
            timestamp={example.timestamp}
            executionTime={example.executionTime}
          />
        ))}
      </div>

      <div className="mt-12 p-6 bg-muted/30 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Recursos do Componente</h2>
        <ul className="space-y-2 text-sm">
          <li>✅ <strong>Badges coloridos por ferramenta:</strong> Cada ferramenta tem sua cor específica</li>
          <li>✅ <strong>Status visual:</strong> Indicadores de sucesso (✅) ou erro (❌)</li>
          <li>✅ <strong>Detalhes expandíveis:</strong> Clique para ver inputs e outputs</li>
          <li>✅ <strong>Função de cópia:</strong> Copie facilmente os dados de entrada ou saída</li>
          <li>✅ <strong>Informações de timing:</strong> Timestamp e tempo de execução</li>
          <li>✅ <strong>Formatação inteligente:</strong> JSON e texto são formatados adequadamente</li>
          <li>✅ <strong>Tema escuro/claro:</strong> Suporte completo para ambos os temas</li>
          <li>✅ <strong>Design responsivo:</strong> Funciona bem em diferentes tamanhos de tela</li>
        </ul>
      </div>
    </div>
  )
}

export default ToolUseBlockExample