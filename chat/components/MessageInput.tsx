import React, { useState, useRef, KeyboardEvent } from 'react';

interface MessageInputProps {
    onSendMessage: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
    onSendMessage,
    disabled = false,
    placeholder = "Digite sua mensagem e pressione Enter..."
}) => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
        if (message.trim() && !disabled) {
            onSendMessage(message.trim());
            setMessage('');
            
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        
        // Auto-resize textarea
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    };

    return (
        <div className="message-input-container">
            <div className="message-input-wrapper">
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="message-input"
                    rows={1}
                />
                <button
                    onClick={handleSubmit}
                    disabled={disabled || !message.trim()}
                    className="send-button"
                    aria-label="Send message"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="send-icon"
                    >
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </button>
            </div>
            <div className="input-hint">
                <span>Pressione Enter para enviar, Shift+Enter para nova linha</span>
            </div>
            <style jsx>{`
                .message-input-container {
                    border-top: 1px solid var(--border-color, #e5e5e5);
                    padding: 16px;
                    background: var(--bg-secondary, #fafafa);
                }

                .message-input-wrapper {
                    display: flex;
                    align-items: flex-end;
                    gap: 12px;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .message-input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 1px solid var(--border-color, #e5e5e5);
                    border-radius: 8px;
                    font-size: 14px;
                    font-family: inherit;
                    resize: none;
                    outline: none;
                    background: var(--bg-primary, white);
                    color: var(--text-primary, #1a1a1a);
                    line-height: 1.5;
                    min-height: 44px;
                    max-height: 200px;
                    transition: border-color 0.2s;
                }

                .message-input:focus {
                    border-color: var(--primary-color, #3b82f6);
                }

                .message-input:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .send-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 44px;
                    height: 44px;
                    border: none;
                    border-radius: 8px;
                    background: var(--primary-color, #3b82f6);
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .send-button:hover:not(:disabled) {
                    background: var(--primary-hover, #2563eb);
                    transform: scale(1.05);
                }

                .send-button:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                .send-icon {
                    width: 20px;
                    height: 20px;
                }

                .input-hint {
                    margin-top: 8px;
                    font-size: 12px;
                    color: var(--text-secondary, #666);
                    text-align: center;
                }

                @media (max-width: 640px) {
                    .message-input-container {
                        padding: 12px;
                    }

                    .message-input {
                        font-size: 16px; /* Prevent zoom on iOS */
                    }
                }
            `}</style>
        </div>
    );
};