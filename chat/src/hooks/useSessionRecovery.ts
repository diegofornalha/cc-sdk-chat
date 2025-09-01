import { useCallback } from 'react';
import useChatStore from '@/stores/chatStore';

/**
 * Hook para gerenciar recuperação e cleanup de sessões com erro
 */
export function useSessionRecovery() {
  const { 
    sessions, 
    activeSessionId, 
    deleteSession, 
    createSession, 
    setActiveSession,
    clearSession 
  } = useChatStore();

  /**
   * Executa cleanup completo de uma sessão corrompida
   */
  const cleanupCorruptedSession = useCallback((sessionId: string) => {
    console.log(`🧹 Iniciando cleanup da sessão corrompida: ${sessionId}`);
    
    try {
      const session = sessions.get(sessionId);
      if (!session) {
        console.warn(`⚠️ Sessão ${sessionId} não encontrada para cleanup`);
        return;
      }

      // Log da sessão antes da remoção
      console.log(`📊 Removendo sessão: ${session.title} (${session.messages.length} mensagens)`);

      // Remove a sessão corrompida
      deleteSession(sessionId);

      // Se era a sessão ativa, cria uma nova ou seleciona outra
      if (activeSessionId === sessionId) {
        const remainingSessions = Array.from(sessions.keys()).filter(id => id !== sessionId);
        
        if (remainingSessions.length > 0) {
          // Seleciona a primeira sessão disponível
          setActiveSession(remainingSessions[0]);
          console.log(`✅ Sessão ativa mudou para: ${remainingSessions[0]}`);
        } else {
          // Cria nova sessão se não há outras
          const newSessionId = createSession();
          console.log(`✅ Nova sessão criada: ${newSessionId}`);
        }
      }

      console.log(`✅ Cleanup concluído para sessão: ${sessionId}`);
    } catch (error) {
      console.error(`❌ Erro durante cleanup da sessão ${sessionId}:`, error);
    }
  }, [sessions, activeSessionId, deleteSession, createSession, setActiveSession]);

  /**
   * Tenta recuperar uma sessão limpando suas mensagens
   */
  const recoverSession = useCallback((sessionId: string) => {
    console.log(`🔄 Tentando recuperar sessão: ${sessionId}`);
    
    try {
      const session = sessions.get(sessionId);
      if (!session) {
        console.warn(`⚠️ Sessão ${sessionId} não encontrada para recuperação`);
        return false;
      }

      // Limpa as mensagens da sessão mas mantém a configuração
      clearSession(sessionId);
      console.log(`✅ Sessão ${sessionId} foi limpa e está pronta para uso`);
      return true;
    } catch (error) {
      console.error(`❌ Erro durante recuperação da sessão ${sessionId}:`, error);
      return false;
    }
  }, [sessions, clearSession]);

  /**
   * Cria uma nova sessão de substituição
   */
  const createReplacementSession = useCallback(() => {
    console.log(`➕ Criando sessão de substituição`);
    
    try {
      const newSessionId = createSession({
        systemPrompt: 'Nova sessão após erro de recuperação',
        allowedTools: [],
        maxTurns: 20,
        permissionMode: 'acceptEdits'
      });
      
      console.log(`✅ Sessão de substituição criada: ${newSessionId}`);
      return newSessionId;
    } catch (error) {
      console.error(`❌ Erro ao criar sessão de substituição:`, error);
      return null;
    }
  }, [createSession]);

  /**
   * Verifica se uma sessão está em estado corrompido
   */
  const isSessionCorrupted = useCallback((sessionId: string): boolean => {
    const session = sessions.get(sessionId);
    if (!session) return true;

    // Verifica indicadores de corrupção
    const hasInvalidMessages = session.messages.some(msg => 
      !msg.id || !msg.content || !msg.role || !msg.timestamp
    );

    const hasNegativeMetrics = (
      session.metrics.totalTokens < 0 ||
      session.metrics.totalCost < 0 ||
      session.metrics.messageCount !== session.messages.length
    );

    return hasInvalidMessages || hasNegativeMetrics;
  }, [sessions]);

  /**
   * Executa verificação de saúde em todas as sessões
   */
  const runSessionHealthCheck = useCallback(() => {
    console.log(`🔍 Executando verificação de saúde das sessões`);
    
    const corruptedSessions: string[] = [];
    const healthySessions: string[] = [];

    sessions.forEach((session, sessionId) => {
      if (isSessionCorrupted(sessionId)) {
        corruptedSessions.push(sessionId);
      } else {
        healthySessions.push(sessionId);
      }
    });

    console.log(`📊 Resultado da verificação:`);
    console.log(`  ✅ Sessões saudáveis: ${healthySessions.length}`);
    console.log(`  ❌ Sessões corrompidas: ${corruptedSessions.length}`);

    if (corruptedSessions.length > 0) {
      console.log(`⚠️ Sessões corrompidas encontradas: ${corruptedSessions.join(', ')}`);
    }

    return {
      healthy: healthySessions,
      corrupted: corruptedSessions,
      total: sessions.size
    };
  }, [sessions, isSessionCorrupted]);

  return {
    cleanupCorruptedSession,
    recoverSession,
    createReplacementSession,
    isSessionCorrupted,
    runSessionHealthCheck
  };
}

export default useSessionRecovery;