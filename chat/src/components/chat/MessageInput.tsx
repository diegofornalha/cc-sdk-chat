import React from 'react'
import { Send, Paperclip, Mic, Square, Command } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { useHotkeys } from 'react-hotkeys-hook'

interface MessageInputProps {
  onSend: (message: string) => void
  onInterrupt?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSend,
  onInterrupt,
  isStreaming = false,
  disabled = false,
  placeholder = "Digite sua mensagem... (Ctrl+Enter para enviar)"
}: MessageInputProps) {
  const [message, setMessage] = React.useState('')
  const [isComposing, setIsComposing] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Atalho para enviar mensagem
  useHotkeys('ctrl+enter, cmd+enter', () => {
    if (!isComposing && message.trim() && !disabled && !isStreaming) {
      handleSend()
    }
  }, {
    enableOnFormTags: ['textarea']
  })

  // Atalho para focar no input
  useHotkeys('/', () => {
    textareaRef.current?.focus()
  })

  const handleSend = () => {
    if (message.trim() && !disabled && !isStreaming) {
      onSend(message.trim())
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
              placeholder={placeholder}
              disabled={disabled || isStreaming}
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
            {/* Attach button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled || isStreaming}
              className="h-[52px] w-[52px]"
              title="Anexar arquivo (em breve)"
            >
              <Paperclip className="h-5 w-5" />
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
                disabled={disabled || !message.trim()}
                className="h-[52px] w-[52px]"
                title="Enviar (Ctrl+Enter)"
              >
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Shortcuts hint */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Command className="h-3 w-3" />
              <kbd>K</kbd> Command Palette
            </span>
            <span>
              <kbd>Shift+Enter</kbd> Nova linha
            </span>
            <span>
              <kbd>/</kbd> Focar input
            </span>
          </div>
          <span>
            {isStreaming ? 'Gerando resposta...' : 'Pronto para enviar'}
          </span>
        </div>
      </div>
    </div>
  )
}