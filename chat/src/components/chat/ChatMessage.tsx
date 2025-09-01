import React from 'react'
import { marked } from 'marked'
import { Copy, Check, User, Bot, Code, Terminal, FileText, Brain, Wrench } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { cn, formatTokens, formatCost } from '@/lib/utils'

// Tipos para os blocos de conteúdo
interface TextBlock {
  text: string
}

interface ThinkingBlock {
  thinking: string
  signature: string
}

interface ToolUseBlock {
  id: string
  name: string
  input: { [key: string]: any }
}

interface ToolResultBlock {
  tool_use_id: string
  content?: string | Array<{ [key: string]: any }> | null
  is_error?: boolean | null
}

type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock

// Componentes individuais para cada tipo de bloco - Memoizados para performance
const TextBlockComponent: React.FC<{ block: TextBlock }> = React.memo(({ block }) => {
  const html = React.useMemo(() => marked(block.text, { 
    breaks: true,
    gfm: true
  }), [block.text])

  return (
    <div 
      className="markdown-content prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

const ThinkingBlockComponent: React.FC<{ block: ThinkingBlock }> = React.memo(({ block }) => {
  return (
    <div className="thinking-block border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 pl-4 py-3 my-3 rounded-r-lg">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Pensamento
        </span>
        <span className="text-xs text-muted-foreground">
          {block.signature}
        </span>
      </div>
      <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
        {block.thinking}
      </div>
    </div>
  )
})

const ToolUseBlockComponent: React.FC<{ block: ToolUseBlock }> = React.memo(({ block }) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null)

  // Mapeamento de cores por ferramenta
  const toolColorMap: Record<string, { bg: string; text: string; border: string; accent: string }> = {
    'Read': { 
      bg: 'bg-blue-50 dark:bg-blue-900/20', 
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-400',
      accent: 'text-blue-600 dark:text-blue-400'
    },
    'Write': { 
      bg: 'bg-green-50 dark:bg-green-900/20', 
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-400',
      accent: 'text-green-600 dark:text-green-400'
    },
    'Edit': { 
      bg: 'bg-amber-50 dark:bg-amber-900/20', 
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-400',
      accent: 'text-amber-600 dark:text-amber-400'
    },
    'MultiEdit': { 
      bg: 'bg-orange-50 dark:bg-orange-900/20', 
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-400',
      accent: 'text-orange-600 dark:text-orange-400'
    },
    'Bash': { 
      bg: 'bg-gray-50 dark:bg-gray-900/20', 
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-400',
      accent: 'text-gray-600 dark:text-gray-400'
    },
    'Grep': { 
      bg: 'bg-purple-50 dark:bg-purple-900/20', 
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-400',
      accent: 'text-purple-600 dark:text-purple-400'
    },
    'Glob': { 
      bg: 'bg-indigo-50 dark:bg-indigo-900/20', 
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-400',
      accent: 'text-indigo-600 dark:text-indigo-400'
    },
    'Task': { 
      bg: 'bg-pink-50 dark:bg-pink-900/20', 
      text: 'text-pink-700 dark:text-pink-300',
      border: 'border-pink-400',
      accent: 'text-pink-600 dark:text-pink-400'
    },
    'WebFetch': { 
      bg: 'bg-cyan-50 dark:bg-cyan-900/20', 
      text: 'text-cyan-700 dark:text-cyan-300',
      border: 'border-cyan-400',
      accent: 'text-cyan-600 dark:text-cyan-400'
    },
    'WebSearch': { 
      bg: 'bg-teal-50 dark:bg-teal-900/20', 
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-400',
      accent: 'text-teal-600 dark:text-teal-400'
    }
  }

  const defaultToolColor = {
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-400',
    accent: 'text-slate-600 dark:text-slate-400'
  }

  const toolColors = toolColorMap[block.name] || defaultToolColor

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

  return (
    <div className={`tool-use-block border-l-4 ${toolColors.border} ${toolColors.bg} pl-4 py-3 my-3 rounded-r-lg transition-all duration-200`}>
      <div 
        className="flex items-center gap-2 cursor-pointer hover:opacity-80" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Wrench className={`h-4 w-4 ${toolColors.accent}`} />
        <span className={`text-sm font-medium ${toolColors.text}`}>
          Usando ferramenta: {block.name}
        </span>
        <span className="text-xs text-muted-foreground">
          ID: {block.id.slice(-8)}
        </span>
        <span className="text-xs text-muted-foreground ml-auto transition-transform duration-200">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Parâmetros */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${toolColors.text} opacity-80`}>
                📥 Parâmetros
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopy(formatContent(block.input), 'input')
                }}
                className={`text-xs ${toolColors.text} hover:opacity-80 transition-colors`}
              >
                {copiedSection === 'input' ? '✓ Copiado' : '📋 Copiar'}
              </button>
            </div>
            <pre className={`text-xs ${toolColors.text} bg-white/50 dark:bg-black/20 p-3 rounded overflow-x-auto whitespace-pre-wrap border border-current/20`}>
              {formatContent(block.input)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
})

const ToolResultBlockComponent: React.FC<{ block: ToolResultBlock }> = React.memo(({ block }) => {
  const [copied, setCopied] = React.useState(false)
  const isError = block.is_error || false
  const borderColor = isError ? 'border-red-400' : 'border-green-400'
  const bgColor = isError ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'
  const textColor = isError ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
  const accentColor = isError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'

  const handleCopy = async () => {
    try {
      const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2)
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  const formatContent = (content: any): string => {
    if (typeof content === 'string') return content
    return JSON.stringify(content, null, 2)
  }

  return (
    <div className={`tool-result-block border-l-4 ${borderColor} ${bgColor} pl-4 py-3 my-3 rounded-r-lg transition-all duration-200`}>
      <div className="flex items-center gap-2 mb-2">
        <Terminal className={`h-4 w-4 ${accentColor}`} />
        <span className={`text-sm font-medium ${textColor}`}>
          {isError ? '❌ Erro na ferramenta' : '✅ Resultado da ferramenta'}
        </span>
        <span className="text-xs text-muted-foreground">
          ID: {block.tool_use_id.slice(-8)}
        </span>
        {block.content && (
          <button
            onClick={handleCopy}
            className={`ml-auto text-xs ${textColor} hover:opacity-80 transition-colors`}
          >
            {copied ? '✓ Copiado' : '📋 Copiar'}
          </button>
        )}
      </div>
      {block.content && (
        <pre className={`text-xs ${textColor} bg-white/50 dark:bg-black/20 p-3 rounded overflow-x-auto whitespace-pre-wrap border border-current/20`}>
          {formatContent(block.content)}
        </pre>
      )}
    </div>
  )
})

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system'
  content: string | { type: string; text?: string; thinking?: string } | Array<ContentBlock | any>
  timestamp?: Date
  tokens?: { input?: number; output?: number }
  cost?: number
  tools?: string[]
  isStreaming?: boolean
  sessionTitle?: string
  sessionId?: string
  sessionOrigin?: string
}

export function ChatMessage({ 
  role, 
  content, 
  timestamp, 
  tokens, 
  cost, 
  tools,
  isStreaming = false,
  sessionTitle,
  sessionId,
  sessionOrigin
}: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false)
  const messageRef = React.useRef<HTMLDivElement>(null)
  
  // Debug desabilitado - apenas para debugging específico quando necessário
  // Removido para prevenir loops infinitos de logging

  // Função para verificar se um item é um bloco específico
  const isTextBlock = (item: any): item is TextBlock => {
    return item && typeof item.text === 'string' && !item.thinking && !item.id
  }

  const isThinkingBlock = (item: any): item is ThinkingBlock => {
    return item && typeof item.thinking === 'string' && typeof item.signature === 'string'
  }

  const isToolUseBlock = (item: any): item is ToolUseBlock => {
    return item && typeof item.id === 'string' && typeof item.name === 'string' && item.input
  }

  const isToolResultBlock = (item: any): item is ToolResultBlock => {
    return item && typeof item.tool_use_id === 'string'
  }

  // Memoizar o processamento do conteúdo para evitar recálculos desnecessários
  const processedContent = React.useMemo(() => {
    const processMessageContent = (content: any): string => {
      if (typeof content === 'string') {
        return content;
      }
      
      if (Array.isArray(content)) {
        return content.map((item) => {
          // Compatibilidade com formato anterior
          if (item.type === 'text') return item.text;
          if (item.type === 'thinking') return `💭 ${item.thinking}`;
          
          // Novos tipos de bloco
          if (isTextBlock(item)) return item.text;
          if (isThinkingBlock(item)) return `💭 ${item.thinking}`;
          if (isToolUseBlock(item)) return `🔧 Usando ${item.name}`;
          if (isToolResultBlock(item)) return `📋 Resultado: ${item.content || 'N/A'}`;
          
          return JSON.stringify(item);
        }).join('\n\n');
      }
      
      // Compatibilidade com formato anterior
      if (content.type === 'text') return content.text;
      if (content.type === 'thinking') return `💭 ${content.thinking}`;
      
      return JSON.stringify(content, null, 2);
    };
    
    return processMessageContent(content);
  }, [content]);

  // Memoizar função de cópia para evitar recriação a cada render
  const getContentForCopy = React.useCallback((): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content.map((item) => {
        // Compatibilidade com formato anterior
        if (item.type === 'text') return item.text;
        if (item.type === 'thinking') return `=== PENSAMENTO ===\n${item.thinking}`;
        
        // Novos tipos de bloco
        if (isTextBlock(item)) return item.text;
        if (isThinkingBlock(item)) return `=== PENSAMENTO ===\n${item.thinking}`;
        if (isToolUseBlock(item)) {
          return `=== USO DE FERRAMENTA: ${item.name} ===\nID: ${item.id}\nParâmetros:\n${JSON.stringify(item.input, null, 2)}`;
        }
        if (isToolResultBlock(item)) {
          const status = item.is_error ? 'ERRO' : 'SUCESSO';
          return `=== RESULTADO DA FERRAMENTA (${status}) ===\nID: ${item.tool_use_id}\n${typeof item.content === 'string' ? item.content : JSON.stringify(item.content, null, 2)}`;
        }
        
        return JSON.stringify(item, null, 2);
      }).join('\n\n');
    }
    
    return processedContent;
  }, [content, processedContent]);

  const handleCopy = React.useCallback(async () => {
    const contentToCopy = getContentForCopy();
    await navigator.clipboard.writeText(contentToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [getContentForCopy])

  const getIcon = () => {
    switch (role) {
      case 'user':
        return <User className="h-5 w-5" />
      case 'assistant':
        return <Bot className="h-5 w-5" />
      default:
        return null
    }
  }

  const getToolIcon = (tool: string) => {
    const icons: { [key: string]: JSX.Element } = {
      'Read': <FileText className="h-4 w-4" />,
      'Write': <FileText className="h-4 w-4" />,
      'Bash': <Terminal className="h-4 w-4" />,
      'Code': <Code className="h-4 w-4" />
    }
    return icons[tool] || <Code className="h-4 w-4" />
  }

  const renderContent = React.useMemo(() => {
    if (role === 'user') {
      return <p className="whitespace-pre-wrap">{processedContent}</p>
    }

    // Se o conteúdo é um array, renderizar cada bloco individualmente
    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item, index) => {
            // Compatibilidade com formato anterior
            if (item.type === 'text') {
              return <TextBlockComponent key={`text-${index}`} block={{ text: item.text }} />
            }
            if (item.type === 'thinking') {
              return <ThinkingBlockComponent key={`thinking-${index}`} block={{ thinking: item.thinking, signature: '' }} />
            }
            
            // Novos tipos de bloco
            if (isTextBlock(item)) {
              return <TextBlockComponent key={`textblock-${index}`} block={item} />
            }
            if (isThinkingBlock(item)) {
              return <ThinkingBlockComponent key={`thinkingblock-${index}`} block={item} />
            }
            if (isToolUseBlock(item)) {
              return <ToolUseBlockComponent key={`tooluse-${item.id || index}`} block={item} />
            }
            if (isToolResultBlock(item)) {
              return <ToolResultBlockComponent key={`toolresult-${item.tool_use_id || index}`} block={item} />
            }
            
            // Fallback para tipos desconhecidos
            return (
              <div key={`unknown-${index}`} className="bg-muted p-3 rounded">
                <pre className="text-sm">{JSON.stringify(item, null, 2)}</pre>
              </div>
            )
          })}
        </div>
      )
    }

    // Para assistente com conteúdo string, renderizar markdown
    const html = marked(processedContent, { 
      breaks: true,
      gfm: true
    })

    return (
      <div 
        className="markdown-content prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }, [role, content, processedContent])

  return (
    <div 
      ref={messageRef}
      className={cn(
        "group relative mb-6 animate-in fade-in slide-in-from-bottom-2",
        role === 'user' ? "ml-12" : "mr-12"
      )}
    >
      <div className={cn(
        "flex gap-3",
        role === 'user' && "flex-row-reverse"
      )}>
        {/* Avatar */}
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          role === 'user' 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}>
          {getIcon()}
        </div>

        {/* Message Content */}
        <Card className={cn(
          "flex-1 overflow-hidden",
          isStreaming && "animate-pulse"
        )}>
          <div className="p-4">
            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {role === 'user' ? 'Você' : (() => {
                    const baseLabel = 'Claude';
                    if (sessionTitle && sessionTitle !== sessionId) return `${baseLabel} • ${sessionTitle}`;
                    if (sessionId && !sessionId.startsWith('temp-') && !sessionId.startsWith('project-')) {
                      return `${baseLabel} • ${sessionId.slice(-8)}`;
                    }
                    return baseLabel;
                  })()}
                  {sessionOrigin && sessionOrigin !== sessionId && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                      {sessionTitle}
                    </span>
                  )}
                </span>
                {timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {timestamp.toLocaleTimeString('pt-BR')}
                  </span>
                )}
                {tools && tools.length > 0 && (
                  <div className="flex items-center gap-1">
                    {tools.map((tool, i) => (
                      <span 
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                      >
                        {getToolIcon(tool)}
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!isStreaming && (
                <div className="opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className="h-8 w-8"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="text-sm">
              {renderContent}
            </div>

            {/* Footer with metrics */}
            {(tokens || cost || sessionId) && !isStreaming && (
              <div className="mt-3 flex items-center gap-4 border-t pt-2 text-xs text-muted-foreground">
                {tokens && (
                  <span>Tokens: {formatTokens(tokens.input, tokens.output)}</span>
                )}
                {cost && (
                  <span>Custo: USD {cost.toFixed(6)}</span>
                )}
                {sessionId && !sessionId.startsWith('temp-') && !sessionId.startsWith('project-') && (
                  <span title={sessionId}>Sessão: {sessionId.slice(-8)}</span>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}