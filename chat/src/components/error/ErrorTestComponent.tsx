'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ErrorTestComponentProps {
  onTriggerError?: (type: string) => void;
}

export const ErrorTestComponent: React.FC<ErrorTestComponentProps> = ({ 
  onTriggerError 
}) => {
  const [shouldThrowError, setShouldThrowError] = useState(false);
  const [errorType, setErrorType] = useState<string>('render');

  // Trigger error on next render
  const triggerError = (type: string) => {
    setErrorType(type);
    setShouldThrowError(true);
    onTriggerError?.(type);
  };

  // Simulate different error types
  if (shouldThrowError) {
    switch (errorType) {
      case 'streaming':
        throw new Error('Simulated streaming chunk error');
      case 'api':
        throw new Error('Simulated network fetch timeout error');  
      case 'render':
        throw new Error('Simulated component rendering error');
      case 'hook':
        throw new Error('Simulated React hook error');
      default:
        throw new Error('Simulated generic error');
    }
  }

  return (
    <Card className="p-4 m-4 max-w-md">
      <h3 className="text-lg font-medium mb-4">🧪 Chat Error Boundary Test</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Teste os diferentes tipos de erro que o ChatErrorBoundary pode capturar:
      </p>
      
      <div className="space-y-2">
        <Button 
          onClick={() => triggerError('streaming')} 
          variant="outline" 
          size="sm"
          className="w-full"
        >
          🌊 Simular Erro de Streaming
        </Button>
        
        <Button 
          onClick={() => triggerError('api')} 
          variant="outline" 
          size="sm"
          className="w-full"
        >
          📡 Simular Erro de API
        </Button>
        
        <Button 
          onClick={() => triggerError('render')} 
          variant="outline" 
          size="sm"
          className="w-full"
        >
          🎨 Simular Erro de Renderização
        </Button>
        
        <Button 
          onClick={() => triggerError('hook')} 
          variant="outline" 
          size="sm"
          className="w-full"
        >
          ⚙️ Simular Erro de Hook
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        ℹ️ Após o erro, o ChatErrorBoundary deve mostrar interface de recovery
      </p>
    </Card>
  );
};

export default ErrorTestComponent;