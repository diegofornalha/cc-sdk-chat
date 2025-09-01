import useErrorStore from '@/stores/errorStore'

// ════════════════════════════════════════════════════════════════
// 📊 SISTEMA DE LOGGING ESTRUTURADO INTEGRADO COM ERROR STORE
// ════════════════════════════════════════════════════════════════

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context: Record<string, any>
  sessionId?: string
  userId?: string
  component?: string
  action?: string
  duration?: number
  metadata?: Record<string, any>
}

export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableErrorStore: boolean
  enableLocalStorage: boolean
  maxLocalStorageEntries: number
  enablePerformanceMetrics: boolean
}

class Logger {
  private config: LoggerConfig
  private startTimes: Map<string, number> = new Map()
  
  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableErrorStore: true,
      enableLocalStorage: false,
      maxLocalStorageEntries: 1000,
      enablePerformanceMetrics: true,
      ...config
    }
  }
  
  // ────────────────────────────────────────────────────────────
  // 📝 MÉTODOS DE LOGGING
  // ────────────────────────────────────────────────────────────
  
  debug(message: string, context: Record<string, any> = {}) {
    this.log('debug', message, context)
  }
  
  info(message: string, context: Record<string, any> = {}) {
    this.log('info', message, context)
  }
  
  warn(message: string, context: Record<string, any> = {}) {
    this.log('warn', message, context)
  }
  
  error(message: string, error?: Error | unknown, context: Record<string, any> = {}) {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }
    
    this.log('error', message, errorContext)
    
    // Integração automática com Error Store
    if (this.config.enableErrorStore && error instanceof Error) {
      const errorStore = useErrorStore.getState()
      errorStore.captureError(error, {
        actionName: context.action || 'logger-error',
        sessionId: context.sessionId,
        severity: 'medium',
        type: 'unknown'
      })
    }
  }
  
  fatal(message: string, error?: Error | unknown, context: Record<string, any> = {}) {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }
    
    this.log('fatal', message, errorContext)
    
    // Sempre integra com Error Store em casos fatais
    if (error instanceof Error) {
      const errorStore = useErrorStore.getState()
      errorStore.captureError(error, {
        actionName: context.action || 'logger-fatal',
        sessionId: context.sessionId,
        severity: 'critical',
        type: 'unknown'
      })
    }
  }
  
  // ────────────────────────────────────────────────────────────
  // ⏱️ MÉTRICAS DE PERFORMANCE
  // ────────────────────────────────────────────────────────────
  
  startTimer(operationId: string) {
    if (this.config.enablePerformanceMetrics) {
      this.startTimes.set(operationId, performance.now())
    }
  }
  
  endTimer(operationId: string, message?: string, context: Record<string, any> = {}) {
    if (!this.config.enablePerformanceMetrics) return
    
    const startTime = this.startTimes.get(operationId)
    if (startTime === undefined) {
      this.warn(`Timer '${operationId}' não foi iniciado`, { operationId })
      return
    }
    
    const duration = performance.now() - startTime
    this.startTimes.delete(operationId)
    
    const finalMessage = message || `Operação '${operationId}' completada`
    
    this.info(finalMessage, {
      ...context,
      operationId,
      duration: Math.round(duration * 100) / 100, // 2 casas decimais
      performanceCategory: this.categorizePerformance(duration)
    })
    
    return duration
  }
  
  timeOperation<T>(
    operationId: string,
    operation: () => T | Promise<T>,
    context: Record<string, any> = {}
  ): T | Promise<T> {
    this.startTimer(operationId)
    
    try {
      const result = operation()
      
      if (result instanceof Promise) {
        return result
          .then((value) => {
            this.endTimer(operationId, `Async operation '${operationId}' completada`, context)
            return value
          })
          .catch((error) => {
            this.endTimer(operationId, `Async operation '${operationId}' falhou`, context)
            this.error(`Erro na operação '${operationId}'`, error, context)
            throw error
          })
      } else {
        this.endTimer(operationId, `Sync operation '${operationId}' completada`, context)
        return result
      }
    } catch (error) {
      this.endTimer(operationId, `Sync operation '${operationId}' falhou`, context)
      this.error(`Erro na operação '${operationId}'`, error, context)
      throw error
    }
  }
  
  // ────────────────────────────────────────────────────────────
  // 🎯 LOGGING ESPECIALIZADO
  // ────────────────────────────────────────────────────────────
  
  storeAction(actionName: string, sessionId?: string, payload?: any) {
    this.info(`Store Action: ${actionName}`, {
      action: actionName,
      sessionId,
      payload: payload ? JSON.stringify(payload).slice(0, 200) : undefined,
      category: 'store'
    })
  }
  
  apiCall(method: string, url: string, status?: number, duration?: number) {
    const level = status && status >= 400 ? 'error' : 'info'
    this.log(level, `API ${method} ${url}`, {
      method,
      url,
      status,
      duration,
      category: 'api'
    })
  }
  
  userInteraction(action: string, component: string, details?: Record<string, any>) {
    this.debug(`User Interaction: ${action}`, {
      action,
      component,
      ...details,
      category: 'user-interaction'
    })
  }
  
  componentLifecycle(component: string, lifecycle: string, props?: any) {
    this.debug(`Component ${lifecycle}: ${component}`, {
      component,
      lifecycle,
      props: props ? JSON.stringify(props).slice(0, 100) : undefined,
      category: 'component'
    })
  }
  
  // ────────────────────────────────────────────────────────────
  // 🔧 IMPLEMENTAÇÃO INTERNA
  // ────────────────────────────────────────────────────────────
  
  private log(level: LogLevel, message: string, context: Record<string, any>) {
    if (!this.shouldLog(level)) return
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      sessionId: context.sessionId,
      userId: context.userId,
      component: context.component,
      action: context.action,
      duration: context.duration,
      metadata: {
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        ...context.metadata
      }
    }
    
    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry)
    }
    
    // Local storage
    if (this.config.enableLocalStorage && typeof window !== 'undefined') {
      this.saveToLocalStorage(entry)
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    }
    
    return levels[level] >= levels[this.config.level]
  }
  
  private outputToConsole(entry: LogEntry) {
    const timestamp = entry.timestamp.toISOString().slice(11, 23) // HH:mm:ss.SSS
    const prefix = `[${timestamp}] ${entry.level.toUpperCase()}`
    
    const consoleMethod = this.getConsoleMethod(entry.level)
    const styles = this.getConsoleStyles(entry.level)
    
    if (Object.keys(entry.context).length > 0) {
      consoleMethod(
        `%c${prefix}%c ${entry.message}`,
        styles.prefix,
        styles.message,
        entry.context
      )
    } else {
      consoleMethod(
        `%c${prefix}%c ${entry.message}`,
        styles.prefix,
        styles.message
      )
    }
  }
  
  private getConsoleMethod(level: LogLevel) {
    switch (level) {
      case 'debug': return console.debug
      case 'info': return console.info
      case 'warn': return console.warn
      case 'error': return console.error
      case 'fatal': return console.error
      default: return console.log
    }
  }
  
  private getConsoleStyles(level: LogLevel) {
    const styles = {
      debug: { prefix: 'color: #6B7280; font-weight: bold', message: 'color: #6B7280' },
      info: { prefix: 'color: #3B82F6; font-weight: bold', message: 'color: #1F2937' },
      warn: { prefix: 'color: #F59E0B; font-weight: bold', message: 'color: #92400E' },
      error: { prefix: 'color: #EF4444; font-weight: bold', message: 'color: #DC2626' },
      fatal: { prefix: 'color: #FFFFFF; background-color: #DC2626; font-weight: bold; padding: 2px 4px', message: 'color: #DC2626; font-weight: bold' }
    }
    
    return styles[level] || styles.info
  }
  
  private saveToLocalStorage(entry: LogEntry) {
    try {
      const key = 'app-logs'
      const existingLogs = JSON.parse(localStorage.getItem(key) || '[]')
      
      existingLogs.push(entry)
      
      // Limita número de entradas
      if (existingLogs.length > this.config.maxLocalStorageEntries) {
        existingLogs.splice(0, existingLogs.length - this.config.maxLocalStorageEntries)
      }
      
      localStorage.setItem(key, JSON.stringify(existingLogs))
    } catch (error) {
      console.warn('Falha ao salvar log no localStorage:', error)
    }
  }
  
  private categorizePerformance(duration: number): string {
    if (duration < 10) return 'excellent'
    if (duration < 50) return 'good'
    if (duration < 200) return 'acceptable'
    if (duration < 1000) return 'slow'
    return 'very-slow'
  }
  
  // ────────────────────────────────────────────────────────────
  // 🔍 UTILIDADES
  // ────────────────────────────────────────────────────────────
  
  getStoredLogs(): LogEntry[] {
    if (typeof window === 'undefined') return []
    
    try {
      return JSON.parse(localStorage.getItem('app-logs') || '[]')
        .map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }))
    } catch {
      return []
    }
  }
  
  clearStoredLogs() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app-logs')
    }
  }
  
  exportLogs(): string {
    const logs = this.getStoredLogs()
    return JSON.stringify(logs, null, 2)
  }
  
  updateConfig(newConfig: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...newConfig }
  }
  
  getConfig(): LoggerConfig {
    return { ...this.config }
  }
}

// ════════════════════════════════════════════════════════════════
// 🎯 INSTÂNCIA GLOBAL E HOOKS
// ════════════════════════════════════════════════════════════════

// Instância global do logger
const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  enableConsole: true,
  enableErrorStore: true,
  enableLocalStorage: process.env.NODE_ENV === 'development',
  enablePerformanceMetrics: true
})

// Hook para usar logger em componentes React
export const useLogger = () => {
  return logger
}

// Logging específico para stores
export const storeLogger = {
  action: (actionName: string, sessionId?: string, payload?: any) => {
    logger.storeAction(actionName, sessionId, payload)
  },
  error: (actionName: string, error: Error, sessionId?: string) => {
    logger.error(`Store Error in ${actionName}`, error, {
      action: actionName,
      sessionId,
      category: 'store-error'
    })
  }
}

export default logger