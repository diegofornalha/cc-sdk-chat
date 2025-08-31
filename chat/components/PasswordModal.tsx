'use client';

import React, { useState } from 'react';

interface PasswordModalProps {
    onSuccess: () => void;
}

export function PasswordModal({ onSuccess }: PasswordModalProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Senha simples para teste
        if (password === 'claude') {
            onSuccess();
        } else {
            setError('Senha incorreta');
            setTimeout(() => setError(''), 3000);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Acesso Restrito</h2>
                <p>Digite a senha para entrar</p>
                
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Digite a senha"
                        className="password-input"
                        autoFocus
                    />
                    
                    <button type="submit" className="submit-button">
                        Entrar
                    </button>
                    
                    {error && <p className="error-message">{error}</p>}
                </form>
                
                <p className="hint">Dica: claude</p>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }

                .modal-content {
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    text-align: center;
                    min-width: 320px;
                    animation: slideIn 0.3s ease-out;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                h2 {
                    margin: 0 0 10px 0;
                    color: #333;
                    font-size: 24px;
                }

                p {
                    color: #666;
                    margin: 0 0 20px 0;
                }

                .password-input {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 6px;
                    font-size: 16px;
                    margin-bottom: 20px;
                    transition: border-color 0.3s;
                    box-sizing: border-box;
                }

                .password-input:focus {
                    outline: none;
                    border-color: #4CAF50;
                }

                .submit-button {
                    width: 100%;
                    padding: 12px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    cursor: pointer;
                    transition: background 0.3s;
                }

                .submit-button:hover {
                    background: #45a049;
                }

                .error-message {
                    color: #f44336;
                    margin-top: 10px;
                    font-size: 14px;
                }

                .hint {
                    color: #999;
                    font-size: 12px;
                    margin-top: 20px;
                }
            `}</style>
        </div>
    );
}