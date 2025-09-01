'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, X, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useStoreErrors, useErrorActions } from '@/stores/errorStore'

// ════════════════════════════════════════════════════════════════
// 🚨 COMPONENTE DE MONITORAMENTO DE ERROS
// ════════════════════════════════════════════════════════════════

interface ErrorMonitorProps {
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'
  autoHide?: boolean
  showRecoveredErrors?: boolean
}

const ErrorMonitor: React.FC<ErrorMonitorProps> = ({
  position = 'top-right',
  autoHide = true,
  showRecoveredErrors = false
}) => {
  const {
    errors,
    isRecovering,
    errorCount,
    lastError,
    hasErrors,
    hasUnrecoveredErrors,
    criticalErrors
  } = useStoreErrors()
  
  const {
    markErrorAsRecovered,
    clearRecoveredErrors,
    clearAllErrors,
    attemptAutoRecovery
  } = useErrorActions()
  
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [expandedError, setExpandedError] = useState<string | null>(null)
  
  // Auto-show quando há erros críticos
  useEffect(() => {
    if (criticalErrors.length > 0) {
      setIsVisible(true)
      setShowDetails(true)
    } else if (autoHide && !hasUnrecoveredErrors) {
      setIsVisible(false)
    }
  }, [criticalErrors.length, hasUnrecoveredErrors, autoHide])
  
  // Auto-hide erros resolvidos após delay
  useEffect(() => {
    if (lastError?.recovered && autoHide) {
      const timer = setTimeout(() => {
        clearRecoveredErrors()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [lastError, clearRecoveredErrors, autoHide])
  
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-left': 'top-4 left-4'
  }
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-black'
      case 'low': return 'bg-blue-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '⚡'
      case 'low': return 'ℹ️'
      default: return '❓'
    }
  }
  
  const filteredErrors = showRecoveredErrors 
    ? errors 
    : errors.filter(error => !error.recovered)
  
  // Não renderiza se não há erros para mostrar
  if (!hasErrors && !isRecovering) {
    return null
  }
  
  return (
    <div className={`fixed z-50 ${positionClasses[position]} max-w-md`}>
      {/* Indicador compacto */}
      {!isVisible && hasErrors && (
        <button
          onClick={() => setIsVisible(true)}
          className={`
            p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105
            ${criticalErrors.length > 0 
              ? 'bg-red-500 text-white animate-pulse' 
              : hasUnrecoveredErrors 
                ? 'bg-orange-500 text-white' 
                : 'bg-green-500 text-white'
            }
          `}
          title={`${errorCount} erro(s) capturado(s)`}
        >
          {criticalErrors.length > 0 ? (
            <AlertTriangle className="w-5 h-5" />
          ) : hasUnrecoveredErrors ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <CheckCircle className="w-5 h-5" />
          )}
          <span className="absolute -top-2 -right-2 bg-white text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {errorCount}
          </span>
        </button>
      )}
      
      {/* Painel expandido */}
      {isVisible && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-gray-800">
                Monitor de Erros
              </h3>
              {isRecovering && (
                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="p-1 text-gray-500 hover:text-gray-700"
                title={showDetails ? "Ocultar detalhes" : "Mostrar detalhes"}
              >
                {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Status geral */}
          <div className="px-4 py-2 bg-gray-50">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{filteredErrors.length}</span> erro(s) ativo(s)
              {isRecovering && (
                <span className="ml-2 text-blue-600">
                  • Recuperando...
                </span>
              )}
            </div>
          </div>
          
          {/* Lista de erros */}
          {showDetails && (
            <div className="max-h-64 overflow-y-auto">
              {filteredErrors.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">Nenhum erro ativo</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredErrors.slice(-10).reverse().map((error) => (
                    <div key={error.id} className="border-b border-gray-100 last:border-b-0">
                      <div 
                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedError(
                          expandedError === error.id ? null : error.id
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base">
                            {getSeverityIcon(error.severity)}
                          </span>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`
                                text-xs px-2 py-0.5 rounded font-medium
                                ${getSeverityColor(error.severity)}
                              `}>
                                {error.severity.toUpperCase()}
                              </span>
                              
                              <span className="text-xs text-gray-500">
                                {error.type}
                              </span>
                              
                              {error.recovered && (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                            
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {error.message}
                            </p>
                            
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {error.timestamp.toLocaleTimeString()}
                              </span>
                              
                              {error.actionName && (
                                <span className="text-xs text-blue-600">
                                  {error.actionName}
                                </span>
                              )}
                              
                              {error.sessionId && (
                                <span className="text-xs text-purple-600">
                                  {error.sessionId.slice(-8)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Detalhes expandidos */}
                        {expandedError === error.id && (
                          <div className="mt-3 p-3 bg-gray-50 rounded text-xs">
                            <div className="space-y-2">
                              <div>
                                <strong>Contexto:</strong>
                                <pre className="mt-1 text-gray-600 whitespace-pre-wrap break-all">
                                  {JSON.stringify(error.context, null, 2)}
                                </pre>
                              </div>
                              
                              {error.stackTrace && (
                                <div>
                                  <strong>Stack Trace:</strong>
                                  <pre className="mt-1 text-gray-600 text-xs overflow-x-auto">
                                    {error.stackTrace}
                                  </pre>
                                </div>
                              )}
                              
                              <div className="flex gap-2 mt-3">
                                {!error.recovered && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        attemptAutoRecovery(error.id)
                                      }}
                                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                      Tentar Recovery
                                    </button>
                                    
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        markErrorAsRecovered(error.id)
                                      }}
                                      className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                      Marcar Resolvido
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Footer com ações */}
          {showDetails && filteredErrors.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showRecovered"
                  checked={showRecoveredErrors}
                  onChange={(e) => setShowRecoveredErrors(e.target.checked)}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="showRecovered" className="text-xs text-gray-600">
                  Mostrar resolvidos
                </label>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={clearRecoveredErrors}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Limpar resolvidos
                </button>
                
                <button
                  onClick={clearAllErrors}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Limpar tudo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ErrorMonitor