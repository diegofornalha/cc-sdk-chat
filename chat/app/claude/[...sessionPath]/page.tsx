'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import ChatAPI from '@/lib/api';

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [api] = useState(() => new ChatAPI());

  useEffect(() => {
    const loadSessionFromURL = async () => {
      if (!params?.sessionPath) {
        setIsLoading(false);
        return;
      }

      try {
        // Parse URL: /claude/project/session-id
        const pathArray = Array.isArray(params.sessionPath) 
          ? params.sessionPath 
          : [params.sessionPath];

        if (pathArray.length >= 2) {
          const project = pathArray[0];
          const sessionId = pathArray[1];

          console.log(`🔍 Loading session: ${sessionId} from project: ${project}`);

          // Buscar histórico da sessão
          const response = await fetch(`http://localhost:8991/api/session-history/${sessionId}`);
          const data = await response.json();

          if (data.messages && data.messages.length > 0) {
            setSessionData({
              id: sessionId,
              project: project,
              messages: data.messages,
              file: data.file
            });

            // Salva ID da sessão atual para sincronização
            localStorage.setItem('claude_session_id', sessionId);
            localStorage.setItem('current_project', project);

            console.log(`Sessão ${sessionId.slice(-8)} carregada com ${data.messages.length} mensagens`);
          } else {
            console.warn('Sessão não encontrada ou vazia');
          }
        }
      } catch (error) {
        console.error('Erro ao carregar sessão:', error);
        console.error('Erro ao carregar sessão');
      }

      setIsLoading(false);
    };

    loadSessionFromURL();
  }, [params?.sessionPath]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      {sessionData && (
        <div className="bg-muted/30 border-b px-4 py-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">📁 Projeto:</span>
              <span className="font-mono text-xs">{sessionData.project}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">🆔 Sessão:</span>
              <span className="font-mono text-xs">{sessionData.id}</span>
              <span className="text-muted-foreground">💬 Mensagens:</span>
              <span className="font-semibold">{sessionData.messages.length}</span>
            </div>
          </div>
        </div>
      )}
      <ChatInterface sessionData={sessionData} />
    </div>
  );
}