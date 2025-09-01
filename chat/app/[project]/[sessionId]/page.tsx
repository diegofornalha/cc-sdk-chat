'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';

export default function SessionViewerPage() {
  const params = useParams();
  const [sessionData, setSessionData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const resolveSessionId = async (sessionSlug: string, projectName: string) => {
    // Se já é um UUID, usar diretamente
    if (sessionSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
      return sessionSlug;
    }


    // Para URLs semânticas como "terminal-05d20033", buscar o UUID real
    if (sessionSlug.startsWith('terminal-')) {
      const shortId = sessionSlug.replace('terminal-', '');
      
      try {
        // Buscar sessões do projeto para encontrar o UUID completo
        const response = await fetch('/api/load-project-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath: `/home/suthub/.claude/projects/${projectName}`,
            primarySessionId: 'dashboard'
          })
        });

        if (response.ok) {
          const { sessions } = await response.json();
          
          // Procurar sessão que termina com o shortId ou referencia ele
          for (const session of sessions) {
            if (session.id.endsWith(shortId) || session.id.includes(shortId)) {
              return session.id;
            }
            
            // Verificar se a primeira mensagem referencia este ID
            const firstMessage = session.messages?.[0]?.content || '';
            if (firstMessage.includes(shortId)) {
              return session.id;
            }
          }
        }
      } catch (error) {
        console.error('Erro ao resolver session slug:', error);
      }
    }

    return sessionSlug; // Fallback
  };

  useEffect(() => {
    if (params && params.project && params.sessionId) {
      const loadSession = async () => {
        const realSessionId = await resolveSessionId(
          params.sessionId as string, 
          params.project as string
        );
        
        if (!realSessionId) return; // Redirecionamento já feito

        // Carregar sessão específica
        fetch(`http://localhost:8992/api/session-history/${realSessionId}`)
          .then(res => res.json())
          .then(data => {
            if (!data.error && data.messages) {
              console.log('✅ Dados da API:', data.total_messages, 'mensagens');
              // Adaptar formato para o store
              const adaptedData = {
                ...data,
                id: data.session_id || realSessionId,
                messages: data.messages
              };
              console.log('✅ Sessão adaptada:', adaptedData.messages?.length, 'mensagens');
              setSessionData(adaptedData);
            } else {
              console.log('❌ Erro nos dados:', data);
            }
            setIsLoading(false);
          })
          .catch(err => {
            console.error('Erro:', err);
            setIsLoading(false);
          });
      };

      loadSession();
    }
  }, [params?.project, params?.sessionId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Carregando sessão {params?.sessionId?.toString().slice(-8) || 'desconhecida'}...</p>
        </div>
      </div>
    );
  }

  return <ChatInterface sessionData={sessionData} />;
}