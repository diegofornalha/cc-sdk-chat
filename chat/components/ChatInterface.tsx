import React, { useEffect, useRef } from 'react';
import { MessageInput } from './MessageInput';
import { StreamingMessage } from './StreamingMessage';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { ChatMessage } from '../lib/api';

export const ChatInterface: React.FC = () => {
    // Hook customizado simplificado para gerenciar todo o estado
    const {
        messages,
        isStreaming,
        currentStreamContent,
        sessionId,
        tokenInfo,
        costInfo,
        initializeAPI,
        sendMessage,
        clearSession,
        interruptStreaming,
        cleanup
    } = useStreamingChat();
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Inicializa API quando o componente monta
        initializeAPI();
        
        // Cleanup quando desmonta
        return () => {
            cleanup();
        };
    }, [initializeAPI, cleanup]);

    useEffect(() => {
        // Auto-scroll para última mensagem
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentStreamContent]);

    const handleSendMessage = async (message: string) => {
        // Não bloqueia mais durante streaming - permite múltiplas mensagens
        console.log('Sending message:', message);
        await sendMessage(message);
    };

    const handleClearSession = async () => {
        // Permite limpar sessão a qualquer momento
        await clearSession();
    };

    const handleInterrupt = async () => {
        if (!isStreaming) return;
        await interruptStreaming();
    };

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <h1 className="chat-title">🤖 Claude Chat</h1>
                <div className="chat-controls">
                    {sessionId && (
                        <span className="session-info">Sessão: {sessionId.slice(0, 8)}</span>
                    )}
                    <button
                        onClick={handleClearSession}
                        disabled={false}
                        className="control-button"
                    >
                        🔄 Limpar
                    </button>
                    {isStreaming && (
                        <button
                            onClick={handleInterrupt}
                            className="control-button interrupt-button"
                        >
                            ⏸️ Interromper
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={`msg-${index}`}>
                        <StreamingMessage
                            content={msg.content}
                            role={msg.role}
                            isStreaming={false}
                        />
                        {msg.tokens && (
                            <div className="token-info">
                                Tokens: {msg.tokens.input}↑ {msg.tokens.output}↓
                                {msg.cost && ` | Custo: $${msg.cost.toFixed(6)}`}
                            </div>
                        )}
                    </div>
                ))}
                
                {isStreaming && currentStreamContent && (
                    <div key="streaming-msg">
                        <StreamingMessage
                            content={currentStreamContent}
                            role="assistant"
                            isStreaming={true}
                        />
                        {tokenInfo && (
                            <div className="token-info streaming-info">
                                Tokens: {tokenInfo.input}↑ {tokenInfo.output}↓
                                {costInfo && ` | Custo: $${costInfo.toFixed(6)}`}
                            </div>
                        )}
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            <MessageInput
                onSendMessage={handleSendMessage}
                disabled={false}
                placeholder="Digite sua mensagem..."
            />

            <style jsx>{`
                .chat-interface {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    max-height: 100vh;
                    background: var(--bg-primary, white);
                }

                .chat-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    background: var(--bg-secondary, #fafafa);
                    border-bottom: 1px solid var(--border-color, #e5e5e5);
                }

                .chat-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: var(--text-primary, #1a1a1a);
                    margin: 0;
                }

                .chat-controls {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .session-info {
                    font-size: 12px;
                    color: var(--text-secondary, #666);
                    padding: 4px 8px;
                    background: var(--bg-tertiary, #f0f0f0);
                    border-radius: 4px;
                }

                .control-button {
                    padding: 6px 12px;
                    border: 1px solid var(--border-color, #e5e5e5);
                    border-radius: 6px;
                    background: var(--bg-primary, white);
                    color: var(--text-primary, #1a1a1a);
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .control-button:hover:not(:disabled) {
                    background: var(--bg-secondary, #fafafa);
                    border-color: var(--primary-color, #3b82f6);
                }

                .control-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .interrupt-button {
                    background: var(--error-bg, #fee);
                    color: var(--error-color, #c00);
                    border-color: var(--error-color, #c00);
                }

                .interrupt-button:hover {
                    background: var(--error-hover, #fcc);
                }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                    max-width: 1200px;
                    width: 100%;
                    margin: 0 auto;
                }

                .token-info {
                    padding: 4px 56px;
                    font-size: 11px;
                    color: var(--text-secondary, #666);
                    background: var(--bg-tertiary, #f9f9f9);
                    animation: fadeIn 0.3s ease-in;
                }
                
                .streaming-info {
                    opacity: 0.7;
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @media (max-width: 640px) {
                    .chat-header {
                        padding: 12px;
                    }

                    .chat-title {
                        font-size: 18px;
                    }

                    .chat-messages {
                        padding: 12px;
                    }

                    .session-info {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};