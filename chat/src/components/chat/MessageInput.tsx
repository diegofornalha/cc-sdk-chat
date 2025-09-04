import React from 'react'
import { Send, RefreshCw, Mic, Square } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { useHotkeys } from 'react-hotkeys-hook'

interface MessageInputProps {
  onSend: (message: string) => void
  onInterrupt?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
  sessionId?: string
  isFirstMessage?: boolean
  sessionTitle?: string
}

export function MessageInput({
  onSend,
  onInterrupt,
  isStreaming = false,
  disabled = false,
  placeholder = "Digite sua mensagem... (Ctrl+Enter para enviar)",
  sessionId,
  isFirstMessage = false,
  sessionTitle
}: MessageInputProps) {
  const [message, setMessage] = React.useState('')
  const [isComposing, setIsComposing] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // 🔒 DETECTA SESSÕES DO TERMINAL (somente leitura)
  const isTerminalSession = React.useMemo(() => {
    // Detecta pela URL se é sessão do terminal (-home-suthub--claude)
    const isTerminalProject = window.location.pathname.includes('-home-suthub--claude') && 
                              !window.location.pathname.includes('-home-suthub--claude-api-claude-code-app');
    
    return (
      sessionId?.startsWith('project-') ||
      sessionTitle?.includes('Terminal') ||
      sessionTitle?.includes('sessões') ||
      (isTerminalProject && !!sessionId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/))
    )
  }, [sessionId, sessionTitle])

  // Define placeholder baseado no tipo de sessão
  const effectivePlaceholder = React.useMemo(() => {
    if (isTerminalSession) {
      return "🔒 Agente SutHub • Claude"
    }
    return placeholder
  }, [isTerminalSession, placeholder])

  // Define se input está desabilitado
  const isInputDisabled = disabled || isTerminalSession

  // Atalho para enviar mensagem
  useHotkeys('ctrl+enter, cmd+enter', () => {
    if (!isComposing && message.trim() && !isInputDisabled && !isStreaming) {
      handleSend()
    }
  }, {
    enableOnFormTags: ['textarea']
  })

  // Atalho para focar no input
  useHotkeys('/', () => {
    textareaRef.current?.focus()
  })

  const handleSend = async () => {
    if (message.trim() && !isInputDisabled && !isStreaming) {
      let finalMessage = message.trim()
      
      // 🔗 DETECÇÃO INTELIGENTE: Se for primeira mensagem, buscar contexto anterior
      if (isFirstMessage && sessionId) {
        try {
          const projectPath = window.location.pathname.split('/').slice(1).join('/')
          const baseProjectPath = `/home/suthub/.claude/projects/${projectPath}`
          
          const response = await fetch('/api/load-project-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              projectPath: baseProjectPath,
              primarySessionId: sessionId 
            })
          })
          
          if (response.ok) {
            const { sessions, totalFiles } = await response.json()
            
            // Se encontrou outras sessões, incluir contexto
            if (sessions.length > 1 || totalFiles > 1) {
              const otherSessions = sessions.filter((s: any) => s.id !== sessionId)
              if (otherSessions.length > 0) {
                const latestSession = otherSessions[otherSessions.length - 1]
                const recentMessages = latestSession.messages.slice(-2) // Últimas 2 mensagens
                
                const contextSummary = recentMessages
                  .map((msg: any) => `${msg.role}: ${msg.content.substring(0, 100)}...`)
                  .join('\n')
                
                finalMessage = `[CONTEXTO AUTOMÁTICO] Continuando conversa iniciada no terminal.
                
Sessão anterior: ${latestSession.id}
Últimas mensagens:
${contextSummary}

---
Mensagem atual: ${finalMessage}`
              }
            }
          }
        } catch (error) {
          console.error('Erro ao buscar contexto anterior:', error)
          // Continue com mensagem original se houver erro
        }
      }
      
      onSend(finalMessage)
      setMessage('')
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  React.useEffect(() => {
    adjustHeight()
  }, [message])

  return (
    <div className="relative border-t bg-background p-4">
      <div className="mx-auto max-w-4xl">
        <div className="relative flex items-end gap-2">
          {/* Textarea */}
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={effectivePlaceholder}
              disabled={isInputDisabled || isStreaming}
              className={cn(
                "w-full resize-none rounded-lg border bg-background px-4 py-3 pr-12",
                "text-sm placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "min-h-[52px] max-h-[200px]"
              )}
              rows={1}
            />
            
            {/* Character counter */}
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {message.length > 0 && (
                <span>{message.length} / 4000</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {/* Refresh button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isInputDisabled || isStreaming}
              className="h-[52px] w-[52px]"
              onClick={() => window.location.reload()}
              title="Atualizar página"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>

            {/* Send/Interrupt button */}
            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={onInterrupt}
                className="h-[52px] w-[52px]"
                title="Interromper (Ctrl+C)"
              >
                <Square className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={handleSend}
                disabled={isInputDisabled || !message.trim()}
                className="h-[52px] w-[52px]"
                title="Enviar (Ctrl+Enter)"
              >
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Indicador de sessão bloqueada (se necessário) */}
        {isTerminalSession && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <div className="flex h-2 w-2 items-center justify-center">
                  <div className="h-full w-full rounded-full bg-blue-500" />
                </div>
                Agente SutHub • Claude
              </span>
            </div>
            <span>
              {isStreaming ? 'Gerando resposta...' : 'Pronto para enviar'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}