'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import useErrorStore from '@/stores/errorStore'

// ════════════════════════════════════════════════════════════════
// 🛡️ ERROR BOUNDARY INTEGRADO COM ERROR STORE
// ════════════════════════════════════════════════════════════════

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
  context?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorId: string | null
  retryCount: number
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 [ERROR-BOUNDARY] Erro capturado:', error, errorInfo)
    
    // Integra com o Error Store
    const errorStore = useErrorStore.getState()
    const errorId = errorStore.captureError(error, {
      actionName: 'react-component-error',
      context: this.props.context || 'unknown',
      severity: 'critical',
      type: 'unknown'
    })
    
    this.setState({ errorId })
    
    // Callback customizado se fornecido
    this.props.onError?.(error, errorInfo)
    
    // Auto-retry para erros não críticos
    if (this.state.retryCount < 3 && !this.isCriticalError(error)) {
      this.scheduleRetry()
    }
  }
  
  private isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      /chunk.*loading.*failed/i,
      /loading.*css.*chunk.*failed/i,
      /network.*error/i,
      /script.*error/i
    ]
    
    return criticalPatterns.some(pattern => pattern.test(error.message))
  }
  
  private scheduleRetry = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
    
    const delay = Math.pow(2, this.state.retryCount) * 1000 // Backoff exponencial
    console.log(`🔄 [ERROR-BOUNDARY] Agendando retry em ${delay}ms...`)
    
    this.retryTimeout = setTimeout(() => {
      this.handleRetry()
    }, delay)
  }
  
  private handleRetry = () => {
    console.log('🔄 [ERROR-BOUNDARY] Tentando recuperação...')
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }))
    
    // Marca erro como recuperado no store
    if (this.state.errorId) {
      const errorStore = useErrorStore.getState()
      errorStore.markErrorAsRecovered(this.state.errorId)
    }
  }
  
  private handleManualRetry = () => {
    console.log('🔄 [ERROR-BOUNDARY] Retry manual solicitado')
    this.handleRetry()
  }
  
  private handleGoHome = () => {
    // Reset completo e navega para home
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0
    })
    
    // Limpa erro store
    const errorStore = useErrorStore.getState()
    if (this.state.errorId) {
      errorStore.markErrorAsRecovered(this.state.errorId)
    }
    
    // Navega para home
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }
  
  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  render() {
    if (this.state.hasError) {
      // Usa fallback customizado se fornecido
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      // UI padrão de erro
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              {/* Ícone de erro */}
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              
              {/* Título */}
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Ops! Algo deu errado
              </h1>
              
              {/* Descrição */}
              <p className="text-gray-600 mb-6">
                Ocorreu um erro inesperado na aplicação. Nosso sistema já foi 
                notificado e está trabalhando na correção.
              </p>
              
              {/* Detalhes do erro (modo desenvolvimento) */}
              {this.props.showDetails && this.state.error && (
                <div className="mb-6 p-4 bg-red-50 rounded-lg text-left">
                  <h3 className="text-sm font-medium text-red-800 mb-2">
                    Detalhes Técnicos:
                  </h3>
                  <code className="text-xs text-red-700 break-all">
                    {this.state.error.message}
                  </code>
                  
                  {this.state.errorId && (
                    <p className="text-xs text-red-600 mt-2">
                      ID do Erro: {this.state.errorId}
                    </p>
                  )}
                </div>
              )}
              
              {/* Informações de retry */}
              {this.state.retryCount > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Tentativas de recuperação: {this.state.retryCount}/3
                  </p>
                </div>
              )}
              
              {/* Botões de ação */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleManualRetry}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar Novamente
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Voltar ao Início
                </button>
              </div>
              
              {/* Informações adicionais */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Se o problema persistir, recarregue a página ou entre em contato 
                  com o suporte técnico.
                </p>
                
                {this.state.errorId && (
                  <p className="text-xs text-gray-400 mt-1">
                    Referência: {this.state.errorId.slice(-8)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// ════════════════════════════════════════════════════════════════
// 🎯 HOOK PARA ERROR BOUNDARY FUNCIONAL
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'

export const useErrorHandler = () => {
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    if (error) {
      const errorStore = useErrorStore.getState()
      errorStore.captureError(error, {
        actionName: 'hook-error-handler',
        severity: 'high',
        type: 'unknown'
      })
    }
  }, [error])
  
  const captureError = (error: Error) => {
    console.error('🚨 [ERROR-HANDLER] Erro capturado via hook:', error)
    setError(error)
  }
  
  const clearError = () => {
    setError(null)
  }
  
  return {
    error,
    captureError,
    clearError,
    hasError: !!error
  }
}

// ════════════════════════════════════════════════════════════════
// 🛡️ HOC PARA PROTEÇÃO DE COMPONENTES
// ════════════════════════════════════════════════════════════════

export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<Props>
) => {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// ════════════════════════════════════════════════════════════════
// 🔧 UTILS PARA TRATAMENTO DE ERROS ASSÍNCRONOS
// ════════════════════════════════════════════════════════════════

export const handleAsyncError = async <T>(
  asyncOperation: () => Promise<T>,
  context: string = 'async-operation'
): Promise<T | null> => {
  try {
    return await asyncOperation()
  } catch (error) {
    const errorStore = useErrorStore.getState()
    errorStore.captureError(error, {
      actionName: context,
      severity: 'medium',
      type: 'network'
    })
    
    console.error(`🚨 [ASYNC-ERROR] Erro em ${context}:`, error)
    return null
  }
}

export const safeExecute = <T>(
  operation: () => T,
  fallback: T,
  context: string = 'safe-execute'
): T => {
  try {
    return operation()
  } catch (error) {
    const errorStore = useErrorStore.getState()
    errorStore.captureError(error, {
      actionName: context,
      severity: 'low',
      type: 'validation'
    })
    
    console.warn(`⚠️ [SAFE-EXECUTE] Usando fallback para ${context}:`, error)
    return fallback
  }
}

export default ErrorBoundary