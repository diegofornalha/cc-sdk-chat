import React, { useEffect, useRef } from 'react';
import { StreamingMarkdownRenderer } from '../StreamingMarkdownRenderer';

interface StreamingMessageProps {
    content: string;
    isStreaming?: boolean;
    role: 'user' | 'assistant';
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
    content,
    isStreaming = false,
    role
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<StreamingMarkdownRenderer | null>(null);
    const lastContentRef = useRef<string>('');
    const userContainerRef = useRef<HTMLDivElement>(null);
    const userAnimationRef = useRef<number | null>(null);

    useEffect(() => {
        // Streaming para mensagens do assistant (Claude)
        if (containerRef.current && content && role === 'assistant') {
            // Cria renderer se não existir
            if (!rendererRef.current) {
                const containerId = `message-${Date.now()}-${Math.random()}`;
                containerRef.current.id = containerId;
                rendererRef.current = new StreamingMarkdownRenderer(containerId);
            }

            // Se o conteúdo mudou, renderiza incrementalmente
            if (content !== lastContentRef.current && rendererRef.current) {
                const newContent = content.slice(lastContentRef.current.length);
                if (newContent) {
                    if (isStreaming) {
                        // Durante o streaming, adiciona por chunks otimizados
                        // Usa o método streamByChunks que é mais eficiente
                        const renderer = rendererRef.current as any;
                        if (renderer.streamByChunks) {
                            renderer.streamByChunks(newContent, 50, 10)
                                .then(() => {
                                    lastContentRef.current = content;
                                })
                                .catch((err: any) => console.error('Streaming error:', err));
                        } else {
                            // Fallback para appendMarkdown se streamByChunks não existir
                            renderer.appendMarkdown(newContent);
                            lastContentRef.current = content;
                        }
                    } else {
                        // Mensagem completa, adiciona tudo de uma vez
                        rendererRef.current.appendMarkdown(newContent);
                        lastContentRef.current = content;
                    }
                }
            }
        }
        
        // Streaming para mensagens do usuário com efeito de digitação
        if (userContainerRef.current && content && role === 'user') {
            // Cancela animação anterior se existir
            if (userAnimationRef.current) {
                cancelAnimationFrame(userAnimationRef.current);
            }
            
            let index = 0;
            const text = content;
            userContainerRef.current.textContent = '';
            
            const typeWriter = () => {
                if (index < text.length && userContainerRef.current) {
                    userContainerRef.current.textContent += text.charAt(index);
                    index++;
                    userAnimationRef.current = requestAnimationFrame(() => {
                        setTimeout(typeWriter, 20); // Velocidade de digitação (20ms por caractere)
                    });
                }
            };
            
            // Inicia o efeito de digitação
            typeWriter();
        }
        
        // Cleanup
        return () => {
            if (userAnimationRef.current) {
                cancelAnimationFrame(userAnimationRef.current);
            }
        };
    }, [content, role, isStreaming]);

    return (
        <div className={`message message-${role}`}>
            <div className="message-avatar">
                {role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
                {role === 'user' ? (
                    <div ref={userContainerRef} className="user-message"></div>
                ) : (
                    <div ref={containerRef} className="assistant-message notion-content" />
                )}
                {isStreaming && role === 'assistant' && (
                    <span className="streaming-indicator">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                    </span>
                )}
            </div>
            <style jsx>{`
                .message {
                    display: flex;
                    gap: 12px;
                    padding: 16px;
                    animation: fadeIn 0.3s ease-in;
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .message-user {
                    background: var(--bg-secondary, #f5f5f5);
                }

                .message-assistant {
                    background: var(--bg-primary, white);
                }

                .message-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    background: var(--avatar-bg, #e5e5e5);
                    flex-shrink: 0;
                }

                .message-content {
                    flex: 1;
                    max-width: 100%;
                }

                .user-message {
                    font-size: 14px;
                    line-height: 1.6;
                    color: var(--text-primary, #1a1a1a);
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    min-height: 24px;
                }

                .assistant-message {
                    font-size: 14px;
                    line-height: 1.6;
                    color: var(--text-primary, #1a1a1a);
                }

                .streaming-indicator {
                    display: inline-flex;
                    gap: 4px;
                    margin-left: 8px;
                    vertical-align: middle;
                }

                .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--primary-color, #3b82f6);
                    animation: pulse 1.4s infinite ease-in-out both;
                }

                .dot:nth-child(1) {
                    animation-delay: -0.32s;
                }

                .dot:nth-child(2) {
                    animation-delay: -0.16s;
                }

                @keyframes pulse {
                    0%, 60%, 100% {
                        transform: scale(0.8);
                        opacity: 0.5;
                    }
                    30% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @media (max-width: 640px) {
                    .message {
                        padding: 12px;
                    }

                    .message-avatar {
                        width: 28px;
                        height: 28px;
                        font-size: 16px;
                    }
                }
            `}</style>
        </div>
    );
};