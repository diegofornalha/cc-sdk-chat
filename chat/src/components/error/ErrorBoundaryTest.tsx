'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Bug } from 'lucide-react';

/**
 * Componente para testar o GlobalErrorBoundary
 * ATENÇÃO: Este componente é apenas para desenvolvimento/teste
 */

const BuggyComponent: React.FC<{ shouldError: boolean }> = ({ shouldError }) => {
  if (shouldError) {
    // Simular erro JavaScript
    throw new Error('Teste do Global Error Boundary - Erro simulado!');
  }
  
  return (
    <div className="p-4 border border-green-200 rounded bg-green-50">
      <p className="text-green-800">✅ Componente funcionando normalmente!</p>
    </div>
  );
};

export const ErrorBoundaryTest: React.FC = () => {
  const [triggerError, setTriggerError] = useState(false);

  const handleTriggerError = () => {
    setTriggerError(true);
  };

  const handleReset = () => {
    setTriggerError(false);
  };

  // Este componente só deve aparecer em desenvolvimento
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <Card className="w-full max-w-md p-6 m-4">
      <div className="flex items-center mb-4">
        <Bug className="h-6 w-6 text-orange-500 mr-2" />
        <h2 className="text-lg font-semibold">Teste Error Boundary</h2>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Use este componente para testar se o Global Error Boundary está capturando erros corretamente.
      </p>

      <div className="mb-4">
        <BuggyComponent shouldError={triggerError} />
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={handleTriggerError}
          variant="destructive"
          size="sm"
          disabled={triggerError}
        >
          Simular Erro
        </Button>
        
        <Button 
          onClick={handleReset}
          variant="outline"
          size="sm"
        >
          Reset
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        🔧 Apenas visível em desenvolvimento
      </p>
    </Card>
  );
};

export default ErrorBoundaryTest;