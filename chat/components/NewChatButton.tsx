/**
 * Botão otimizado para Nova Conversa
 * Não cria sessões desnecessárias, apenas limpa UI
 */

import React from 'react';
import { Plus, MessageSquarePlus } from 'lucide-react';
import { useUnifiedSession } from '@/src/hooks/useUnifiedSession';

interface NewChatButtonProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export function NewChatButton({ 
  variant = 'full',
  className = '' 
}: NewChatButtonProps) {
  const { handleNewChatClick, isNewChat } = useUnifiedSession();
  
  // Se já está em nova conversa, desabilita o botão
  if (isNewChat) {
    return (
      <button
        disabled
        className={`
          px-4 py-2 rounded-lg
          bg-gray-100 text-gray-400
          cursor-not-allowed
          flex items-center gap-2
          ${className}
        `}
      >
        {variant === 'icon' ? (
          <MessageSquarePlus className="w-5 h-5" />
        ) : (
          <>
            <MessageSquarePlus className="w-5 h-5" />
            <span>Nova Conversa</span>
          </>
        )}
      </button>
    );
  }
  
  return (
    <button
      onClick={handleNewChatClick}
      className={`
        px-4 py-2 rounded-lg
        bg-blue-600 hover:bg-blue-700
        text-white font-medium
        transition-all duration-200
        flex items-center gap-2
        hover:shadow-lg
        active:scale-95
        ${className}
      `}
      title="Iniciar nova conversa (limpa o chat atual)"
    >
      {variant === 'icon' ? (
        <Plus className="w-5 h-5" />
      ) : (
        <>
          <Plus className="w-5 h-5" />
          <span>Nova Conversa</span>
        </>
      )}
    </button>
  );
}

/**
 * Versão compacta para sidebar
 */
export function NewChatButtonCompact() {
  const { handleNewChatClick, isNewChat } = useUnifiedSession();
  
  return (
    <button
      onClick={handleNewChatClick}
      disabled={isNewChat}
      className={`
        w-full p-3 rounded-lg
        flex items-center gap-3
        transition-all duration-200
        ${isNewChat 
          ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
          : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
        }
      `}
    >
      <div className={`
        p-2 rounded-lg
        ${isNewChat ? 'bg-gray-200' : 'bg-blue-100'}
      `}>
        <MessageSquarePlus className={`
          w-4 h-4
          ${isNewChat ? 'text-gray-400' : 'text-blue-600'}
        `} />
      </div>
      <div className="flex-1 text-left">
        <div className="font-medium text-sm">
          {isNewChat ? 'Nova conversa ativa' : 'Nova conversa'}
        </div>
        {!isNewChat && (
          <div className="text-xs text-gray-500">
            Limpar chat atual
          </div>
        )}
      </div>
    </button>
  );
}