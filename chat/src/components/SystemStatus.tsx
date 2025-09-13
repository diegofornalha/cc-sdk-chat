'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, Server, Globe, RefreshCw, Activity } from 'lucide-react';

interface SystemStatusProps {
  className?: string;
}

export function SystemStatus({ className }: SystemStatusProps) {
  const [apiStatus, setApiStatus] = React.useState<'checking' | 'online' | 'offline'>('checking');
  const [apiPort, setApiPort] = React.useState<string>('');
  const [frontendPort, setFrontendPort] = React.useState<string>('');
  const [lastCheck, setLastCheck] = React.useState<Date>(new Date());

  const checkApiStatus = React.useCallback(async () => {
    try {
      const { config } = await import('@/lib/config');
      const apiUrl = config.getApiUrl();
      const port = apiUrl.split(':').pop() || '8991';
      setApiPort(port);
      
      const response = await fetch(`${apiUrl}/`);
      if (response.ok) {
        setApiStatus('online');
      } else {
        setApiStatus('offline');
      }
    } catch (error) {
      setApiStatus('offline');
    }
    setLastCheck(new Date());
  }, []);

  React.useEffect(() => {
    // Definir porta do frontend
    setFrontendPort(window.location.port || '3082');
    
    // Verificar status da API
    checkApiStatus();
    
    // Verificar a cada 30 segundos
    const interval = setInterval(checkApiStatus, 30000);
    
    return () => clearInterval(interval);
  }, [checkApiStatus]);

  const formatLastCheck = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'Agora mesmo';
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    return date.toLocaleTimeString('pt-BR');
  };

  return (
    <Card className={`p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Status do Sistema
          </h3>
          <button
            onClick={checkApiStatus}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            {formatLastCheck(lastCheck)}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {/* API Status */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">API Backend</p>
                <p className="text-xs text-muted-foreground">
                  http://localhost:{apiPort || '8991'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {apiStatus === 'checking' ? (
                <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />
              ) : apiStatus === 'online' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium text-green-600">Online</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-medium text-red-600">Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Frontend Status */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Frontend</p>
                <p className="text-xs text-muted-foreground">
                  http://localhost:{frontendPort}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-green-600">Online</span>
            </div>
          </div>
        </div>

        {/* SDK Info */}
        <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Claude Code SDK</span>
            <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">
              v0.0.21
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}