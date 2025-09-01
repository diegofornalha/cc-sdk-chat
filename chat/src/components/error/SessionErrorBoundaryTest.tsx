'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SessionErrorBoundary } from './index';
import { AlertTriangle, Zap } from 'lucide-react';

/**
 * Componente de teste específico para SessionErrorBoundary
 * ATENÇÃO: Use apenas em desenvolvimento para testar isolamento de sessões
 */

interface BuggySessionProps {
  sessionId: string;
  shouldCrash: boolean;
}

function BuggySession({ sessionId, shouldCrash }: BuggySessionProps) {
  const [crashCount, setCrashCount] = React.useState(0);

  if (shouldCrash && crashCount < 5) {
    // Simula erro específico de sessão
    setTimeout(() => setCrashCount(c => c + 1), 100);
    throw new Error(`Sessão ${sessionId} corrompida - tentativa ${crashCount + 1}`);
  }

  return (
    <Card className="p-4 bg-green-50 border-green-200">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
        <div>
          <div className="font-medium">Sessão {sessionId}</div>
          <div className="text-sm text-muted-foreground">
            Status: {shouldCrash ? `💥 Crasheou ${crashCount} vezes` : '✅ Funcionando normalmente'}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SessionErrorBoundaryTest() {
  const [sessions, setSessions] = React.useState([
    { id: 'session-1', shouldCrash: false },
    { id: 'session-2', shouldCrash: false },
    { id: 'session-3', shouldCrash: false }
  ]);

  const handleCrashSession = (sessionId: string) => {
    setSessions(prev => 
      prev.map(s => 
        s.id === sessionId 
          ? { ...s, shouldCrash: true }
          : s
      )
    );
  };

  const handleSessionCleanup = (sessionId: string) => {
    console.log(`🧹 Test: Removendo sessão ${sessionId}`);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleSessionRecovery = (sessionId: string) => {
    console.log(`🔄 Test: Recuperando sessão ${sessionId}`);
    setSessions(prev => 
      prev.map(s => 
        s.id === sessionId 
          ? { ...s, shouldCrash: false }
          : s
      )
    );
    return true;
  };

  const handleCreateNewSession = () => {
    const newId = `session-${Date.now()}`;
    console.log(`➕ Test: Criando nova sessão ${newId}`);
    setSessions(prev => [...prev, { id: newId, shouldCrash: false }]);
  };

  const resetAllSessions = () => {
    setSessions([
      { id: 'session-1', shouldCrash: false },
      { id: 'session-2', shouldCrash: false },
      { id: 'session-3', shouldCrash: false }
    ]);
  };

  // Só renderiza em desenvolvimento
  if (process.env.NODE_ENV !== 'development') {
    return (
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <span>SessionErrorBoundaryTest disponível apenas em desenvolvimento</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">Teste do SessionErrorBoundary</h3>
            <p className="text-sm text-muted-foreground">
              Teste como erros em sessões individuais são isolados
            </p>
          </div>
        </div>

        <div className="grid gap-4 mb-6">
          <div className="text-sm text-muted-foreground">
            <strong>Como testar:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Clique em "Crashear" em uma das sessões abaixo</li>
              <li>Observe que apenas aquela sessão será afetada</li>
              <li>As outras sessões continuarão funcionando normalmente</li>
              <li>Use os botões de recuperação no erro para testar cleanup</li>
            </ol>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <Button onClick={resetAllSessions} variant="outline">
            🔄 Resetar Todas as Sessões
          </Button>
          <Button onClick={handleCreateNewSession} variant="outline">
            ➕ Adicionar Nova Sessão
          </Button>
        </div>
      </Card>

      <div className="grid gap-4">
        {sessions.map((session) => (
          <div key={session.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Sessão: {session.id}</h4>
              <Button
                onClick={() => handleCrashSession(session.id)}
                variant="destructive"
                size="sm"
                disabled={session.shouldCrash}
              >
                💥 Crashear Esta Sessão
              </Button>
            </div>
            
            <SessionErrorBoundary
              sessionId={session.id}
              sessionTitle={`Sessão de Teste ${session.id}`}
              onSessionCleanup={handleSessionCleanup}
              onSessionRecovery={handleSessionRecovery}
              onCreateNewSession={handleCreateNewSession}
            >
              <BuggySession 
                sessionId={session.id} 
                shouldCrash={session.shouldCrash}
              />
            </SessionErrorBoundary>
          </div>
        ))}
      </div>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="text-sm">
          <strong>🔍 Observe no Console:</strong> Logs detalhados do isolamento de sessões
        </div>
      </Card>
    </div>
  );
}

export default SessionErrorBoundaryTest;