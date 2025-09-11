/**
 * Hook para gerenciar sessão unificada com tab=new
 * Evita criar múltiplas sessões desnecessárias
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ID único e fixo para todas as sessões
const UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001";

interface UseUnifiedSessionReturn {
  sessionId: string;
  isNewChat: boolean;
  clearChat: () => void;
  initializeChat: () => void;
  handleNewChatClick: () => void;
  handleFirstMessage: () => void;
}

export function useUnifiedSession(): UseUnifiedSessionReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNewChat, setIsNewChat] = useState(false);
  
  // Sempre usa o mesmo session ID
  const sessionId = UNIFIED_SESSION_ID;
  
  // Detecta quando está em modo "nova conversa"
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    
    if (tabParam === 'new') {
      // Apenas marca como novo chat, não cria sessão
      setIsNewChat(true);
      console.log('🆕 Modo nova conversa ativado (sem criar sessão)');
    }
  }, [searchParams]);
  
  /**
   * Limpa o chat visualmente sem criar nova sessão
   */
  const clearChat = useCallback(() => {
    // Dispara evento para limpar UI
    window.dispatchEvent(new CustomEvent('clear-chat-ui'));
    setIsNewChat(true);
  }, []);
  
  /**
   * Inicializa o chat (chamado no mount do componente)
   */
  const initializeChat = useCallback(() => {
    const tabParam = searchParams.get('tab');
    
    if (tabParam === 'new') {
      // Limpa UI mas não cria sessão
      clearChat();
    } else {
      // Carrega histórico existente se houver
      window.dispatchEvent(new CustomEvent('load-chat-history', {
        detail: { sessionId }
      }));
    }
  }, [searchParams, sessionId, clearChat]);
  
  /**
   * Handler para clique no botão "Nova Conversa"
   */
  const handleNewChatClick = useCallback(() => {
    // Adiciona ?tab=new na URL
    const currentPath = window.location.pathname;
    router.push(`${currentPath}?tab=new`);
    
    // Limpa UI imediatamente
    clearChat();
    
    console.log('🔄 Nova conversa iniciada (UI limpa, sem criar sessão)');
  }, [router, clearChat]);
  
  /**
   * Handler para quando a primeira mensagem é enviada
   * Remove ?tab=new da URL
   */
  const handleFirstMessage = useCallback(() => {
    if (isNewChat) {
      // Remove o parâmetro tab=new da URL
      const currentPath = window.location.pathname;
      router.replace(currentPath);
      
      setIsNewChat(false);
      
      console.log('💬 Primeira mensagem enviada, removendo tab=new');
    }
  }, [isNewChat, router]);
  
  return {
    sessionId,
    isNewChat,
    clearChat,
    initializeChat,
    handleNewChatClick,
    handleFirstMessage
  };
}