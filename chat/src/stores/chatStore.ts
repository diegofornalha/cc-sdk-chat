import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'

// Habilitar suporte para Map e Set no Immer
enableMapSet()

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

interface ChatStore {
  // Estado
  sessions: Map<string, Session>
  activeSessionId: string | null
  isStreaming: boolean
  streamingContent: string
  
  // Ações de sessão
  createSession: (config?: SessionConfig) => string
  deleteSession: (sessionId: string) => void
  setActiveSession: (sessionId: string) => void
  updateSessionConfig: (sessionId: string, config: SessionConfig) => void
  
  // Ações de mensagem
  addMessage: (sessionId: string, message: Omit<Message, 'id'>) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  
  // Ações de streaming
  setStreaming: (streaming: boolean) => void
  setStreamingContent: (content: string) => void
  appendStreamingContent: (content: string) => void
  
  // Ações de métricas
  updateMetrics: (sessionId: string, tokens: { input?: number; output?: number }, cost?: number) => void
  
  // Utilidades
  getActiveSession: () => Session | null
  clearSession: (sessionId: string) => void
  exportSession: (sessionId: string) => Session | null
  importSession: (session: Session) => void
}

const useChatStore = create<ChatStore>()(
  immer((set, get) => ({
    sessions: new Map(),
    activeSessionId: null,
    isStreaming: false,
    streamingContent: '',
    
    createSession: (config = {}) => {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const newSession: Session = {
        id: sessionId,
        title: `Nova Conversa ${new Date().toLocaleDateString('pt-BR')}`,
        messages: [],
        config: {
          systemPrompt: config.systemPrompt || 'Você é um assistente útil.',
          allowedTools: config.allowedTools || [],
          maxTurns: config.maxTurns || 20,
          permissionMode: config.permissionMode || 'acceptEdits',
          cwd: config.cwd || undefined
        },
        metrics: {
          totalTokens: 0,
          totalCost: 0,
          messageCount: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      set((state) => {
        state.sessions.set(sessionId, newSession)
        state.activeSessionId = sessionId
      })
      
      return sessionId
    },
    
    deleteSession: (sessionId) => {
      set((state) => {
        state.sessions.delete(sessionId)
        if (state.activeSessionId === sessionId) {
          const remaining = Array.from(state.sessions.keys())
          state.activeSessionId = remaining[0] || null
        }
      })
    },
    
    setActiveSession: (sessionId) => {
      set((state) => {
        if (state.sessions.has(sessionId)) {
          state.activeSessionId = sessionId
        }
      })
    },
    
    updateSessionConfig: (sessionId, config) => {
      set((state) => {
        const session = state.sessions.get(sessionId)
        if (session) {
          session.config = { ...session.config, ...config }
          session.updatedAt = new Date()
        }
      })
    },
    
    addMessage: (sessionId, message) => {
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const fullMessage: Message = {
        ...message,
        id: messageId,
        timestamp: message.timestamp || new Date()
      }
      
      set((state) => {
        const session = state.sessions.get(sessionId)
        if (session) {
          session.messages.push(fullMessage)
          session.metrics.messageCount++
          session.updatedAt = new Date()
        }
      })
    },
    
    updateMessage: (sessionId, messageId, updates) => {
      set((state) => {
        const session = state.sessions.get(sessionId)
        if (session) {
          const message = session.messages.find(m => m.id === messageId)
          if (message) {
            Object.assign(message, updates)
            session.updatedAt = new Date()
          }
        }
      })
    },
    
    deleteMessage: (sessionId, messageId) => {
      set((state) => {
        const session = state.sessions.get(sessionId)
        if (session) {
          session.messages = session.messages.filter(m => m.id !== messageId)
          session.metrics.messageCount = session.messages.length
          session.updatedAt = new Date()
        }
      })
    },
    
    setStreaming: (streaming) => {
      set((state) => {
        state.isStreaming = streaming
        if (!streaming) {
          state.streamingContent = ''
        }
      })
    },
    
    setStreamingContent: (content) => {
      set((state) => {
        state.streamingContent = content
      })
    },
    
    appendStreamingContent: (content) => {
      set((state) => {
        state.streamingContent += content
      })
    },
    
    updateMetrics: (sessionId, tokens, cost) => {
      set((state) => {
        const session = state.sessions.get(sessionId)
        if (session) {
          if (tokens.input) session.metrics.totalTokens += tokens.input
          if (tokens.output) session.metrics.totalTokens += tokens.output
          if (cost) session.metrics.totalCost += cost
          session.updatedAt = new Date()
        }
      })
    },
    
    getActiveSession: () => {
      const { sessions, activeSessionId } = get()
      return activeSessionId ? sessions.get(activeSessionId) || null : null
    },
    
    clearSession: (sessionId) => {
      set((state) => {
        const session = state.sessions.get(sessionId)
        if (session) {
          session.messages = []
          session.metrics = {
            totalTokens: 0,
            totalCost: 0,
            messageCount: 0
          }
          session.updatedAt = new Date()
        }
      })
    },
    
    exportSession: (sessionId) => {
      const session = get().sessions.get(sessionId)
      return session ? { ...session } : null
    },
    
    importSession: (session) => {
      set((state) => {
        state.sessions.set(session.id, session)
      })
    }
  }))
)

export default useChatStore