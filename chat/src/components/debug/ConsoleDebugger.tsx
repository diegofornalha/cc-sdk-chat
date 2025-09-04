'use client'

import { useEffect, useRef } from 'react'

interface DebugLog {
  timestamp: string
  type: 'info' | 'warn' | 'error' | 'success' | 'network'
  category: string
  message: string
  data?: any
}

class ConsoleDebugger {
  private static instance: ConsoleDebugger
  private logs: DebugLog[] = []
  private listeners: Set<(logs: DebugLog[]) => void> = new Set()
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  }

  private constructor() {
    this.setupInterceptors()
    this.setupNetworkInterceptor()
  }

  static getInstance(): ConsoleDebugger {
    if (!ConsoleDebugger.instance) {
      ConsoleDebugger.instance = new ConsoleDebugger()
    }
    return ConsoleDebugger.instance
  }

  private setupInterceptors() {
    // Intercepta console.log
    console.log = (...args) => {
      this.addLog('info', 'Console', args.join(' '), args)
      this.originalConsole.log(...args)
    }

    // Intercepta console.warn
    console.warn = (...args) => {
      this.addLog('warn', 'Console', args.join(' '), args)
      this.originalConsole.warn(...args)
    }

    // Intercepta console.error
    console.error = (...args) => {
      this.addLog('error', 'Console', args.join(' '), args)
      this.originalConsole.error(...args)
    }

    // Intercepta console.info
    console.info = (...args) => {
      this.addLog('info', 'Console', args.join(' '), args)
      this.originalConsole.info(...args)
    }
  }

  private setupNetworkInterceptor() {
    // Intercepta fetch
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const [url, options] = args
      const method = options?.method || 'GET'
      
      this.addLog('network', 'Network', `${method} ${url}`, {
        url,
        method,
        headers: options?.headers,
        body: options?.body
      })

      try {
        const response = await originalFetch(...args)
        
        this.addLog(
          response.ok ? 'success' : 'error',
          'Network',
          `${method} ${url} - ${response.status} ${response.statusText}`,
          {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          }
        )

        return response
      } catch (error) {
        this.addLog('error', 'Network', `${method} ${url} - Failed`, error)
        throw error
      }
    }

    // Intercepta EventSource
    if (typeof EventSource !== 'undefined') {
      const OriginalEventSource = EventSource
      
      // @ts-ignore
      window.EventSource = class extends OriginalEventSource {
        constructor(url: string, config?: EventSourceInit) {
          super(url, config)
          
          ConsoleDebugger.getInstance().addLog('network', 'SSE', `Connecting to ${url}`, { url, config })
          
          this.addEventListener('open', () => {
            ConsoleDebugger.getInstance().addLog('success', 'SSE', `Connected to ${url}`)
          })
          
          this.addEventListener('error', (e) => {
            ConsoleDebugger.getInstance().addLog('error', 'SSE', `Error on ${url}`, e)
          })
          
          this.addEventListener('message', (e) => {
            ConsoleDebugger.getInstance().addLog('info', 'SSE', `Message from ${url}`, {
              data: e.data,
              lastEventId: e.lastEventId
            })
          })
        }
      }
    }
  }

  addLog(type: DebugLog['type'], category: string, message: string, data?: any) {
    const log: DebugLog = {
      timestamp: new Date().toISOString(),
      type,
      category,
      message,
      data
    }

    this.logs.push(log)
    
    // Mantém apenas os últimos 500 logs
    if (this.logs.length > 500) {
      this.logs.shift()
    }

    this.notifyListeners()
  }

  subscribe(listener: (logs: DebugLog[]) => void) {
    this.listeners.add(listener)
    listener(this.logs)
  }

  unsubscribe(listener: (logs: DebugLog[]) => void) {
    this.listeners.delete(listener)
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.logs))
  }

  getLogs() {
    return this.logs
  }

  clearLogs() {
    this.logs = []
    this.notifyListeners()
  }

  exportLogs() {
    const blob = new Blob([JSON.stringify(this.logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug-logs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

export function useConsoleDebugger() {
  const debugInstance = ConsoleDebugger.getInstance()
  
  useEffect(() => {
    // Log inicial
    debugInstance.addLog('info', 'System', 'Console Debugger initialized')
    
    // Log de informações do navegador
    debugInstance.addLog('info', 'Browser', navigator.userAgent, {
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    })

    // Log de URL atual
    debugInstance.addLog('info', 'Location', window.location.href, {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    })

    // Monitor de mudanças de rota
    const handleRouteChange = () => {
      debugInstance.addLog('info', 'Router', `Navigation to ${window.location.pathname}`)
    }

    window.addEventListener('popstate', handleRouteChange)
    
    // Monitor de erros globais
    const handleError = (event: ErrorEvent) => {
      debugInstance.addLog('error', 'Global Error', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      })
    }
    
    window.addEventListener('error', handleError)

    // Monitor de promessas rejeitadas
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      debugInstance.addLog('error', 'Unhandled Promise', 'Promise rejected', event.reason)
    }
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [debugInstance])

  return debugInstance
}

// Componente para mostrar logs em tela
export function DebugConsole() {
  const consoleRef = useRef<HTMLDivElement>(null)
  const debugInstance = useConsoleDebugger()
  
  useEffect(() => {
    const handleLogs = (logs: DebugLog[]) => {
      if (consoleRef.current) {
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight
      }
    }

    debugInstance.subscribe(handleLogs)
    
    return () => {
      debugInstance.unsubscribe(handleLogs)
    }
  }, [debugInstance])

  const logs = debugInstance.getLogs()

  const getLogColor = (type: DebugLog['type']) => {
    switch (type) {
      case 'error': return 'text-red-500'
      case 'warn': return 'text-yellow-500'
      case 'success': return 'text-green-500'
      case 'network': return 'text-blue-500'
      default: return 'text-gray-300'
    }
  }

  return (
    <div className="fixed bottom-0 right-0 w-96 h-64 bg-black/90 border border-gray-700 rounded-tl-lg overflow-hidden z-50">
      <div className="bg-gray-800 p-2 flex justify-between items-center">
        <span className="text-white text-sm font-mono">Debug Console</span>
        <div className="flex gap-2">
          <button
            onClick={() => debugInstance.clearLogs()}
            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
          >
            Clear
          </button>
          <button
            onClick={() => debugInstance.exportLogs()}
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            Export
          </button>
        </div>
      </div>
      
      <div ref={consoleRef} className="h-full overflow-y-auto p-2 font-mono text-xs">
        {logs.map((log, index) => (
          <div key={index} className="mb-1">
            <span className="text-gray-500">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            {' '}
            <span className={`font-bold ${getLogColor(log.type)}`}>
              [{log.category}]
            </span>
            {' '}
            <span className="text-gray-300">
              {log.message}
            </span>
            {log.data && (
              <pre className="text-gray-400 ml-4 text-xs">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}