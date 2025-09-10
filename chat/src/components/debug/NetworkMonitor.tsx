import React, { useState, useEffect } from 'react';
import { X, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  timestamp: Date;
  duration?: number;
  size?: number;
  type?: string;
  error?: boolean;
}

export function NetworkMonitor() {
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequest | null>(null);

  useEffect(() => {
    // Intercepta fetch para monitorar requisições
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const [url, options] = args;
      const startTime = Date.now();
      const requestId = Math.random().toString(36).substr(2, 9);
      
      // Adiciona requisição pendente
      const newRequest: NetworkRequest = {
        id: requestId,
        url: url.toString(),
        method: options?.method || 'GET',
        status: 0,
        statusText: 'Pending',
        timestamp: new Date(),
      };
      
      setRequests(prev => [newRequest, ...prev].slice(0, 50)); // Mantém últimas 50
      
      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;
        
        // Atualiza com resposta
        setRequests(prev => prev.map(req => 
          req.id === requestId 
            ? {
                ...req,
                status: response.status,
                statusText: response.ok ? 'OK' : 'Error',
                duration,
                type: response.headers.get('content-type')?.split(';')[0] || 'unknown',
                error: !response.ok
              }
            : req
        ));
        
        return response;
      } catch (error) {
        // Atualiza com erro
        setRequests(prev => prev.map(req => 
          req.id === requestId 
            ? {
                ...req,
                status: 0,
                statusText: 'Failed',
                duration: Date.now() - startTime,
                error: true
              }
            : req
        ));
        throw error;
      }
    };
    
    // Cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Atalho de teclado para mostrar/esconder
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isVisible) {
    return null; // Removido - use apenas Ctrl+Shift+N para abrir
  }

  const realtimeRequests = requests.filter(req => 
    req.url.includes('/realtime/') || 
    req.url.includes('/chat') ||
    req.url.includes('/session')
  );

  return (
    <div className={`fixed bottom-4 left-4 z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 transition-all ${
      isExpanded ? 'w-[600px] h-[400px]' : 'w-[400px] h-[200px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Network Monitor</span>
          <span className="text-xs text-gray-500">
            ({realtimeRequests.length} requests)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Request List */}
      <div className="overflow-y-auto" style={{ height: isExpanded ? '340px' : '140px' }}>
        {realtimeRequests.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Nenhuma requisição em tempo real
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {realtimeRequests.map(req => (
              <div
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                  selectedRequest?.id === req.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-xs font-mono px-1 py-0.5 rounded ${
                      req.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      req.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {req.method}
                    </span>
                    <span className="text-xs truncate flex-1">
                      {req.url.replace('http://localhost:8991', '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${
                      req.status === 200 ? 'text-green-600' :
                      req.status === 0 ? 'text-gray-500' :
                      req.status >= 400 ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {req.status || '...'}
                    </span>
                    {req.duration && (
                      <span className="text-xs text-gray-500">
                        {req.duration}ms
                      </span>
                    )}
                  </div>
                </div>
                
                {/* URL completa quando selecionado */}
                {selectedRequest?.id === req.id && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-xs space-y-1">
                      <div className="flex gap-2">
                        <span className="text-gray-500">URL:</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300 break-all">
                          {req.url}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500">Status:</span>
                        <span className={`font-mono ${
                          req.status === 200 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {req.status} {req.statusText}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500">Tempo:</span>
                        <span className="font-mono">{req.timestamp.toLocaleTimeString()}</span>
                      </div>
                      {req.type && (
                        <div className="flex gap-2">
                          <span className="text-gray-500">Tipo:</span>
                          <span className="font-mono">{req.type}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer com estatísticas */}
      {isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>
              Polling: {realtimeRequests.filter(r => r.url.includes('/realtime/latest')).length}
            </span>
            <span>
              Chat: {realtimeRequests.filter(r => r.url.includes('/chat')).length}
            </span>
            <span>
              Erros: {realtimeRequests.filter(r => r.error).length}
            </span>
            <span className="text-gray-400">
              Ctrl+Shift+N para toggle
            </span>
          </div>
        </div>
      )}
    </div>
  );
}