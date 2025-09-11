/**
 * Componente de Chat otimizado com sessão unificada
 * Implementa a solução tab=new sem criar múltiplas sessões
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUnifiedSession } from '@/src/hooks/useUnifiedSession';
import { NewChatButton } from './NewChatButton';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatComponent() {
  const {
    sessionId,
    isNewChat,
    clearChat,
    initializeChat,
    handleFirstMessage
  } = useUnifiedSession();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Inicializa o chat no mount
  useEffect(() => {
    initializeChat();
  }, [initializeChat]);
  
  // Listener para limpar UI
  useEffect(() => {
    const handleClearUI = () => {
      setMessages([]);
      setInput('');
      console.log('🧹 UI limpa (mantendo mesma sessão)');
    };
    
    window.addEventListener('clear-chat-ui', handleClearUI);
    return () => window.removeEventListener('clear-chat-ui', handleClearUI);
  }, []);
  
  // Listener para carregar histórico
  useEffect(() => {
    const handleLoadHistory = async (event: CustomEvent) => {
      const { sessionId } = event.detail;
      
      try {
        const response = await fetch(`/api/sessions/${sessionId}/history`);
        if (response.ok) {
          const data = await response.json();
          const formattedMessages = data.messages.map((msg: any) => ({
            id: crypto.randomUUID(),
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(formattedMessages);
          console.log(`📜 Histórico carregado: ${formattedMessages.length} mensagens`);
        }
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
      }
    };
    
    window.addEventListener('load-chat-history', handleLoadHistory as EventListener);
    return () => window.removeEventListener('load-chat-history', handleLoadHistory as EventListener);
  }, []);
  
  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  /**
   * Envia mensagem para o backend
   */
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    // Adiciona mensagem do usuário
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Se é a primeira mensagem após "nova conversa"
    if (isNewChat) {
      handleFirstMessage();
    }
    
    try {
      // Sempre usa o session ID unificado
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          session_id: sessionId // Sempre o mesmo ID
        })
      });
      
      if (!response.ok) throw new Error('Erro na resposta');
      
      // Processa streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text_chunk' && data.content) {
                  assistantMessage.content += data.content;
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: assistantMessage.content }
                        : msg
                    )
                  );
                }
              } catch (e) {
                // Ignora erros de parse
              }
            }
          }
        }
      }
      
      // Salva mensagem no histórico do backend
      await fetch(`/api/sessions/${sessionId}/add-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'assistant',
          content: assistantMessage.content
        })
      });
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Claude Chat</h1>
          {isNewChat && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              Nova conversa
            </span>
          )}
        </div>
        <NewChatButton />
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {isNewChat ? 'Nova conversa iniciada' : 'Inicie uma conversa'}
              </h3>
              <p className="text-gray-500 text-sm">
                Digite sua mensagem abaixo para começar
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[80%] px-4 py-3 rounded-lg
                    ${message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-800'
                    }
                  `}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className={`
                    text-xs mt-2
                    ${message.role === 'user' ? 'text-blue-100' : 'text-gray-400'}
                  `}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <div className="bg-white border-t px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={isNewChat ? "Digite sua primeira mensagem..." : "Digite sua mensagem..."}
              disabled={isLoading}
              className="
                flex-1 px-4 py-3 rounded-lg
                border border-gray-300 focus:border-blue-500
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                disabled:bg-gray-100 disabled:cursor-not-allowed
              "
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="
                px-6 py-3 rounded-lg
                bg-blue-600 text-white font-medium
                hover:bg-blue-700 disabled:bg-gray-300
                disabled:cursor-not-allowed
                transition-colors duration-200
              "
            >
              {isLoading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2 text-center">
            Session ID: {sessionId} {isNewChat && '• Modo nova conversa ativo'}
          </div>
        </div>
      </div>
    </div>
  );
}