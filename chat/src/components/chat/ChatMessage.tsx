import React from 'react'
import { marked } from 'marked'
import { Copy, Check, User, Bot, Code, Terminal, FileText } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { cn, formatTokens, formatCost } from '@/lib/utils'

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system'
  content: string | { type: string; text?: string; thinking?: string } | Array<any>
  timestamp?: Date
  tokens?: { input?: number; output?: number }
  cost?: number
  tools?: string[]
  isStreaming?: boolean
  sessionTitle?: string
  sessionId?: string
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
  sessionId
}: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false)
  const messageRef = React.useRef<HTMLDivElement>(null)

  const processMessageContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content.map((item) => {
        if (item.type === 'text') return item.text;
        if (item.type === 'thinking') return `💭 ${item.thinking}`;
        return JSON.stringify(item);
      }).join('\n\n');
    }
    
    if (content.type === 'text') return content.text;
    if (content.type === 'thinking') return `💭 ${content.thinking}`;
    
    return JSON.stringify(content, null, 2);
  };

  const processedContent = processMessageContent(content);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(processedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

  const renderContent = () => {
    if (role === 'user') {
      return <p className="whitespace-pre-wrap">{processedContent}</p>
    }

    // Para assistente, renderizar markdown
    const html = marked(processedContent, { 
      breaks: true,
      gfm: true,
      headerIds: false
    })

    return (
      <div 
        className="markdown-content prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

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
                  {role === 'user' ? 'Você' : `Claude${sessionTitle ? ` • ${sessionTitle}` : sessionId ? ` • ${sessionId.slice(-8)}` : ''}`}
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
              {renderContent()}
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
                {sessionId && !sessionId.startsWith('session-') && (
                  <span>Sessão: {sessionId}</span>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}