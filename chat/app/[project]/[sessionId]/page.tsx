'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';

interface SessionData {
  projectPath: string;
  sessionId: string;
  activeSessionId: string;
  messages?: any[];
}

export default function SessionViewerPage() {
  const params = useParams();
  const [sessionData, setSessionData] = React.useState<SessionData | null>(null);
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
        import('@/lib/config').then(({ config }) => {
          return fetch(`${config.getApiUrl()}/api/session-history/${realSessionId}`)
        })
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

  // Detecta se é uma sessão do Claude Code (projeto termina com -api)
  const isClaudeCodeSession = params?.project?.toString().endsWith('-api') || 
                              params?.project?.toString().includes('claude-api-claude-code');
  
  // Verificar se a sessão foi iniciada pelo Terminal (Claude Code) 
  // Sessões do Terminal geralmente têm metadados específicos ou padrão diferente
  const checkIfTerminalSession = () => {
    // Se temos os dados da sessão, podemos verificar metadados
    if (sessionData && sessionData.messages && sessionData.messages.length > 0) {
      const firstMessage = sessionData.messages[0];
      // Sessões do Terminal podem ter características específicas
      // Por exemplo, podem ter um campo 'cwd' ou 'userType' diferente
      return false; // Por enquanto, vamos manter editável até identificarmos o padrão
    }
    return false;
  };
  
  // Lista de sessões específicas do Terminal que devem ser somente leitura
  const terminalSessionIds = [
    '01e5dd2d-2b7f-409a-8c73-7827ec8139f0', // Nossa conversa atual no Terminal
    // Adicione outros IDs de sessões do Terminal aqui
  ];
  
  // Sessão é somente leitura SE:
  // 1. For uma sessão específica do Terminal (na lista)
  // 2. OU for do Claude Code E for identificada como sessão do Terminal
  const isReadOnly = terminalSessionIds.includes(params?.sessionId?.toString() || '') ||
                     (isClaudeCodeSession && checkIfTerminalSession());
  
  return <ChatInterface sessionData={sessionData} readOnly={isReadOnly} />;
}