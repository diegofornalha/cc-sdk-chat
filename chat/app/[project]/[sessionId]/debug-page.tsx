'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { DebugConsole } from '@/components/debug/ConsoleDebugger';

export default function DebugSessionPage() {
  const params = useParams();
  const [sessionData, setSessionData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [debugMode, setDebugMode] = useState(true);

  // Ativa logs detalhados globalmente
  useEffect(() => {
    // Override console para mostrar tudo
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    // Adiciona timestamp e formatação
    console.log = (...args) => {
      originalLog(`[${new Date().toLocaleTimeString()}]`, ...args);
    };

    console.error = (...args) => {
      originalError(`[${new Date().toLocaleTimeString()}]`, '❌', ...args);
    };

    console.warn = (...args) => {
      originalWarn(`[${new Date().toLocaleTimeString()}]`, '⚠️', ...args);
    };

    // Log inicial
    console.log('🔧 DEBUG MODE ATIVADO');
    console.log('📍 Parâmetros:', params);
    console.log('🌐 URL:', window.location.href);

    // Intercepta fetch para logar todas as requisições
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      
      console.log(`🚀 [${method}] ${url}`);
      if (options?.body) {
        try {
          console.log('📦 Body:', JSON.parse(options.body as string));
        } catch {
          console.log('📦 Body:', options.body);
        }
      }

      const startTime = Date.now();
      
      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;
        
        console.log(`✅ [${method}] ${url} - ${response.status} (${duration}ms)`);
        
        // Para SSE, intercepta o stream
        if (url.includes('/api/chat') && method === 'POST') {
          const clonedResponse = response.clone();
          
          // Processa o stream para debug
          const reader = clonedResponse.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let chunkNumber = 0;
            
            (async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) {
                    console.log('🏁 Stream finalizado');
                    break;
                  }
                  
                  const text = decoder.decode(value, { stream: true });
                  const lines = text.split('\n');
                  
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      chunkNumber++;
                      const data = line.slice(6);
                      try {
                        const parsed = JSON.parse(data);
                        console.log(`📨 Chunk #${chunkNumber}:`, {
                          type: parsed.type,
                          content: parsed.content?.substring(0, 50),
                          sessionId: parsed.session_id
                        });
                      } catch {
                        console.log(`📨 Chunk #${chunkNumber} (raw):`, data);
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('Erro ao ler stream:', error);
              }
            })();
          }
        }
        
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ [${method}] ${url} - Failed (${duration}ms)`, error);
        throw error;
      }
    };

    // Cleanup
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.fetch = originalFetch;
    };
  }, [params]);

  const resolveSessionId = async (sessionSlug: string, projectName: string) => {
    console.log('🔍 Resolvendo session ID:', { sessionSlug, projectName });
    
    // Se já é um UUID, usar diretamente
    if (sessionSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
      console.log('✅ É um UUID válido');
      return sessionSlug;
    }

    console.log('❌ Não é um UUID, retornando como está');
    return sessionSlug;
  };

  useEffect(() => {
    async function loadSession() {
      const projectName = decodeURIComponent(params.project as string);
      const sessionSlug = decodeURIComponent(params.sessionId as string);
      
      console.log('📂 Carregando sessão:', { projectName, sessionSlug });
      
      try {
        const realSessionId = await resolveSessionId(sessionSlug, projectName);
        console.log('🔑 Session ID real:', realSessionId);
        
        setSessionData({
          projectPath: projectName,
          sessionId: realSessionId,
          activeSessionId: realSessionId
        });
      } catch (error) {
        console.error('Erro ao carregar sessão:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [params]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium">Carregando sessão de debug...</h2>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-red-500">Sessão não encontrada</h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <ChatInterface
          projectPath={sessionData.projectPath}
          sessionId={sessionData.sessionId}
          activeSessionId={sessionData.activeSessionId}
          showProjectName={true}
        />
        
        {/* Painel de Debug */}
        <div className="fixed top-2 right-2 bg-black/90 text-white p-2 rounded text-xs font-mono z-50">
          <div>🔧 DEBUG MODE</div>
          <div>📍 Session: {sessionData.sessionId?.substring(0, 8)}</div>
          <div>⏰ {new Date().toLocaleTimeString()}</div>
        </div>

        {/* Console de Debug */}
        {debugMode && <DebugConsole />}
        
        {/* Toggle Debug Console */}
        <button
          onClick={() => setDebugMode(!debugMode)}
          className="fixed bottom-4 left-4 bg-blue-600 text-white px-3 py-1 rounded text-sm z-50 hover:bg-blue-700"
        >
          {debugMode ? 'Ocultar' : 'Mostrar'} Debug
        </button>
      </div>
    </>
  );
}