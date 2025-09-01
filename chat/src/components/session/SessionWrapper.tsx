'use client';

import React from 'react';
import SessionErrorBoundary from '@/components/error/SessionErrorBoundary';
import { useSessionRecovery } from '@/hooks/useSessionRecovery';
import { Session } from '@/stores/chatStore';

interface SessionWrapperProps {
  session: Session;
  children: React.ReactNode;
  isActive?: boolean;
}

/**
 * Wrapper que aplica Error Boundary individual para cada sessão
 * Permite isolamento de falhas e recuperação graceful
 */
export function SessionWrapper({ 
  session, 
  children, 
  isActive = false 
}: SessionWrapperProps) {
  const { 
    cleanupCorruptedSession, 
    recoverSession, 
    createReplacementSession 
  } = useSessionRecovery();

  const handleSessionCleanup = React.useCallback((sessionId: string) => {
    console.log(`🧹 Wrapper executando cleanup da sessão: ${sessionId}`);
    cleanupCorruptedSession(sessionId);
  }, [cleanupCorruptedSession]);

  const handleSessionRecovery = React.useCallback((sessionId: string) => {
    console.log(`🔄 Wrapper executando recuperação da sessão: ${sessionId}`);
    return recoverSession(sessionId);
  }, [recoverSession]);

  const handleCreateNewSession = React.useCallback(() => {
    console.log(`➕ Wrapper criando nova sessão`);
    createReplacementSession();
  }, [createReplacementSession]);

  // Fallback customizado para sessões que não são ativas
  const customFallback = !isActive ? (
    <div className="p-4 text-center text-muted-foreground bg-muted/20 rounded border border-dashed border-muted-foreground/30">
      <div className="text-sm">
        Sessão "{session.title}" encontrou um erro
      </div>
      <div className="text-xs mt-1">
        {session.id.slice(-8)} • {session.messages.length} mensagens
      </div>
    </div>
  ) : undefined;

  return (
    <SessionErrorBoundary
      key={session.id}
      sessionId={session.id}
      sessionTitle={session.title}
      onSessionCleanup={handleSessionCleanup}
      onSessionRecovery={handleSessionRecovery}
      onCreateNewSession={handleCreateNewSession}
      fallback={customFallback}
    >
      {children}
    </SessionErrorBoundary>
  );
}

export default SessionWrapper;