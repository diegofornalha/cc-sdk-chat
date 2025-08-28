import { useReducer, useRef, useCallback } from 'react';
import ChatAPI, { ChatMessage, StreamResponse } from '../lib/api';

// Estados da aplicação
interface ChatState {
    messages: ChatMessage[];
    isStreaming: boolean;
    currentStreamContent: string;
    sessionId: string | null;
    tokenInfo: { input?: number; output?: number } | null;
    costInfo: number | null;
}

// Ações possíveis
type ChatAction =
    | { type: 'SET_SESSION'; sessionId: string }
    | { type: 'ADD_MESSAGE'; message: ChatMessage }
    | { type: 'START_STREAMING' }
    | { type: 'UPDATE_STREAM_CONTENT'; content: string }
    | { type: 'APPEND_STREAM_CONTENT'; content: string }
    | { type: 'UPDATE_TOKEN_INFO'; tokens: { input?: number; output?: number } }
    | { type: 'UPDATE_COST_INFO'; cost: number }
    | { type: 'FINISH_STREAMING'; message?: ChatMessage }
    | { type: 'CLEAR_SESSION' }
    | { type: 'INTERRUPT_STREAMING' };

// Reducer para gerenciar estado de forma centralizada
function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case 'SET_SESSION':
            return { ...state, sessionId: action.sessionId };
            
        case 'ADD_MESSAGE':
            return { ...state, messages: [...state.messages, action.message] };
            
        case 'START_STREAMING':
            return {
                ...state,
                isStreaming: true,
                currentStreamContent: '',
                tokenInfo: null,
                costInfo: null
            };
            
        case 'UPDATE_STREAM_CONTENT':
            return { ...state, currentStreamContent: action.content };
            
        case 'APPEND_STREAM_CONTENT':
            return { ...state, currentStreamContent: state.currentStreamContent + action.content };
            
        case 'UPDATE_TOKEN_INFO':
            return { ...state, tokenInfo: action.tokens };
            
        case 'UPDATE_COST_INFO':
            return { ...state, costInfo: action.cost };
            
        case 'FINISH_STREAMING':
            const newState = {
                ...state,
                isStreaming: false,
                currentStreamContent: '',
                tokenInfo: null,
                costInfo: null
            };
            
            if (action.message) {
                newState.messages = [...state.messages, action.message];
            }
            
            return newState;
            
        case 'CLEAR_SESSION':
            return {
                ...state,
                messages: [],
                currentStreamContent: '',
                isStreaming: false,
                tokenInfo: null,
                costInfo: null
            };
            
        case 'INTERRUPT_STREAMING':
            return {
                ...state,
                isStreaming: false
            };
            
        default:
            return state;
    }
}

// Hook customizado para gerenciar chat com streaming
export function useStreamingChat() {
    const [state, dispatch] = useReducer(chatReducer, {
        messages: [],
        isStreaming: false,
        currentStreamContent: '',
        sessionId: null,
        tokenInfo: null,
        costInfo: null
    });
    
    const apiRef = useRef<ChatAPI | null>(null);
    const streamBuffer = useRef<string>('');
    const bufferTimeout = useRef<NodeJS.Timeout | null>(null);
    
    // Inicializa API
    const initializeAPI = useCallback(async () => {
        if (!apiRef.current) {
            apiRef.current = new ChatAPI();
            const sessionId = await apiRef.current.createSession();
            dispatch({ type: 'SET_SESSION', sessionId });
        }
    }, []);
    
    // Processa buffer acumulado
    const flushBuffer = useCallback(() => {
        if (streamBuffer.current) {
            dispatch({ type: 'APPEND_STREAM_CONTENT', content: streamBuffer.current });
            streamBuffer.current = '';
        }
    }, []);
    
    // Envia mensagem com buffering inteligente
    const sendMessage = useCallback(async (message: string) => {
        if (!apiRef.current) return;
        // Removido bloqueio - permite enviar múltiplas mensagens mesmo durante streaming
        
        // Adiciona mensagem do usuário
        const userMessage: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: new Date()
        };
        
        dispatch({ type: 'ADD_MESSAGE', message: userMessage });
        dispatch({ type: 'START_STREAMING' });
        
        streamBuffer.current = '';
        let finalContent = '';
        let finalTokens: { input?: number; output?: number } | null = null;
        let finalCost: number | null = null;
        
        try {
            await apiRef.current.sendMessage(
                message,
                (data: StreamResponse) => {
                    if (data.type === 'assistant_text') {
                        // Acumula no buffer
                        streamBuffer.current += data.content || '';
                        finalContent += data.content || '';
                        
                        // Limpa timeout anterior
                        if (bufferTimeout.current) {
                            clearTimeout(bufferTimeout.current);
                        }
                        
                        // Agenda flush do buffer (debounce de 50ms)
                        bufferTimeout.current = setTimeout(() => {
                            flushBuffer();
                        }, 50);
                        
                    } else if (data.type === 'tool_use') {
                        const toolMsg = `\n📦 Usando ferramenta: ${data.tool}\n`;
                        streamBuffer.current += toolMsg;
                        finalContent += toolMsg;
                        flushBuffer();
                        
                    } else if (data.type === 'result') {
                        if (data.input_tokens !== undefined) {
                            finalTokens = {
                                input: data.input_tokens,
                                output: data.output_tokens
                            };
                            dispatch({ type: 'UPDATE_TOKEN_INFO', tokens: finalTokens });
                        }
                        if (data.cost_usd !== undefined) {
                            finalCost = data.cost_usd;
                            dispatch({ type: 'UPDATE_COST_INFO', cost: finalCost });
                        }
                    }
                },
                (error: string) => {
                    const errorMsg = `\n❌ Erro: ${error}`;
                    streamBuffer.current += errorMsg;
                    finalContent += errorMsg;
                    flushBuffer();
                },
                () => {
                    // Flush final do buffer
                    flushBuffer();
                    
                    // Adiciona mensagem final
                    if (finalContent) {
                        const assistantMessage: ChatMessage = {
                            role: 'assistant',
                            content: finalContent,
                            timestamp: new Date(),
                            tokens: finalTokens || undefined,
                            cost: finalCost || undefined
                        };
                        
                        dispatch({ type: 'FINISH_STREAMING', message: assistantMessage });
                    } else {
                        dispatch({ type: 'FINISH_STREAMING' });
                    }
                }
            );
        } catch (error) {
            console.error('Error sending message:', error);
            dispatch({ type: 'FINISH_STREAMING' });
        }
    }, [flushBuffer]); // Removido state.isStreaming da dependência
    
    // Limpa sessão
    const clearSession = useCallback(async () => {
        if (!apiRef.current) return; // Permite limpar a qualquer momento
        
        try {
            await apiRef.current.clearSession();
            dispatch({ type: 'CLEAR_SESSION' });
        } catch (error) {
            console.error('Error clearing session:', error);
        }
    }, []); // Removido state.isStreaming - permite limpar a qualquer momento
    
    // Interrompe streaming
    const interruptStreaming = useCallback(async () => {
        if (!apiRef.current || !state.isStreaming) return;
        
        try {
            await apiRef.current.interruptSession();
            
            // Salva conteúdo parcial
            flushBuffer();
            if (state.currentStreamContent) {
                const partialMessage: ChatMessage = {
                    role: 'assistant',
                    content: state.currentStreamContent + '\n\n[Interrompido]',
                    timestamp: new Date()
                };
                dispatch({ type: 'FINISH_STREAMING', message: partialMessage });
            } else {
                dispatch({ type: 'INTERRUPT_STREAMING' });
            }
        } catch (error) {
            console.error('Error interrupting session:', error);
        }
    }, [state.isStreaming, state.currentStreamContent, flushBuffer]);
    
    // Cleanup
    const cleanup = useCallback(async () => {
        if (apiRef.current && state.sessionId) {
            try {
                await apiRef.current.deleteSession();
            } catch (error) {
                console.error('Error deleting session:', error);
            }
            apiRef.current = null;
        }
    }, [state.sessionId]);
    
    return {
        // Estado
        ...state,
        
        // Ações
        initializeAPI,
        sendMessage,
        clearSession,
        interruptStreaming,
        cleanup
    };
}