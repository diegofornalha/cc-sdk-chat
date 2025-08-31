import React from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Separator } from '../../ui/separator'
import { cn } from '@/lib/utils'

// Mapeamento de cores por ferramenta
const toolColorMap: Record<string, { bg: string; text: string; border: string }> = {
  'Read': { 
    bg: 'bg-blue-100 dark:bg-blue-900/20', 
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800'
  },
  'Write': { 
    bg: 'bg-green-100 dark:bg-green-900/20', 
    text: 'text-green-800 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800'
  },
  'Edit': { 
    bg: 'bg-amber-100 dark:bg-amber-900/20', 
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800'
  },
  'MultiEdit': { 
    bg: 'bg-orange-100 dark:bg-orange-900/20', 
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800'
  },
  'Bash': { 
    bg: 'bg-gray-100 dark:bg-gray-900/20', 
    text: 'text-gray-800 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-800'
  },
  'Grep': { 
    bg: 'bg-purple-100 dark:bg-purple-900/20', 
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800'
  },
  'Glob': { 
    bg: 'bg-indigo-100 dark:bg-indigo-900/20', 
    text: 'text-indigo-800 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800'
  },
  'Task': { 
    bg: 'bg-pink-100 dark:bg-pink-900/20', 
    text: 'text-pink-800 dark:text-pink-300',
    border: 'border-pink-200 dark:border-pink-800'
  },
  'WebFetch': { 
    bg: 'bg-cyan-100 dark:bg-cyan-900/20', 
    text: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800'
  },
  'WebSearch': { 
    bg: 'bg-teal-100 dark:bg-teal-900/20', 
    text: 'text-teal-800 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800'
  }
}

// Fallback para ferramentas não mapeadas
const defaultToolColor = {
  bg: 'bg-slate-100 dark:bg-slate-900/20',
  text: 'text-slate-800 dark:text-slate-300', 
  border: 'border-slate-200 dark:border-slate-800'
}

export interface ToolUseBlockProps {
  toolName: string
  inputs?: Record<string, any>
  output?: any
  error?: string
  timestamp?: Date
  executionTime?: number
  className?: string
}

export function ToolUseBlock({
  toolName,
  inputs,
  output,
  error,
  timestamp,
  executionTime,
  className
}: ToolUseBlockProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null)

  const toolColors = toolColorMap[toolName] || defaultToolColor

  const handleCopy = async (content: string, section: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedSection(section)
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  const formatContent = (content: any): string => {
    if (typeof content === 'string') return content
    return JSON.stringify(content, null, 2)
  }

  const hasDetails = inputs || output || error

  return (
    <Card className={cn(
      "mb-3 overflow-hidden transition-all duration-200",
      "hover:shadow-sm",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center gap-3 p-3",
        toolColors.bg,
        "border-b",
        toolColors.border
      )}>
        {/* Badge da ferramenta */}
        <Badge 
          variant="outline" 
          className={cn(
            "font-medium",
            toolColors.text,
            toolColors.border,
            "bg-transparent"
          )}
        >
          {toolName}
        </Badge>

        {/* Status e informações */}
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {error && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                ❌ Erro
              </span>
            )}
            {!error && (
              <span className="text-green-600 dark:text-green-400 font-medium">
                ✅ Sucesso
              </span>
            )}
            
            {timestamp && (
              <span>
                {timestamp.toLocaleTimeString('pt-BR', { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                })}
              </span>
            )}
            
            {executionTime && (
              <span>
                {executionTime < 1000 ? `${executionTime}ms` : `${(executionTime / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>

          {/* Botão de expansão */}
          {hasDetails && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Detalhes expandíveis */}
      {isExpanded && hasDetails && (
        <div className="space-y-0">
          {/* Inputs */}
          {inputs && Object.keys(inputs).length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  📥 Parâmetros de Entrada
                </h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(formatContent(inputs), 'inputs')}
                >
                  {copiedSection === 'inputs' ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              
              <div className="space-y-2">
                {Object.entries(inputs).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <div className="font-medium text-muted-foreground mb-1">
                      {key}:
                    </div>
                    <pre className="bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                      {formatContent(value)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inputs && Object.keys(inputs).length > 0 && (output || error) && (
            <Separator />
          )}

          {/* Output ou Error */}
          {(output || error) && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {error ? '❌ Resultado (Erro)' : '📤 Resultado'}
                </h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(formatContent(output || error), 'output')}
                >
                  {copiedSection === 'output' ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              
              <pre className={cn(
                "bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs",
                error && "border-l-4 border-red-500 bg-red-50/50 dark:bg-red-900/10"
              )}>
                {formatContent(output || error)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Indicador de expansão quando fechado */}
      {!isExpanded && hasDetails && (
        <div className="px-4 pb-2">
          <div className="text-xs text-muted-foreground text-center border-t pt-2">
            Clique para ver detalhes
          </div>
        </div>
      )}
    </Card>
  )
}

export default ToolUseBlock