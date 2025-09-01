// ════════════════════════════════════════════════════════════════
// 🔄 EXEMPLO DE MIGRAÇÃO PARA STORE ERROR HANDLER
// ════════════════════════════════════════════════════════════════

'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'

// ────────────────────────────────────────────────────────────
// 📦 IMPORTAÇÕES ANTIGAS VS NOVAS
// ────────────────────────────────────────────────────────────

// ❌ ANTES - Store sem proteção
// import useChatStore from '@/stores/chatStore'

// ✅ DEPOIS - Store com proteção integrada
import useChatStoreProtected from '@/stores/chatStoreProtected'
import { useStoreErrors, useErrorActions } from '@/stores/errorStore'
import { useLogger } from '@/utils/logger'
import { handleAsyncError, safeExecute } from '@/components/error/ErrorBoundary'

// ────────────────────────────────────────────────────────────
// 🔄 COMPONENTE DE DEMONSTRAÇÃO DE MIGRAÇÃO
// ────────────────────────────────────────────────────────────

interface MigrationExampleProps {
  showOldVersion?: boolean
}

const ErrorHandlingMigration: React.FC<MigrationExampleProps> = ({ 
  showOldVersion = false 
}) => {
  const [activeTab, setActiveTab] = useState<'old' | 'new'>('new')
  const [testResults, setTestResults] = useState<{
    sessionCreation: 'pending' | 'success' | 'error'
    messageAdding: 'pending' | 'success' | 'error'
    migration: 'pending' | 'success' | 'error'
  }>({
    sessionCreation: 'pending',
    messageAdding: 'pending',
    migration: 'pending'
  })

  const logger = useLogger()
  const { hasErrors, errors, errorCount } = useStoreErrors()
  const { clearAllErrors, createSnapshot } = useErrorActions()

  // ────────────────────────────────────────────────────────────
  // 🏗️ IMPLEMENTAÇÃO ANTIGA (SEM PROTEÇÃO)
  // ────────────────────────────────────────────────────────────

  const OldImplementation: React.FC = () => {
    // ❌ Store sem proteção - pode falhar silenciosamente
    // const { createSession, addMessage } = useChatStore()
    
    const handleOldSessionCreation = () => {
      try {
        logger.info('Criando sessão (método antigo)')
        
        // Simulação de falha - dados inválidos
        // const sessionId = createSession({ 
        //   maxTurns: -1, // ❌ Valor inválido não validado
        //   systemPrompt: null // ❌ Tipo inválido não validado
        // })
        
        // addMessage('invalid-session-id', { // ❌ ID inválido não validado
        //   role: 'invalid-role' as any, // ❌ Role inválido não validado
        //   content: '' // ❌ Conteúdo vazio não validado
        // })
        
        setTestResults(prev => ({ ...prev, sessionCreation: 'error' }))
      } catch (error) {
        logger.error('Erro no método antigo', error)
        setTestResults(prev => ({ ...prev, sessionCreation: 'error' }))
      }
    }

    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="font-semibold text-red-800 mb-3">
          ❌ Implementação Antiga (Sem Proteção)
        </h3>
        
        <div className="space-y-3">
          <div className="text-sm text-red-700">
            <p className="mb-2">Problemas da implementação antiga:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Sem validação de entrada</li>
              <li>Falhas silenciosas</li>
              <li>Estado pode corromper</li>
              <li>Sem recovery automático</li>
              <li>Debugging difícil</li>
            </ul>
          </div>
          
          <button
            onClick={handleOldSessionCreation}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            disabled={!showOldVersion}
          >
            Testar Método Antigo
          </button>
          
          <div className="text-xs text-red-600">
            Status: {testResults.sessionCreation === 'error' ? '❌ Falhou' : '⏳ Aguardando'}
          </div>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────
  // ✅ IMPLEMENTAÇÃO NOVA (COM PROTEÇÃO)
  // ────────────────────────────────────────────────────────────

  const NewImplementation: React.FC = () => {
    const { 
      createSession, 
      addMessage, 
      migrateToRealSession,
      getActiveSession 
    } = useChatStoreProtected()

    const handleNewSessionCreation = async () => {
      // ✅ Operação com proteção e logging
      logger.startTimer('protected-session-creation')
      
      const result = await handleAsyncError(async () => {
        logger.info('Criando sessão (método protegido)')
        
        // ✅ Snapshot antes de operação crítica
        const snapshotId = createSnapshot(
          { timestamp: Date.now(), operation: 'session-creation' },
          'before-session-creation'
        )
        
        logger.debug('Snapshot criado', { snapshotId })
        
        // ✅ Validação automática de parâmetros
        const sessionId = createSession({
          maxTurns: 20,
          systemPrompt: 'Sistema protegido contra falhas',
          permissionMode: 'acceptEdits'
        })
        
        logger.info('Sessão criada com sucesso', { sessionId })
        
        // ✅ Adição de mensagem com validação
        addMessage(sessionId, {
          role: 'system',
          content: 'Sessão inicializada com proteção de erros ativa',
          timestamp: new Date()
        })
        
        logger.info('Mensagem inicial adicionada', { sessionId })
        
        // ✅ Validação de integridade final
        const session = getActiveSession()
        if (!session) {
          throw new Error('Falha na validação de integridade da sessão')
        }
        
        return { sessionId, session }
      }, 'protected-session-creation')
      
      logger.endTimer('protected-session-creation')
      
      if (result) {
        setTestResults(prev => ({ ...prev, sessionCreation: 'success' }))
        logger.info('Operação completada com sucesso', result)
      } else {
        setTestResults(prev => ({ ...prev, sessionCreation: 'error' }))
        logger.warn('Operação falhou mas foi tratada graciosamente')
      }
    }

    const handleMessageAdding = () => {
      // ✅ Execução segura com fallback
      const result = safeExecute(() => {
        logger.info('Adicionando mensagem de teste')
        
        const session = getActiveSession()
        if (!session) {
          throw new Error('Nenhuma sessão ativa encontrada')
        }
        
        addMessage(session.id, {
          role: 'user',
          content: 'Mensagem de teste com proteção de erros',
          timestamp: new Date()
        })
        
        return true
      }, false, 'safe-message-adding')
      
      setTestResults(prev => ({ 
        ...prev, 
        messageAdding: result ? 'success' : 'error' 
      }))
    }

    const handleMigration = async () => {
      // ✅ Migração protegida com validação
      const result = await handleAsyncError(async () => {
        logger.info('Testando migração protegida')
        
        // Simula UUID real do SDK
        const realSessionId = 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5g6h7'
        
        // ✅ Migração com todas as proteções
        migrateToRealSession(realSessionId)
        
        logger.info('Migração concluída', { realSessionId })
        return realSessionId
      }, 'protected-migration')
      
      setTestResults(prev => ({ 
        ...prev, 
        migration: result ? 'success' : 'error' 
      }))
    }

    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-3">
          ✅ Implementação Nova (Com Proteção)
        </h3>
        
        <div className="space-y-3">
          <div className="text-sm text-green-700">
            <p className="mb-2">Melhorias da implementação protegida:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Validação automática de entrada</li>
              <li>Snapshots para recovery</li>
              <li>Logging estruturado</li>
              <li>Recovery automático</li>
              <li>Debugging avançado</li>
              <li>Tratamento gracioso de falhas</li>
            </ul>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleNewSessionCreation}
              className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center justify-center gap-2"
            >
              {testResults.sessionCreation === 'pending' && <RefreshCw className="w-4 h-4" />}
              {testResults.sessionCreation === 'success' && <CheckCircle className="w-4 h-4" />}
              {testResults.sessionCreation === 'error' && <AlertTriangle className="w-4 h-4" />}
              Criar Sessão
            </button>
            
            <button
              onClick={handleMessageAdding}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              {testResults.messageAdding === 'pending' && <RefreshCw className="w-4 h-4" />}
              {testResults.messageAdding === 'success' && <CheckCircle className="w-4 h-4" />}
              {testResults.messageAdding === 'error' && <AlertTriangle className="w-4 h-4" />}
              Add Mensagem
            </button>
            
            <button
              onClick={handleMigration}
              className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center justify-center gap-2"
            >
              {testResults.migration === 'pending' && <RefreshCw className="w-4 h-4" />}
              {testResults.migration === 'success' && <CheckCircle className="w-4 h-4" />}
              {testResults.migration === 'error' && <AlertTriangle className="w-4 h-4" />}
              Testar Migração
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────
  // 📊 PAINEL DE STATUS
  // ────────────────────────────────────────────────────────────

  const StatusPanel: React.FC = () => (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="font-semibold text-gray-800 mb-3">
        📊 Status do Sistema de Erros
      </h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Erros Capturados:</p>
          <p className="font-bold text-lg">{errorCount}</p>
        </div>
        
        <div>
          <p className="text-gray-600">Estado:</p>
          <p className={`font-bold text-lg ${
            hasErrors ? 'text-red-600' : 'text-green-600'
          }`}>
            {hasErrors ? 'Com Erros' : 'Saudável'}
          </p>
        </div>
      </div>
      
      {errors.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Últimos Erros:</p>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {errors.slice(-3).map((error) => (
              <div key={error.id} className="text-xs bg-white p-2 rounded border">
                <span className="font-medium">{error.type}</span>: {error.message}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <button
        onClick={clearAllErrors}
        className="mt-3 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
        disabled={!hasErrors}
      >
        Limpar Erros
      </button>
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // 🎨 RENDER PRINCIPAL
  // ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          🛡️ Migração para Store Error Handler
        </h1>
        <p className="text-gray-600">
          Demonstração da evolução do sistema de tratamento de erros
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'new'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ✅ Implementação Nova
          </button>
          
          {showOldVersion && (
            <button
              onClick={() => setActiveTab('old')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'old'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ❌ Implementação Antiga
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="space-y-6">
        {activeTab === 'new' && <NewImplementation />}
        {activeTab === 'old' && showOldVersion && <OldImplementation />}
        
        <StatusPanel />
      </div>

      {/* Guia de migração */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-3">
          📖 Guia Rápido de Migração
        </h3>
        
        <div className="text-sm text-blue-700 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-medium mb-1">1. Substituir Import:</p>
              <code className="text-xs bg-white p-1 rounded block">
                import useChatStoreProtected from '@/stores/chatStoreProtected'
              </code>
            </div>
            
            <div>
              <p className="font-medium mb-1">2. Adicionar Error Hooks:</p>
              <code className="text-xs bg-white p-1 rounded block">
                import {'{ useStoreErrors }'} from '@/stores/errorStore'
              </code>
            </div>
            
            <div>
              <p className="font-medium mb-1">3. Integrar Logger:</p>
              <code className="text-xs bg-white p-1 rounded block">
                const logger = useLogger()
              </code>
            </div>
            
            <div>
              <p className="font-medium mb-1">4. Usar Utilitários:</p>
              <code className="text-xs bg-white p-1 rounded block">
                await handleAsyncError(operation, context)
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ErrorHandlingMigration