import React from 'react'
import { ChatMessage } from './ChatMessage'
import { MessageInput } from './MessageInput'
import { SessionTabs } from '../session/SessionTabs'
import { SessionConfigModal } from '../session/SessionConfigModal'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { 
  Settings, 
  Download, 
  Upload,
  RefreshCw,
  Trash2,
  Bot
} from 'lucide-react'
import useChatStore, { SessionConfig } from '@/stores/chatStore'
import ChatAPI from '@/lib/api'
import { cn } from '@/lib/utils'
import { Toaster, toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ChatInterfaceProps {
  sessionData?: any;
}

export function ChatInterface({ sessionData }: ChatInterfaceProps = {}) {
  const router = useRouter();
  const {
    sessions,
    activeSessionId,
    isStreaming,
    streamingContent,
    createSession,
    deleteSession,
    setActiveSession,
    addMessage,
    updateMessage,
    setStreaming,
    setStreamingContent,
    appendStreamingContent,
    updateMetrics,
    getActiveSession,
    clearSession,
    loadExternalSession
  } = useChatStore()

  const [showConfigModal, setShowConfigModal] = React.useState(false)
  const [api] = React.useState(() => new ChatAPI())
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const activeSession = getActiveSession()
  const sessionList = Array.from(sessions.values())

  // Auto-scroll para última mensagem
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, streamingContent])


  // Carregar histórico da sessão se fornecido via props
  React.useEffect(() => {
    console.log('🔍 ChatInterface recebeu sessionData:', sessionData);
    if (sessionData && sessionData.messages) {
      console.log('📥 Carregando', sessionData.messages.length, 'mensagens');
      // Usa função do store para carregar sessão externa (resolve problema Immer)
      loadExternalSession(sessionData)
      toast.success(`📋 Histórico carregado: ${sessionData.messages.length} mensagens`)
    }
  }, [sessionData, loadExternalSession])

  // Inicializar com uma sessão se não houver nenhuma
  React.useEffect(() => {
    if (sessions.size === 0 && !sessionData) {
      console.log('🆕 Criando nova sessão (sem sessionData)');
      createSession()
    } else if (sessionData) {
      console.log('📂 sessionData presente, aguardando carregamento...');
    }
  }, [sessionData])

  const handleNewSession = (config?: SessionConfig) => {
    const sessionId = createSession(config)
    setActiveSession(sessionId)
    toast.success('Nova sessão criada')
  }

  const handleSendMessage = async (content: string) => {
    if (!activeSessionId || isStreaming) return

    // Adiciona mensagem do usuário
    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date()
    })

    // Inicia streaming
    setStreaming(true)
    setStreamingContent('')

    try {
      let currentContent = ''
      let tools: string[] = []

      await api.sendMessage(
        content,
        (data) => {
          switch (data.type) {
            case 'assistant_text':
              currentContent += data.content || ''
              appendStreamingContent(data.content || '')
              break
            
            case 'tool_use':
              if (data.tool) {
                tools.push(data.tool)
                toast.info(`Usando ferramenta: ${data.tool}`)
              }
              break
            
            case 'result':
              // Adiciona mensagem completa do assistente
              if (currentContent) {
                addMessage(activeSessionId, {
                  role: 'assistant',
                  content: currentContent,
                  timestamp: new Date(),
                  tokens: {
                    input: data.input_tokens,
                    output: data.output_tokens
                  },
                  cost: data.cost_usd,
                  tools: tools.length > 0 ? tools : undefined
                })
              }
              
              // Atualiza métricas
              if (data.input_tokens || data.output_tokens || data.cost_usd) {
                updateMetrics(
                  activeSessionId,
                  { input: data.input_tokens, output: data.output_tokens },
                  data.cost_usd
                )
              }
              break
          }
        },
        (error) => {
          toast.error(`Erro: ${error}`)
        },
        () => {
          setStreaming(false)
          setStreamingContent('')
        }
      )
    } catch (error) {
      toast.error('Erro ao enviar mensagem')
      setStreaming(false)
      setStreamingContent('')
    }
  }

  const handleInterrupt = async () => {
    try {
      await api.interruptSession()
      setStreaming(false)
      setStreamingContent('')
      toast.info('Resposta interrompida')
    } catch (error) {
      toast.error('Erro ao interromper')
    }
  }

  const handleClearSession = async () => {
    if (!activeSessionId) return
    
    try {
      await api.clearSession()
      clearSession(activeSessionId)
      toast.success('Sessão limpa')
    } catch (error) {
      toast.error('Erro ao limpar sessão')
    }
  }

  const handleExportSession = () => {
    if (!activeSession) return
    
    const dataStr = JSON.stringify(activeSession, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `chat-session-${activeSession.id}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    
    toast.success('Sessão exportada')
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Claude Chat</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportSession}
              disabled={!activeSession}
              title="Exportar sessão"
            >
              <Download className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toast.info('Importação em desenvolvimento')}
              title="Importar sessão"
            >
              <Upload className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toast.info('Configurações em desenvolvimento')}
              title="Configurações"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Session Tabs */}
        <SessionTabs
          sessions={sessionList}
          activeSessionId={activeSessionId}
          onSessionSelect={setActiveSession}
          onSessionClose={deleteSession}
          onNewSession={() => setShowConfigModal(true)}
          onAnalytics={() => toast.info('Analytics em desenvolvimento')}
        />
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-4xl">
              {activeSession?.messages.length === 0 && !isStreaming && (
                <Card className="p-8 text-center">
                  <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h2 className="mt-4 text-lg font-medium">Comece uma conversa</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Digite uma mensagem abaixo para iniciar
                  </p>
                </Card>
              )}
              
              {activeSession?.messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  tokens={message.tokens}
                  cost={message.cost}
                  tools={message.tools}
                  sessionTitle={activeSession.title}
                  sessionId={activeSession.id}
                />
              ))}
              
              {isStreaming && streamingContent && (
                <ChatMessage
                  role="assistant"
                  content={streamingContent}
                  isStreaming
                  sessionTitle={activeSession?.title}
                  sessionId={activeSession?.id}
                />
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Session Actions */}
          {activeSession && (
            <div className="border-t px-4 py-2">
              <div className="mx-auto flex max-w-4xl items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Mensagens: {activeSession.messages.length}</span>
                  <span>Tokens: {activeSession.metrics.totalTokens}</span>
                  <span>Custo: ${activeSession.metrics.totalCost.toFixed(4)}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSession}
                    disabled={isStreaming}
                  >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Limpar
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (activeSessionId) {
                        deleteSession(activeSessionId)
                        toast.success('Sessão deletada')
                      }
                    }}
                    disabled={isStreaming}
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Deletar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Message Input */}
          <MessageInput
            onSend={handleSendMessage}
            onInterrupt={handleInterrupt}
            isStreaming={isStreaming}
            disabled={!activeSessionId}
          />
        </div>
      </div>

      {/* Session Config Modal */}
      <SessionConfigModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        onConfirm={(config) => {
          handleNewSession(config)
          setShowConfigModal(false)
        }}
      />

    </div>
  )
}