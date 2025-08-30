'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';

export default function SessionViewerPage() {
  const params = useParams();
  const [sessionData, setSessionData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    if (params.project && params.sessionId) {
      // Carregar sessão específica
      fetch(`http://localhost:8992/api/session-history/${params.sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error && data.messages) {
            console.log('✅ Dados da API:', data.total_messages, 'mensagens');
            // Adaptar formato para o store
            const adaptedData = {
              ...data,
              id: data.session_id || params.sessionId,
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
    }
  }, [params.project, params.sessionId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Carregando sessão {params.sessionId?.toString().slice(-8)}...</p>
        </div>
      </div>
    );
  }

  return <ChatInterface sessionData={sessionData} />;
}