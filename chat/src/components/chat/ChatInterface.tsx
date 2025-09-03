import React from 'react'
import { ChatMessage } from './ChatMessage'
import { MessageInput } from './MessageInput'
import { SessionTabs } from '../session/SessionTabs'
import { SessionConfigModal } from '../session/SessionConfigModal'
import { ProcessingIndicator } from '../../../components/ProcessingIndicator'
import { ChatErrorBoundary } from '../error/ChatErrorBoundary'
import SessionErrorBoundary from '../error/SessionErrorBoundary'
import { useSessionRecovery } from '@/hooks/useSessionRecovery'
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
  readOnly?: boolean;
}

export function ChatInterface({ sessionData, readOnly = false }: ChatInterfaceProps = {}) {
  const router = useRouter();
  const {
    sessions,
    activeSessionId,
    isStreaming,
    streamingContent,
    isProcessing,
    createSession,
    deleteSession,
    setActiveSession,
    addMessage,
    updateMessage,
    setStreaming,
    setStreamingContent,
    appendStreamingContent,
    setProcessing,
    updateMetrics,
    getActiveSession,
    clearSession,
    loadExternalSession,
    loadCrossSessionHistory,
    migrateToRealSession
  } = useChatStore()

  const { 
    cleanupCorruptedSession, 
    recoverSession, 
    createReplacementSession 
  } = useSessionRecovery()

  const [showConfigModal, setShowConfigModal] = React.useState(false)
  const [api] = React.useState(() => new ChatAPI())
  const [isTyping, setIsTyping] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const typingQueueRef = React.useRef<string[]>([])

  const activeSession = getActiveSession()
  const sessionList = Array.from(sessions.values())

  // Função para processar fila de digitação com efeito de typing
  const processTypingQueue = React.useCallback(() => {
    if (typingQueueRef.current.length === 0) {
      setIsTyping(false)
      return
    }

    setIsTyping(true)
    const chunk = typingQueueRef.current.shift()!
    const words = chunk.split(/(\s+)/)
    
    let wordIndex = 0
    
    const typeNextWord = () => {
      if (wordIndex >= words.length) {
        // Terminou este chunk, processa próximo
        processTypingQueue()
        return
      }

      const word = words[wordIndex]
      appendStreamingContent(word)
      wordIndex++

      // Calcula delay baseado no tipo de palavra
      let delay = Math.random() * 40 + 80 // 80-120ms base
      
      // Palavras técnicas/longas têm delay maior
      if (word.length > 8 || /[{}()\[\]<>]/.test(word)) {
        delay += 50
      }
      
      // Pontuação tem pausa maior
      if (/[.!?:;]/.test(word)) {
        delay += 200
      }
      
      // Espaços em branco são processados mais rapidamente
      if (/^\s+$/.test(word)) {
        delay = 20 // Espaços são "digitados" muito rapidamente
      }
      
      // Code blocks têm ritmo diferente
      if (word.includes('```') || word.includes('`')) {
        delay += 100 // Pausa antes/depois de code blocks
      }

      typingTimeoutRef.current = setTimeout(typeNextWord, delay)
    }

    typeNextWord()
  }, [])

  // Adiciona chunk à fila de digitação
  const addToTypingQueue = React.useCallback((content: string) => {
    typingQueueRef.current.push(content)
    
    // Se não está digitando, inicia processo
    if (!isTyping && typingQueueRef.current.length === 1) {
      processTypingQueue()
    }
  }, [isTyping, processTypingQueue])

  // Limpa fila de digitação (para interrupções)
  const clearTypingQueue = React.useCallback(() => {
    typingQueueRef.current = []
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    setIsTyping(false)
  }, [])

  // Aguarda finalização da digitação antes de executar callback
  const waitForTypingToFinish = React.useCallback((callback?: () => void) => {
    if (!isTyping && typingQueueRef.current.length === 0) {
      // Não está digitando, executa imediatamente
      callback?.()
      return Promise.resolve()
    }
    
    return new Promise<void>((resolve) => {
      let timeoutId: NodeJS.Timeout | null = null
      
      const checkTyping = () => {
        if (!isTyping && typingQueueRef.current.length === 0) {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          callback?.()
          resolve()
        } else {
          // Verifica novamente em 50ms
          timeoutId = setTimeout(checkTyping, 50)
        }
      }
      
      checkTyping()
    })
  }, [isTyping])

  // Auto-scroll para última mensagem
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, streamingContent])

  // Cleanup da fila de digitação e timeouts
  React.useEffect(() => {
    return () => {
      // Limpa fila de digitação
      clearTypingQueue()
      
      // Garante limpeza do timeout principal mesmo se clearTypingQueue falhar
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      
      // Limpa fila residual
      typingQueueRef.current = []
    }
  }, [])

  // Event listener para recovery de streaming
  React.useEffect(() => {
    const handleChatInterrupt = () => {
      console.log('🚨 Chat interrupt event received');
      clearTypingQueue()
      setStreaming(false)
      setStreamingContent('')
      setProcessing(false)
    }

    const handleStreamingError = (event: any) => {
      console.log('🚨 Streaming error event received:', event.detail);
      if (isStreaming) {
        clearTypingQueue()
        setStreaming(false)
        setStreamingContent('')
        setProcessing(false)
        toast.error('Erro no streaming - Estados limpos')
      }
    }

    const handleStreamingRecovery = () => {
      console.log('♻️ Streaming recovery event received');
      // Força limpeza completa dos estados
      handleChatErrorRecovery()
    }

    // Registra event listeners
    window.addEventListener('chat-interrupt', handleChatInterrupt)
    window.addEventListener('streaming-error', handleStreamingError)
    window.addEventListener('streaming-recovery', handleStreamingRecovery)

    // Guarda timers para limpeza global
    if (!(window as any).__chatTimers) {
      (window as any).__chatTimers = []
    }

    return () => {
      window.removeEventListener('chat-interrupt', handleChatInterrupt)
      window.removeEventListener('streaming-error', handleStreamingError)
      window.removeEventListener('streaming-recovery', handleStreamingRecovery)
    }
  }, [isStreaming])


  // Carregar histórico da sessão se fornecido via props
  React.useEffect(() => {
    if (sessionData && sessionData.messages) {
      // Usa função do store para carregar sessão externa (resolve problema Immer)
      loadExternalSession(sessionData)
      
      // Carrega também histórico cruzado de outras sessões do projeto
      loadCrossSessionHistory(sessionData.id).then(() => {
        // Verifica se é continuação (1 arquivo) ou múltiplas sessões
        const sessionCount = sessions.size
        if (sessionCount === 1) {
          toast.success(`💬 Continuando conversa do Terminal`)
        } else {
          toast.success(`📋 Histórico unificado: ${sessionCount} sessões carregadas`)
        }
      }).catch(error => {
        console.error('❌ Erro ao carregar histórico cruzado:', error)
        toast.error('Erro ao carregar histórico completo')
      })
    }
  }, [sessionData, loadExternalSession, loadCrossSessionHistory])

  // 🚀 AGUARDA PRIMEIRA MENSAGEM: Não cria sessões temporárias
  React.useEffect(() => {
    if (sessions.size === 0 && !sessionData) {
      // Não faz nada - aguarda usuário enviar primeira mensagem
    }
  }, [sessionData])

  // 📨 RECUPERA MENSAGEM PRESERVADA APÓS REDIRECIONAMENTO
  React.useEffect(() => {
    const pendingMessage = sessionStorage.getItem('pendingMessage')
    if (pendingMessage && activeSessionId && !activeSessionId.startsWith('project-') && !activeSessionId.startsWith('temp-')) {
      // Edge case: Verifica se não está em streaming para evitar conflitos
      if (!isStreaming) {
        // Remove da sessionStorage
        sessionStorage.removeItem('pendingMessage')
        
        // Aguarda um tick para garantir que o componente está totalmente carregado
        setTimeout(() => {
          handleSendMessage(pendingMessage)
        }, 100)
      } else {
        // Se está em streaming, tenta novamente depois
        setTimeout(() => {
          if (!isStreaming) {
            sessionStorage.removeItem('pendingMessage')
            handleSendMessage(pendingMessage)
          }
        }, 1000)
      }
    }
  }, [activeSessionId, isStreaming])

  const handleNewSession = (config?: SessionConfig) => {
    const sessionId = createSession(config)
    setActiveSession(sessionId)
    toast.success('Nova sessão criada')
  }

  const handleSendMessage = async (content: string) => {
    if (isStreaming) return

    // 🚀 FLUXO SIMPLIFICADO - Sem redirecionamentos automáticos

    let currentSessionId = activeSessionId
    
    // Se não há sessão ativa, cria uma nova (será migrada para real automaticamente)
    if (!currentSessionId) {
      currentSessionId = createSession()
      setActiveSession(currentSessionId)
    }
    
    // Adiciona mensagem do usuário
    addMessage(currentSessionId, {
      role: 'user',
      content,
      timestamp: new Date()
    })

    // Limpa qualquer digitação em andamento
    clearTypingQueue()
    
    // Inicia streaming
    setStreaming(true)
    setStreamingContent('')
    setProcessing(true)

    try {
      let currentContent = ''
      let tools: string[] = []
      let isFirstTextChunk = true

      await api.sendMessage(
        content,
        (data) => {
          switch (data.type) {
            case 'session_migrated':
              // Processado automaticamente pelo sistema de migração existente
              break
              
            case 'processing':
              // Mantém indicador "Processando..." ativo
              setProcessing(true)
              break
              
            case 'text_chunk':
            case 'assistant_text':
              // Para o indicador "Processando..." no primeiro chunk de texto
              if (isFirstTextChunk) {
                setProcessing(false)
                isFirstTextChunk = false
              }
              
              // Adiciona à fila de digitação em vez de mostrar direto
              if (data.content) {
                addToTypingQueue(data.content)
                currentContent += data.content
              }
              break
            
            case 'tool_use':
              if (data.tool) {
                tools.push(data.tool)
                const toolMsg = `\n📦 Usando ferramenta: ${data.tool}\n`
                addToTypingQueue(toolMsg)
                currentContent += toolMsg
                toast.info(`Usando ferramenta: ${data.tool}`)
              }
              break
              
            case 'tool_result':
              // Processa resultados de ferramentas se necessário
              break
            
            case 'result':
              // MIGRAÇÃO IMEDIATA: SDK retornou session_id real
              if (data.session_id) {
                // SEMPRE migra se a sessão atual é temporária
                if (currentSessionId && currentSessionId.startsWith('temp-')) {
                  // Migração IMEDIATA sem validação desnecessária
                  migrateToRealSession(data.session_id)
                  
                  // Atualiza referência local
                  currentSessionId = data.session_id
                  
                  // Aguarda um tick para garantir que o store foi atualizado
                  setTimeout(() => {
                    const updatedActiveSession = getActiveSession()
                    
                    // Força re-renderização se necessário
                    if (updatedActiveSession?.id !== data.session_id) {
                      setActiveSession(data.session_id)
                    }
                  }, 100)
                  
                  // Atualiza a URL imediatamente
                  const currentPath = window.location.pathname
                  
                  if (currentPath === '/' || currentPath === '' || currentPath.includes('temp-')) {
                    const projectPath = '-home-suthub--claude-api-claude-code-app-cc-sdk-chat'
                    const newUrl = `/${projectPath}/${data.session_id}`
                    router.push(newUrl)
                    toast.success(`✅ Sessão real criada!`)
                  }
                } else if (data.session_id !== currentSessionId) {
                  // Sessão já é real mas diferente - apenas atualiza
                  currentSessionId = data.session_id
                }
              }
              
              // Usa o sessionId correto (pode ter sido atualizado acima)
              const finalSessionId = data.session_id || currentSessionId || activeSessionId
              
              // Adiciona mensagem completa do assistente
              if (currentContent && finalSessionId) {
                addMessage(finalSessionId, {
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
              
              // Atualiza métricas com sessionId correto
              if ((data.input_tokens || data.output_tokens || data.cost_usd) && finalSessionId) {
                updateMetrics(
                  finalSessionId,
                  { input: data.input_tokens, output: data.output_tokens },
                  data.cost_usd
                )
              }
              break
          }
        },
        (error) => {
          // Aguarda digitação terminar antes de mostrar erro
          waitForTypingToFinish(() => {
            toast.error(`Erro: ${error}`)
            setProcessing(false)
          })
        },
        () => {
          // Aguarda digitação terminar antes de finalizar streaming
          waitForTypingToFinish(() => {
            setStreaming(false)
            setStreamingContent('')
            setProcessing(false)
          })
        }
      )
    } catch (error) {
      // Aguarda digitação terminar antes de mostrar erro
      waitForTypingToFinish(() => {
        toast.error('Erro ao enviar mensagem')
        setStreaming(false)
        setStreamingContent('')
        setProcessing(false)
      })
    }
  }

  const handleInterrupt = async () => {
    try {
      // Primeiro interrompe a digitação
      clearTypingQueue()
      
      await api.interruptSession()
      setStreaming(false)
      setStreamingContent('')
      setProcessing(false)
      toast.info('Resposta interrompida')
    } catch (error) {
      // Mesmo se houver erro na interrupção da API, limpa os estados locais
      clearTypingQueue()
      setStreaming(false)
      setStreamingContent('')
      setProcessing(false)
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

  // Funções de recovery para ChatErrorBoundary
  const handleChatErrorRecovery = () => {
    // Limpa estados que podem estar corrompidos
    clearTypingQueue()
    setStreaming(false)
    setStreamingContent('')
    setProcessing(false)
    
    // Força re-renderização do componente
    if (activeSessionId) {
      const currentSession = getActiveSession()
      if (currentSession) {
        setActiveSession(activeSessionId)
      }
    }
    
    toast.info('♻️ Chat recuperado - Estados limpos')
  }

  const handlePreserveSession = () => {
    if (!activeSession) return
    
    try {
      // Cria backup da sessão atual
      const backupData = {
        ...activeSession,
        backupTimestamp: Date.now(),
        isStreaming,
        streamingContent,
        url: window.location.href
      }
      
      const backupKey = `chat_session_backup_${activeSession.id}`
      localStorage.setItem(backupKey, JSON.stringify(backupData))
      
      // Também exporta automaticamente
      const dataStr = JSON.stringify(backupData, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      const exportFileDefaultName = `chat-backup-${activeSession.id}-${Date.now()}.json`
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
      
      toast.success('💾 Sessão preservada e exportada!')
    } catch (error) {
      console.error('Erro ao preservar sessão:', error)
      toast.error('Erro ao preservar sessão')
    }
  }

  // Handlers específicos para SessionErrorBoundary da sessão ativa
  const handleActiveSessionCleanup = React.useCallback((sessionId: string) => {
    console.log(`🧹 Interface executando cleanup da sessão ativa: ${sessionId}`);
    cleanupCorruptedSession(sessionId);
  }, [cleanupCorruptedSession]);

  const handleActiveSessionRecovery = React.useCallback((sessionId: string) => {
    console.log(`🔄 Interface executando recuperação da sessão ativa: ${sessionId}`);
    return recoverSession(sessionId);
  }, [recoverSession]);

  const handleCreateNewSessionAfterError = React.useCallback(() => {
    console.log(`➕ Interface criando nova sessão após erro`);
    const newSessionId = createReplacementSession();
    if (newSessionId) {
      setActiveSession(newSessionId);
      toast.success('Nova sessão criada após erro');
    }
  }, [createReplacementSession, setActiveSession]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <Toaster position="top-right" />
      
      
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold">Claude Chat</h1>
              {sessionData && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    Claude Code SDK
                  </span>
                  {window.location.pathname.includes('-home-suthub--claude-api-claude-code-app') ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      🚀 Projeto
                    </span>
                  ) : window.location.pathname.includes('-home-suthub--claude') ? (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      🏠 Terminal
                    </span>
                  ) : (
                    <span>Sessão Oficial</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {readOnly && (
              <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Modo Somente Leitura
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportSession}
              disabled={!activeSession}
              title="Exportar sessão"
            >
              <Download className="h-5 w-5" />
            </Button>
            
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toast.info('Importação em desenvolvimento')}
                title="Importar sessão"
              >
                <Upload className="h-5 w-5" />
              </Button>
            )}
            
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
        {/* Chat Area - Protegida por ChatErrorBoundary */}
        <ChatErrorBoundary 
          sessionId={activeSessionId}
          onErrorRecovery={handleChatErrorRecovery}
          onPreserveSession={handlePreserveSession}
        >
          <div className="flex flex-1 flex-col">
          {/* Messages - Protegida por SessionErrorBoundary específica */}
          {activeSession ? (
            <SessionErrorBoundary
              sessionId={activeSession.id}
              sessionTitle={activeSession.title}
              onSessionCleanup={handleActiveSessionCleanup}
              onSessionRecovery={handleActiveSessionRecovery}
              onCreateNewSession={handleCreateNewSessionAfterError}
            >
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
                  sessionOrigin={(message as any).sessionOrigin}
                />
              ))}
              
              {isProcessing && !streamingContent && (
                <div className="flex items-center justify-start mb-6">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-5 w-5" />
                    </div>
                    <ProcessingIndicator message="🔄 Processando Resposta..." />
                  </div>
                </div>
              )}
              
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
            </SessionErrorBoundary>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-4xl">
                <Card className="p-8 text-center">
                  <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h2 className="mt-4 text-lg font-medium">Nenhuma sessão ativa</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Crie uma nova sessão para começar
                  </p>
                </Card>
              </div>
            </div>
          )}

          {/* Session Actions */}
          {activeSession && (
            <div className="border-t px-4 py-2">
              <div className="mx-auto flex max-w-4xl items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Mensagens: {activeSession.messages.length}</span>
                  <span>Tokens: {activeSession.metrics.totalTokens}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {!readOnly && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Message Input */}
          {!readOnly && (
            <MessageInput
              onSend={handleSendMessage}
              onInterrupt={handleInterrupt}
              isStreaming={isStreaming}
              disabled={!activeSessionId}
              sessionId={activeSession?.id}
              sessionTitle={activeSession?.title}
              isFirstMessage={activeSession?.messages.length === 0}
            />
          )}
          </div>
        </ChatErrorBoundary>
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