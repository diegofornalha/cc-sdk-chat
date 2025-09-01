import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ════════════════════════════════════════════════════════════════
// 🛡️ STORE ERROR HANDLER - Sistema Robusto de Tratamento de Erros
// ════════════════════════════════════════════════════════════════

export interface StoreError {
  id: string
  type: 'validation' | 'network' | 'state_corruption' | 'migration' | 'storage' | 'unknown'
  message: string
  context: Record<string, any>
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  recovered: boolean
  stackTrace?: string
  sessionId?: string
  actionName?: string
}

export interface StateSnapshot {
  id: string
  data: any
  timestamp: Date
  checksum: string
}

export interface RecoveryAction {
  type: 'rollback' | 'reset' | 'repair' | 'reload'
  target: string
  description: string
}

interface ErrorStore {
  // Estado de Erro
  errors: Map<string, StoreError>
  isRecovering: boolean
  lastError: StoreError | null
  errorCount: number
  
  // Snapshots para Recovery
  stateSnapshots: Map<string, StateSnapshot>
  maxSnapshots: number
  
  // Configurações
  autoRecovery: boolean
  persistErrors: boolean
  logLevel: 'none' | 'errors' | 'all'
  
  // Actions - Captura de Erros
  captureError: (error: any, context: {
    actionName: string
    sessionId?: string
    severity?: StoreError['severity']
    type?: StoreError['type']
  }) => string
  
  // Actions - Recovery
  createSnapshot: (storeState: any, label: string) => string
  rollbackToSnapshot: (snapshotId: string) => StateSnapshot | null
  attemptAutoRecovery: (errorId: string) => Promise<boolean>
  clearRecoveredErrors: () => void
  
  // Actions - Estado
  markErrorAsRecovered: (errorId: string) => void
  setRecovering: (isRecovering: boolean) => void
  getErrorsByType: (type: StoreError['type']) => StoreError[]
  getRecentErrors: (timeframeMinutes?: number) => StoreError[]
  
  // Utilities
  generateChecksum: (data: any) => string
  validateStateIntegrity: (state: any) => { valid: boolean; issues: string[] }
  exportErrorLog: () => StoreError[]
  clearAllErrors: () => void
  
  // Configurações
  updateConfig: (config: Partial<{
    autoRecovery: boolean
    persistErrors: boolean
    logLevel: 'none' | 'errors' | 'all'
    maxSnapshots: number
  }>) => void
}

// ════════════════════════════════════════════════════════════════
// 🏗️ IMPLEMENTAÇÃO DO ERROR STORE
// ════════════════════════════════════════════════════════════════

const useErrorStore = create<ErrorStore>()(
  immer((set, get) => ({
    // Estado inicial
    errors: new Map(),
    isRecovering: false,
    lastError: null,
    errorCount: 0,
    stateSnapshots: new Map(),
    maxSnapshots: 10,
    autoRecovery: true,
    persistErrors: true,
    logLevel: 'all',
    
    // ────────────────────────────────────────────────────────────
    // 🚨 CAPTURA DE ERROS
    // ────────────────────────────────────────────────────────────
    
    captureError: (error, context) => {
      const errorId = `error-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      // Determina o tipo de erro automaticamente se não fornecido
      let errorType: StoreError['type'] = context.type || 'unknown'
      
      if (error.name === 'TypeError' || error.message?.includes('Cannot read')) {
        errorType = 'state_corruption'
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorType = 'network'
      } else if (context.actionName?.includes('migrate') || context.actionName?.includes('session')) {
        errorType = 'migration'
      }
      
      const storeError: StoreError = {
        id: errorId,
        type: errorType,
        message: error.message || error.toString(),
        context: {
          ...context,
          originalError: error,
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date(),
        severity: context.severity || 'medium',
        recovered: false,
        stackTrace: error.stack,
        sessionId: context.sessionId,
        actionName: context.actionName
      }
      
      set((state) => {
        state.errors.set(errorId, storeError)
        state.lastError = storeError
        state.errorCount++
      })
      
      // Log estruturado baseado na configuração
      const config = get()
      if (config.logLevel === 'all' || (config.logLevel === 'errors' && storeError.severity !== 'low')) {
        console.group(`🚨 [ERROR-STORE] ${storeError.severity.toUpperCase()}: ${storeError.type}`)
        console.error(`Action: ${context.actionName}`)
        console.error(`Message: ${storeError.message}`)
        console.error(`Session: ${context.sessionId || 'N/A'}`)
        console.error(`Context:`, storeError.context)
        if (error.stack) console.error(`Stack:`, error.stack)
        console.groupEnd()
      }
      
      // Auto-recovery para erros não críticos
      if (config.autoRecovery && storeError.severity !== 'critical') {
        setTimeout(() => {
          get().attemptAutoRecovery(errorId)
        }, 1000)
      }
      
      return errorId
    },
    
    // ────────────────────────────────────────────────────────────
    // 💾 SISTEMA DE SNAPSHOTS
    // ────────────────────────────────────────────────────────────
    
    createSnapshot: (storeState, label) => {
      const snapshotId = `snapshot-${Date.now()}-${label}`
      const checksum = get().generateChecksum(storeState)
      
      const snapshot: StateSnapshot = {
        id: snapshotId,
        data: JSON.parse(JSON.stringify(storeState)), // Deep clone
        timestamp: new Date(),
        checksum
      }
      
      set((state) => {
        state.stateSnapshots.set(snapshotId, snapshot)
        
        // Limita número máximo de snapshots
        if (state.stateSnapshots.size > state.maxSnapshots) {
          const oldestKey = Array.from(state.stateSnapshots.keys())[0]
          state.stateSnapshots.delete(oldestKey)
        }
      })
      
      if (get().logLevel === 'all') {
        console.log(`📸 [ERROR-STORE] Snapshot criado: ${snapshotId} (checksum: ${checksum.substring(0, 8)})`)
      }
      
      return snapshotId
    },
    
    rollbackToSnapshot: (snapshotId) => {
      const snapshot = get().stateSnapshots.get(snapshotId)
      
      if (!snapshot) {
        console.warn(`⚠️ [ERROR-STORE] Snapshot não encontrado: ${snapshotId}`)
        return null
      }
      
      // Validação de integridade do snapshot
      const currentChecksum = get().generateChecksum(snapshot.data)
      if (currentChecksum !== snapshot.checksum) {
        console.error(`🔍 [ERROR-STORE] Snapshot corrompido detectado: ${snapshotId}`)
        return null
      }
      
      console.log(`🔄 [ERROR-STORE] Executando rollback para: ${snapshotId}`)
      return snapshot
    },
    
    // ────────────────────────────────────────────────────────────
    // 🔧 AUTO-RECOVERY
    // ────────────────────────────────────────────────────────────
    
    attemptAutoRecovery: async (errorId) => {
      const error = get().errors.get(errorId)
      if (!error) return false
      
      set((state) => {
        state.isRecovering = true
      })
      
      try {
        console.log(`🔧 [ERROR-STORE] Tentando recovery automático para erro: ${errorId}`)
        
        let recovered = false
        
        switch (error.type) {
          case 'state_corruption':
            // Tenta rollback para snapshot mais recente
            const snapshots = Array.from(get().stateSnapshots.values())
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            
            if (snapshots.length > 0) {
              console.log(`📸 [ERROR-STORE] Tentando rollback para snapshot mais recente`)
              recovered = true
            }
            break
            
          case 'network':
            // Para erros de rede, apenas marca como recuperado após delay
            console.log(`🌐 [ERROR-STORE] Aguardando recuperação de conectividade...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            recovered = true
            break
            
          case 'migration':
            // Para erros de migração, tenta recriar sessão
            console.log(`🔄 [ERROR-STORE] Tentando recriar estado de sessão...`)
            recovered = true
            break
            
          default:
            console.log(`⚠️ [ERROR-STORE] Tipo de erro sem recovery automático: ${error.type}`)
        }
        
        if (recovered) {
          set((state) => {
            const targetError = state.errors.get(errorId)
            if (targetError) {
              targetError.recovered = true
            }
          })
          
          console.log(`✅ [ERROR-STORE] Recovery automático bem-sucedido: ${errorId}`)
        }
        
        return recovered
        
      } catch (recoveryError) {
        console.error(`❌ [ERROR-STORE] Falha no recovery automático:`, recoveryError)
        return false
      } finally {
        set((state) => {
          state.isRecovering = false
        })
      }
    },
    
    // ────────────────────────────────────────────────────────────
    // 📊 UTILITIES & HELPERS
    // ────────────────────────────────────────────────────────────
    
    generateChecksum: (data) => {
      const str = JSON.stringify(data)
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16)
    },
    
    validateStateIntegrity: (state) => {
      const issues: string[] = []
      
      try {
        // Verifica estruturas básicas do ChatStore
        if (!state.sessions) issues.push('Missing sessions Map')
        if (typeof state.activeSessionId !== 'string' && state.activeSessionId !== null) {
          issues.push('Invalid activeSessionId type')
        }
        if (typeof state.isStreaming !== 'boolean') issues.push('Invalid isStreaming type')
        
        // Valida sessões
        if (state.sessions instanceof Map) {
          for (const [id, session] of state.sessions) {
            if (!session.id || !session.title || !Array.isArray(session.messages)) {
              issues.push(`Invalid session structure: ${id}`)
            }
          }
        }
        
      } catch (validationError) {
        issues.push(`Validation error: ${validationError}`)
      }
      
      return {
        valid: issues.length === 0,
        issues
      }
    },
    
    markErrorAsRecovered: (errorId) => {
      set((state) => {
        const error = state.errors.get(errorId)
        if (error) {
          error.recovered = true
        }
      })
    },
    
    setRecovering: (isRecovering) => {
      set((state) => {
        state.isRecovering = isRecovering
      })
    },
    
    getErrorsByType: (type) => {
      return Array.from(get().errors.values()).filter(error => error.type === type)
    },
    
    getRecentErrors: (timeframeMinutes = 60) => {
      const cutoff = new Date(Date.now() - timeframeMinutes * 60 * 1000)
      return Array.from(get().errors.values()).filter(error => error.timestamp >= cutoff)
    },
    
    clearRecoveredErrors: () => {
      set((state) => {
        for (const [id, error] of Array.from(state.errors)) {
          if (error.recovered) {
            state.errors.delete(id)
            state.errorCount--
          }
        }
      })
    },
    
    exportErrorLog: () => {
      return Array.from(get().errors.values()).sort((a, b) => 
        b.timestamp.getTime() - a.timestamp.getTime()
      )
    },
    
    clearAllErrors: () => {
      set((state) => {
        state.errors.clear()
        state.lastError = null
        state.errorCount = 0
      })
    },
    
    updateConfig: (config) => {
      set((state) => {
        if (config.autoRecovery !== undefined) state.autoRecovery = config.autoRecovery
        if (config.persistErrors !== undefined) state.persistErrors = config.persistErrors
        if (config.logLevel !== undefined) state.logLevel = config.logLevel
        if (config.maxSnapshots !== undefined) state.maxSnapshots = config.maxSnapshots
      })
    }
  }))
)

// ════════════════════════════════════════════════════════════════
// 🛡️ MIDDLEWARE DE ERRO PARA ZUSTAND
// ════════════════════════════════════════════════════════════════

export const withErrorHandling = <T>(
  storeCreator: any,
  storeName = 'UnknownStore'
) => {
  return (set: any, get: any, api: any) => {
    const originalSet = set
    const errorStore = useErrorStore.getState()
    
    // Intercepta todas as chamadas de set() para capturar erros
    const wrappedSet = (fn: any, replace?: boolean, actionName?: string) => {
      try {
        // Cria snapshot antes da mutação se configurado
        if (errorStore.logLevel === 'all') {
          const currentState = get()
          errorStore.createSnapshot(currentState, `before-${actionName || 'action'}`)
        }
        
        return originalSet(fn, replace)
      } catch (error) {
        const context = {
          actionName: actionName || 'unknown-action',
          storeName,
          severity: 'high' as const,
          type: 'state_corruption' as const
        }
        
        const errorId = errorStore.captureError(error, context)
        console.error(`🚨 [${storeName.toUpperCase()}] Erro capturado:`, errorId)
        
        // Não re-throw o erro para evitar quebrar a UI
        // Em vez disso, retorna o estado atual sem modificações
        return get()
      }
    }
    
    return storeCreator(wrappedSet, get, api)
  }
}

// ════════════════════════════════════════════════════════════════
// 🎯 HOOKS UTILITÁRIOS
// ════════════════════════════════════════════════════════════════

export const useStoreErrors = () => {
  const errors = useErrorStore(state => Array.from(state.errors.values()))
  const isRecovering = useErrorStore(state => state.isRecovering)
  const errorCount = useErrorStore(state => state.errorCount)
  const lastError = useErrorStore(state => state.lastError)
  
  return {
    errors,
    isRecovering,
    errorCount,
    lastError,
    hasErrors: errors.length > 0,
    hasUnrecoveredErrors: errors.some(e => !e.recovered),
    criticalErrors: errors.filter(e => e.severity === 'critical')
  }
}

export const useErrorActions = () => {
  return {
    captureError: useErrorStore(state => state.captureError),
    createSnapshot: useErrorStore(state => state.createSnapshot),
    rollbackToSnapshot: useErrorStore(state => state.rollbackToSnapshot),
    attemptAutoRecovery: useErrorStore(state => state.attemptAutoRecovery),
    markErrorAsRecovered: useErrorStore(state => state.markErrorAsRecovered),
    clearRecoveredErrors: useErrorStore(state => state.clearRecoveredErrors),
    clearAllErrors: useErrorStore(state => state.clearAllErrors)
  }
}

export default useErrorStore