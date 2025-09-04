import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import useErrorStore, { withErrorHandling } from './errorStore'

// Habilitar suporte para Map e Set no Immer
enableMapSet()

// ════════════════════════════════════════════════════════════════
// 🛡️ CHAT STORE COM PROTEÇÃO DE ERROS INTEGRADA
// ════════════════════════════════════════════════════════════════

// Re-exporta interfaces originais
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  tokens?: {
    input?: number
    output?: number
  }
  cost?: number
  tools?: string[]
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  config: SessionConfig
  metrics: {
    totalTokens: number
    totalCost: number
    messageCount: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface SessionConfig {
  systemPrompt?: string
  allowedTools?: string[]
  maxTurns?: number
  permissionMode?: 'acceptEdits' | 'ask' | 'deny'
  cwd?: string
}

const defaultSessionConfig: SessionConfig = {
  systemPrompt: '',
  allowedTools: [],
  maxTurns: 20,
  permissionMode: 'acceptEdits',
  cwd: undefined
}

interface ChatStore {
  // Estado
  sessions: Map<string, Session>
  activeSessionId: string | null
  isStreaming: boolean
  streamingContent: string
  isProcessing: boolean
  
  // Ações de sessão
  createSession: (config?: SessionConfig) => string
  deleteSession: (sessionId: string) => void
  setActiveSession: (sessionId: string) => void
  updateSessionConfig: (sessionId: string, config: SessionConfig) => void
  migrateToRealSession: (realSessionId: string) => void
  
  // Ações de mensagem
  addMessage: (sessionId: string, message: Omit<Message, 'id'>) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  
  // Ações de streaming
  setStreaming: (streaming: boolean) => void
  setStreamingContent: (content: string) => void
  appendStreamingContent: (content: string) => void
  setProcessing: (processing: boolean) => void
  
  // Ações de métricas
  updateMetrics: (sessionId: string, tokens: { input?: number; output?: number }, cost?: number) => void
  
  // Utilidades
  getActiveSession: () => Session | null
  clearSession: (sessionId: string) => void
  exportSession: (sessionId: string) => Session | null
  importSession: (session: Session) => void
  loadExternalSession: (sessionData: any) => void
  loadCrossSessionHistory: (primarySessionId: string) => Promise<void>
}

// ────────────────────────────────────────────────────────────
// 🔧 FUNÇÕES AUXILIARES PROTEGIDAS
// ────────────────────────────────────────────────────────────

const executeWithErrorHandling = async <T>(
  operation: () => T | Promise<T>,
  actionName: string,
  sessionId?: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<T | null> => {
  const errorStore = useErrorStore.getState()
  
  try {
    const result = await operation()
    return result
  } catch (error) {
    errorStore.captureError(error, {
      actionName,
      sessionId,
      severity,
      type: 'unknown'
    })
    
    return null
  }
}

const validateSession = (session: any): { valid: boolean; issues: string[] } => {
  const issues: string[] = []
  
  if (!session) issues.push('Session is null or undefined')
  if (!session.id) issues.push('Missing session ID')
  if (!session.title) issues.push('Missing session title')
  if (!Array.isArray(session.messages)) issues.push('Messages is not an array')
  if (!session.config) issues.push('Missing session config')
  if (!session.metrics) issues.push('Missing session metrics')
  
  return {
    valid: issues.length === 0,
    issues
  }
}

const validateSessionId = (sessionId: string): boolean => {
  if (!sessionId || typeof sessionId !== 'string') return false
  
  // Aceita IDs temporários, UUIDs e IDs de projeto
  const validPatterns = [
    /^temp-\d+$/, // temp-123456789
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, // UUID
    /^project-.+$/, // project-*
    /^awaiting-real-session$/ // especial
  ]
  
  return validPatterns.some(pattern => pattern.test(sessionId))
}

// ════════════════════════════════════════════════════════════════
// 🏗️ IMPLEMENTAÇÃO DO CHAT STORE PROTEGIDO
// ════════════════════════════════════════════════════════════════

const useChatStoreProtected = create<ChatStore>()(
  withErrorHandling(
    immer((set: any, get: any) => ({
      sessions: new Map(),
      activeSessionId: null,
      isStreaming: false,
      streamingContent: '',
      isProcessing: false,
      
      // ────────────────────────────────────────────────────────────
      // 🆕 AÇÕES DE SESSÃO PROTEGIDAS
      // ────────────────────────────────────────────────────────────
      
      createSession: (config = {}) => {
        return executeWithErrorHandling(() => {
          const errorStore = useErrorStore.getState()
          
          // Cria snapshot antes da operação crítica
          errorStore.createSnapshot(get(), 'before-create-session')
          
          const sessionId = `temp-${Date.now()}`
          
          set((state: any) => {
            const session: Session = {
              id: sessionId,
              title: 'Nova Conversa',
              messages: [],
              config: { ...defaultSessionConfig, ...config },
              createdAt: new Date(),
              updatedAt: new Date(),
              metrics: {
                totalTokens: 0,
                totalCost: 0,
                messageCount: 0
              }
            }
            
            // Validação antes de adicionar
            const validation = validateSession(session)
            if (!validation.valid) {
              throw new Error(`Invalid session structure: ${validation.issues.join(', ')}`)
            }
            
            state.sessions.set(sessionId, session)
            state.activeSessionId = sessionId
          }, false, 'createSession')
          
          return sessionId
        }, 'createSession', undefined, 'medium') || `temp-${Date.now()}`
      },
      
      deleteSession: (sessionId: string) => {
        executeWithErrorHandling(() => {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID format: ${sessionId}`)
          }
          
          const errorStore = useErrorStore.getState()
          errorStore.createSnapshot(get(), 'before-delete-session')
          
          set((state: any) => {
            if (!state.sessions.has(sessionId)) {
              console.warn(`Session not found for deletion: ${sessionId}`)
              return
            }
            
            state.sessions.delete(sessionId)
            if (state.activeSessionId === sessionId) {
              const remaining = Array.from(state.sessions.keys())
              state.activeSessionId = remaining[0] || null
            }
          }, false, 'deleteSession')
        }, 'deleteSession', sessionId, 'medium')
      },
      
      setActiveSession: (sessionId: string) => {
        executeWithErrorHandling(() => {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID format: ${sessionId}`)
          }
          
          set((state: any) => {
            if (state.sessions.has(sessionId)) {
              state.activeSessionId = sessionId
            } else {
              throw new Error(`Session not found: ${sessionId}`)
            }
          }, false, 'setActiveSession')
        }, 'setActiveSession', sessionId, 'low')
      },
      
      migrateToRealSession: (realSessionId: string) => {
        executeWithErrorHandling(() => {
          const errorStore = useErrorStore.getState()
          
          // Validação mais rigorosa para migração
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          if (!uuidRegex.test(realSessionId)) {
            throw new Error(`Invalid UUID format for migration: ${realSessionId}`)
          }
          
          // Snapshot crítico antes de migração
          errorStore.createSnapshot(get(), 'before-migration')
          
          set((state: any) => {
            console.log('🛡️ [PROTECTED] Iniciando migração protegida...')
            
            // Encontra sessão temporária
            let tempSession = null
            let tempSessionId = null
            
            const sessionsArray = Array.from(state.sessions as Map<string, any>);
            for (const [sessionId, session] of sessionsArray) {
              if (sessionId.startsWith('temp-') || sessionId === 'awaiting-real-session') {
                tempSession = session
                tempSessionId = sessionId
                break
              }
            }
            
            if (tempSession && tempSessionId) {
              // Valida integridade da sessão temporária
              const validation = validateSession(tempSession)
              if (!validation.valid) {
                throw new Error(`Corrupted temporary session: ${validation.issues.join(', ')}`)
              }
              
              // Proteção contra sessão duplicada
              if (state.sessions.has(realSessionId)) {
                console.log(`🛡️ [PROTECTED] Sessão real já existe, apenas ativando: ${realSessionId}`)
                state.activeSessionId = realSessionId
                state.sessions.delete(tempSessionId)
                return
              }
              
              // Executa migração com validações
              const realSession: Session = {
                ...tempSession,
                id: realSessionId,
                title: `💬 Sessão ${realSessionId.slice(-8)}`,
                updatedAt: new Date()
              }
              
              // Validação final antes de adicionar
              const finalValidation = validateSession(realSession)
              if (!finalValidation.valid) {
                throw new Error(`Failed to create valid migrated session: ${finalValidation.issues.join(', ')}`)
              }
              
              state.sessions.set(realSessionId, realSession)
              state.sessions.delete(tempSessionId)
              state.activeSessionId = realSessionId
              
              console.log('✅ [PROTECTED] Migração concluída com sucesso')
            } else {
              // Fallback protegido - cria nova sessão
              console.log('🛡️ [PROTECTED] Criando sessão fallback')
              const newSession: Session = {
                id: realSessionId,
                title: `💬 Sessão ${realSessionId.slice(-8)}`,
                messages: [],
                config: { ...defaultSessionConfig },
                metrics: {
                  totalTokens: 0,
                  totalCost: 0,
                  messageCount: 0
                },
                createdAt: new Date(),
                updatedAt: new Date()
              }
              
              state.sessions.set(realSessionId, newSession)
              state.activeSessionId = realSessionId
            }
          }, false, 'migrateToRealSession')
        }, 'migrateToRealSession', realSessionId, 'critical')
      },
      
      updateSessionConfig: (sessionId: string, config: SessionConfig) => {
        executeWithErrorHandling(() => {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID: ${sessionId}`)
          }
          
          set((state: any) => {
            const session = state.sessions.get(sessionId)
            if (!session) {
              throw new Error(`Session not found: ${sessionId}`)
            }
            
            // Valida configuração antes de aplicar
            if (config.maxTurns && config.maxTurns < 0) {
              throw new Error('maxTurns cannot be negative')
            }
            
            session.config = { ...session.config, ...config }
            session.updatedAt = new Date()
          }, false, 'updateSessionConfig')
        }, 'updateSessionConfig', sessionId, 'low')
      },
      
      // ────────────────────────────────────────────────────────────
      // 💬 AÇÕES DE MENSAGEM PROTEGIDAS
      // ────────────────────────────────────────────────────────────
      
      addMessage: (sessionId: string, message: Omit<Message, 'id'>) => {
        executeWithErrorHandling(() => {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID: ${sessionId}`)
          }
          
          if (!message.content || !message.role) {
            throw new Error('Message must have content and role')
          }
          
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`
          const fullMessage: Message = {
            ...message,
            id: messageId,
            timestamp: message.timestamp || new Date()
          }
          
          set((state: any) => {
            const session = state.sessions.get(sessionId)
            if (!session) {
              throw new Error(`Session not found: ${sessionId}`)
            }
            
            session.messages.push(fullMessage)
            session.metrics.messageCount++
            session.updatedAt = new Date()
          }, false, 'addMessage')
        }, 'addMessage', sessionId, 'medium')
      },
      
      updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
        executeWithErrorHandling(() => {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID: ${sessionId}`)
          }
          
          set((state: any) => {
            const session = state.sessions.get(sessionId)
            if (!session) {
              throw new Error(`Session not found: ${sessionId}`)
            }
            
            const message = session.messages.find((m: any) => m.id === messageId)
            if (!message) {
              throw new Error(`Message not found: ${messageId}`)
            }
            
            Object.assign(message, updates)
            session.updatedAt = new Date()
          }, false, 'updateMessage')
        }, 'updateMessage', sessionId, 'medium')
      },
      
      deleteMessage: (sessionId: string, messageId: string) => {
        executeWithErrorHandling(() => {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID: ${sessionId}`)
          }
          
          set((state: any) => {
            const session = state.sessions.get(sessionId)
            if (!session) {
              throw new Error(`Session not found: ${sessionId}`)
            }
            
            const initialLength = session.messages.length
            session.messages = session.messages.filter((m: any) => m.id !== messageId)
            
            if (session.messages.length === initialLength) {
              console.warn(`Message not found for deletion: ${messageId}`)
            }
            
            session.metrics.messageCount = session.messages.length
            session.updatedAt = new Date()
          }, false, 'deleteMessage')
        }, 'deleteMessage', sessionId, 'medium')
      },
      
      // ────────────────────────────────────────────────────────────
      // 📡 AÇÕES DE STREAMING PROTEGIDAS
      // ────────────────────────────────────────────────────────────
      
      setStreaming: (streaming: boolean) => {
        executeWithErrorHandling(() => {
          set((state: any) => {
            state.isStreaming = streaming
            if (!streaming) {
              state.streamingContent = ''
              state.isProcessing = false
            }
          }, false, 'setStreaming')
        }, 'setStreaming', undefined, 'low')
      },
      
      setStreamingContent: (content: string) => {
        executeWithErrorHandling(() => {
          if (typeof content !== 'string') {
            throw new Error('Streaming content must be a string')
          }
          
          set((state: any) => {
            state.streamingContent = content
          }, false, 'setStreamingContent')
        }, 'setStreamingContent', undefined, 'low')
      },
      
      appendStreamingContent: (content: string) => {
        executeWithErrorHandling(() => {
          if (typeof content !== 'string') {
            throw new Error('Streaming content must be a string')
          }
          
          set((state: any) => {
            state.streamingContent += content
          }, false, 'appendStreamingContent')
        }, 'appendStreamingContent', undefined, 'low')
      },
      
      setProcessing: (processing: boolean) => {
        executeWithErrorHandling(() => {
          set((state: any) => {
            state.isProcessing = processing
          }, false, 'setProcessing')
        }, 'setProcessing', undefined, 'low')
      },
      
      // ────────────────────────────────────────────────────────────
      // 📊 MÉTRICAS E UTILIDADES PROTEGIDAS
      // ────────────────────────────────────────────────────────────
      
      updateMetrics: (sessionId: string, tokens: { input?: number; output?: number }, cost?: number) => {
        executeWithErrorHandling(() => {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID: ${sessionId}`)
          }
          
          // Validação de tokens
          if (tokens.input && (typeof tokens.input !== 'number' || tokens.input < 0)) {
            throw new Error('Input tokens must be a positive number')
          }
          if (tokens.output && (typeof tokens.output !== 'number' || tokens.output < 0)) {
            throw new Error('Output tokens must be a positive number')
          }
          if (cost && (typeof cost !== 'number' || cost < 0)) {
            throw new Error('Cost must be a positive number')
          }
          
          set((state: any) => {
            const session = state.sessions.get(sessionId)
            if (!session) {
              throw new Error(`Session not found: ${sessionId}`)
            }
            
            if (tokens.input) session.metrics.totalTokens += tokens.input
            if (tokens.output) session.metrics.totalTokens += tokens.output
            if (cost) session.metrics.totalCost += cost
            session.updatedAt = new Date()
          }, false, 'updateMetrics')
        }, 'updateMetrics', sessionId, 'low')
      },
      
      getActiveSession: () => {
        try {
          const { sessions, activeSessionId } = get()
          if (!activeSessionId) return null
          
          const session = sessions.get(activeSessionId)
          if (!session) {
            console.warn(`Active session not found: ${activeSessionId}`)
            return null
          }
          
          // Validação de integridade da sessão ativa
          const validation = validateSession(session)
          if (!validation.valid) {
            const errorStore = useErrorStore.getState()
            errorStore.captureError(new Error(`Corrupted active session: ${validation.issues.join(', ')}`), {
              actionName: 'getActiveSession',
              sessionId: activeSessionId,
              severity: 'high',
              type: 'state_corruption'
            })
            return null
          }
          
          return session
        } catch (error) {
          const errorStore = useErrorStore.getState()
          errorStore.captureError(error, {
            actionName: 'getActiveSession',
            severity: 'medium'
          })
          return null
        }
      },
      
      clearSession: (sessionId: string) => {
        executeWithErrorHandling(() => {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID: ${sessionId}`)
          }
          
          set((state: any) => {
            const session = state.sessions.get(sessionId)
            if (!session) {
              throw new Error(`Session not found: ${sessionId}`)
            }
            
            session.messages = []
            session.metrics = {
              totalTokens: 0,
              totalCost: 0,
              messageCount: 0
            }
            session.updatedAt = new Date()
          }, false, 'clearSession')
        }, 'clearSession', sessionId, 'medium')
      },
      
      exportSession: (sessionId: string) => {
        try {
          if (!validateSessionId(sessionId)) {
            throw new Error(`Invalid session ID: ${sessionId}`)
          }
          
          const session = get().sessions.get(sessionId)
          if (!session) return null
          
          // Validação antes de exportar
          const validation = validateSession(session)
          if (!validation.valid) {
            throw new Error(`Cannot export corrupted session: ${validation.issues.join(', ')}`)
          }
          
          return { ...session }
        } catch (error) {
          const errorStore = useErrorStore.getState()
          errorStore.captureError(error, {
            actionName: 'exportSession',
            sessionId,
            severity: 'medium'
          })
          return null
        }
      },
      
      importSession: (session: Session) => {
        executeWithErrorHandling(() => {
          // Validação rigorosa na importação
          const validation = validateSession(session)
          if (!validation.valid) {
            throw new Error(`Cannot import invalid session: ${validation.issues.join(', ')}`)
          }
          
          if (!validateSessionId(session.id)) {
            throw new Error(`Invalid session ID in imported session: ${session.id}`)
          }
          
          set((state: any) => {
            state.sessions.set(session.id, session)
          }, false, 'importSession')
        }, 'importSession', session?.id, 'high')
      },
      
      loadExternalSession: (sessionData: any) => {
        executeWithErrorHandling(() => {
          if (!sessionData || !sessionData.id) {
            throw new Error('Invalid session data: missing ID')
          }
          
          if (!validateSessionId(sessionData.id)) {
            throw new Error(`Invalid session ID in external data: ${sessionData.id}`)
          }
          
          if (!Array.isArray(sessionData.messages)) {
            throw new Error('Invalid session data: messages must be an array')
          }
          
          set((state: any) => {
            const sessionId = sessionData.id
            const newSession: Session = {
              id: sessionId,
              title: `Sessão ${sessionId.slice(-8)}`,
              messages: sessionData.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              })),
              config: { ...defaultSessionConfig },
              metrics: {
                totalTokens: sessionData.messages.reduce((total: number, msg: any) => 
                  total + (msg.tokens?.input || 0) + (msg.tokens?.output || 0), 0),
                totalCost: sessionData.messages.reduce((total: number, msg: any) => 
                  total + (msg.cost || 0), 0),
                messageCount: sessionData.messages.length
              },
              createdAt: new Date(),
              updatedAt: new Date()
            }
            
            // Validação final
            const validation = validateSession(newSession)
            if (!validation.valid) {
              throw new Error(`Failed to create valid session from external data: ${validation.issues.join(', ')}`)
            }
            
            state.sessions.set(sessionId, newSession)
            state.activeSessionId = sessionId
          }, false, 'loadExternalSession')
        }, 'loadExternalSession', sessionData?.id, 'high')
      },
      
      // ────────────────────────────────────────────────────────────
      // 🔄 CARREGAMENTO CRUZADO PROTEGIDO
      // ────────────────────────────────────────────────────────────
      
      loadCrossSessionHistory: async (primarySessionId: string) => {
        return executeWithErrorHandling(async () => {
          if (!validateSessionId(primarySessionId)) {
            throw new Error(`Invalid primary session ID: ${primarySessionId}`)
          }
          
          const errorStore = useErrorStore.getState()
          errorStore.createSnapshot(get(), 'before-cross-session-load')
          
          const projectPath = '/home/suthub/.claude/projects/-home-suthub--claude-api-claude-code-app-cc-sdk-chat'
          
          const response = await fetch('/api/load-project-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              projectPath,
              primarySessionId 
            })
          })
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const { sessions, isSingleSession, continuationMode } = await response.json()
          
          if (!Array.isArray(sessions)) {
            throw new Error('Invalid response: sessions must be an array')
          }
          
          set((state: any) => {
            console.log('🛡️ [PROTECTED] Iniciando carregamento cruzado protegido...')
            
            // Cria sessão unificada
            const unifiedSessionId = `project-${primarySessionId}`
            const allMessages: any[] = []
            
            // Valida e processa cada sessão
            sessions.forEach((sessionData: any) => {
              if (!sessionData.id || !Array.isArray(sessionData.messages)) {
                console.warn('Sessão inválida ignorada:', sessionData)
                return
              }
              
              sessionData.messages.forEach((msg: any) => {
                if (msg.content && msg.role) {
                  allMessages.push({
                    ...msg,
                    sessionOrigin: sessionData.id,
                    sessionTitle: sessionData.origin || 'Claude Code',
                    timestamp: new Date(msg.timestamp)
                  })
                }
              })
            })
            
            // Ordena mensagens por timestamp
            allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            
            // Cria sessão unificada com validação
            const unifiedSession: Session = {
              id: unifiedSessionId,
              title: `📋 Timeline Unificada (${sessions.length} sessões)`,
              messages: allMessages,
              config: {
                systemPrompt: `Timeline unificada do projeto - ${sessions.length} sessões combinadas`,
                allowedTools: [],
                maxTurns: 100,
                permissionMode: 'acceptEdits',
                cwd: sessions[0]?.cwd
              },
              metrics: {
                totalTokens: allMessages.reduce((total, msg) => 
                  total + (msg.tokens?.input || 0) + (msg.tokens?.output || 0), 0),
                totalCost: allMessages.reduce((total, msg) => 
                  total + (msg.cost || 0), 0),
                messageCount: allMessages.length
              },
              createdAt: new Date(sessions[0]?.createdAt || Date.now()),
              updatedAt: new Date()
            }
            
            // NÃO adiciona mais a sessão unificada - removido por solicitação
            // const validation = validateSession(unifiedSession)
            // if (validation.valid) {
            //   state.sessions.set(unifiedSessionId, unifiedSession)
            // } else {
            //   console.error('Sessão unificada inválida:', validation.issues)
            // }
            
            // Carrega sessões individuais com validação
            sessions.forEach((sessionData: any) => {
              if (!state.sessions.has(sessionData.id) && sessionData.id && sessionData.messages) {
                try {
                  const session: Session = {
                    id: sessionData.id,
                    title: `${sessionData.origin === 'SDK Web' ? '🌐' : '🖥️'} ${sessionData.origin || 'Terminal'} (${sessionData.id.slice(-8)})`,
                    messages: sessionData.messages.map((msg: any) => ({
                      ...msg,
                      timestamp: new Date(msg.timestamp)
                    })),
                    config: { ...defaultSessionConfig },
                    metrics: {
                      totalTokens: sessionData.messages.reduce((total: number, msg: any) => 
                        total + (msg.tokens?.input || 0) + (msg.tokens?.output || 0), 0),
                      totalCost: sessionData.messages.reduce((total: number, msg: any) => 
                        total + (msg.cost || 0), 0),
                      messageCount: sessionData.messages.length
                    },
                    createdAt: new Date(sessionData.createdAt || Date.now()),
                    updatedAt: new Date()
                  }
                  
                  const sessionValidation = validateSession(session)
                  if (sessionValidation.valid) {
                    state.sessions.set(sessionData.id, session)
                  } else {
                    console.warn(`Sessão individual inválida ignorada: ${sessionData.id}`)
                  }
                } catch (sessionError) {
                  console.error(`Erro ao processar sessão ${sessionData.id}:`, sessionError)
                }
              }
            })
            
            console.log('✅ [PROTECTED] Carregamento cruzado concluído')
          }, false, 'loadCrossSessionHistory')
        }, 'loadCrossSessionHistory', primarySessionId, 'high')
      }
    })),
    'ChatStore'
  )
)

export default useChatStoreProtected