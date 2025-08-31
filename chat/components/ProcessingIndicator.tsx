import React from 'react';

interface ProcessingIndicatorProps {
    message?: string;
    className?: string;
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
    message = 'Processando Resposta',
    className = ''
}) => {
    return (
        <div className={`processing-indicator ${className}`}>
            <div className="processing-content">
                <span className="processing-text">{message}</span>
                <div className="processing-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                </div>
            </div>
            <style jsx>{`
                .processing-indicator {
                    display: flex;
                    align-items: center;
                    padding: 16px 0;
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

                .processing-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 16px;
                    background: var(--bg-processing, #f8f9fa);
                    border: 1px solid var(--border-processing, #e3e6ea);
                    border-radius: 12px;
                    color: var(--text-processing, #6c757d);
                    font-size: 14px;
                    font-style: italic;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }

                .processing-text {
                    font-weight: 500;
                }

                .processing-dots {
                    display: inline-flex;
                    gap: 3px;
                    align-items: center;
                }

                .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--primary-color-light, #74a9f7);
                    animation: processingPulse 1.4s infinite ease-in-out both;
                }

                .dot:nth-child(1) {
                    animation-delay: -0.32s;
                }

                .dot:nth-child(2) {
                    animation-delay: -0.16s;
                }

                .dot:nth-child(3) {
                    animation-delay: 0s;
                }

                @keyframes processingPulse {
                    0%, 80%, 100% {
                        transform: scale(0.6);
                        opacity: 0.4;
                    }
                    40% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                /* Tema escuro */
                @media (prefers-color-scheme: dark) {
                    .processing-content {
                        background: var(--bg-processing-dark, #2d3748);
                        border-color: var(--border-processing-dark, #4a5568);
                        color: var(--text-processing-dark, #a0aec0);
                    }

                    .dot {
                        background: var(--primary-color-dark, #63b3ed);
                    }
                }

                /* Responsivo */
                @media (max-width: 640px) {
                    .processing-content {
                        padding: 10px 14px;
                        font-size: 13px;
                    }

                    .dot {
                        width: 5px;
                        height: 5px;
                    }
                }
            `}</style>
        </div>
    );
};