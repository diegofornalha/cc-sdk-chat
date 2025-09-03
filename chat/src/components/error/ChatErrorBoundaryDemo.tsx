'use client';

import React from 'react';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { ErrorTestComponent } from './ErrorTestComponent';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const ChatErrorBoundaryDemo: React.FC = () => {
  const [sessionId] = React.useState('demo-session-123');

  const handleErrorRecovery = React.useCallback(() => {
    console.log('🔄 Demo: Error recovery executado');
    console.log('Recovery executado com sucesso!');
  }, []);

  const handlePreserveSession = React.useCallback(() => {
    console.log('💾 Demo: Sessão preservada');
    console.log('Sessão preservada com sucesso!');
  }, []);

  const handleTriggerError = React.useCallback((type: string) => {
    console.log(`🚨 Demo: Triggering ${type} error`);
    console.log(`Triggering ${type} error...`);
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">🛡️ Chat Error Boundary Demo</h2>
        <p className="text-muted-foreground mb-4">
          Esta demonstração mostra como o ChatErrorBoundary funciona. 
          Clique nos botões abaixo para simular diferentes tipos de erro.
        </p>
        <div className="bg-muted p-3 rounded text-xs">
          <strong>Sessão Demo:</strong> {sessionId}
        </div>
      </Card>

      <ChatErrorBoundary
        sessionId={sessionId}
        onErrorRecovery={handleErrorRecovery}
        onPreserveSession={handlePreserveSession}
      >
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">✅ Área Protegida</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esta área está protegida pelo ChatErrorBoundary. Qualquer erro aqui 
              será capturado e uma interface de recovery será mostrada.
            </p>
            
            <ErrorTestComponent onTriggerError={handleTriggerError} />
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">💬 Simulação de Chat</h3>
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <strong>Usuário:</strong> Como simular um erro de streaming?
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <strong>Claude:</strong> Você pode clicar no botão "Simular Erro de Streaming" acima para testar o ChatErrorBoundary.
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200">
            <h3 className="text-lg font-medium mb-2">⚠️ Funcionalidades de Recovery</h3>
            <ul className="text-sm space-y-1">
              <li>✅ <strong>Auto-recovery:</strong> Tentativas automáticas para erros de streaming</li>
              <li>✅ <strong>Fallback UI:</strong> Interface amigável quando há erro</li>
              <li>✅ <strong>Preserve Session:</strong> Salva e exporta dados da sessão</li>
              <li>✅ <strong>Navigation Safe:</strong> Mantém navegação funcionando</li>
              <li>✅ <strong>Error Analysis:</strong> Classifica tipos de erro automaticamente</li>
            </ul>
          </Card>
        </div>
      </ChatErrorBoundary>

      <div className="mt-6 text-center">
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="sm"
        >
          🔄 Resetar Demo
        </Button>
      </div>
    </div>
  );
};

export default ChatErrorBoundaryDemo;