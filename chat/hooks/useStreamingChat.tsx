import { useReducer, useRef, useCallback, useEffect } from 'react';
import ChatAPI, { ChatMessage, StreamResponse } from '../lib/api';

// Estados da aplicação
interface ChatState {
    messages: ChatMessage[];
    isStreaming: boolean;
    currentStreamContent: string;
    sessionId: string | null;
    tokenInfo: { input?: number; output?: number } | null;
    costInfo: number | null;
    isProcessing: boolean;
    typingQueue: string[];
    isTyping: boolean;
}

// Ações possíveis
type ChatAction =
    | { type: 'SET_SESSION'; sessionId: string }
    | { type: 'ADD_MESSAGE'; message: ChatMessage }
    | { type: 'START_STREAMING' }
    | { type: 'START_PROCESSING' }
    | { type: 'STOP_PROCESSING' }
    | { type: 'UPDATE_STREAM_CONTENT'; content: string }
    | { type: 'APPEND_STREAM_CONTENT'; content: string }
    | { type: 'ADD_TO_TYPING_QUEUE'; content: string }
    | { type: 'START_TYPING' }
    | { type: 'STOP_TYPING' }
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
                costInfo: null,
                typingQueue: [],
                isTyping: false
            };
            
        case 'START_PROCESSING':
            return { ...state, isProcessing: true };
            
        case 'STOP_PROCESSING':
            return { ...state, isProcessing: false };
            
        case 'ADD_TO_TYPING_QUEUE':
            return {
                ...state,
                typingQueue: [...state.typingQueue, action.content]
            };
            
        case 'START_TYPING':
            return { ...state, isTyping: true };
            
        case 'STOP_TYPING':
            return { ...state, isTyping: false };
            
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
                costInfo: null,
                isProcessing: false,
                typingQueue: [],
                isTyping: false
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
                costInfo: null,
                isProcessing: false,
                typingQueue: [],
                isTyping: false
            };
            
        case 'INTERRUPT_STREAMING':
            return {
                ...state,
                isStreaming: false,
                isProcessing: false,
                isTyping: false,
                typingQueue: []
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
        costInfo: null,
        isProcessing: false,
        typingQueue: [],
        isTyping: false
    });
    
    const apiRef = useRef<ChatAPI | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const typingQueueRef = useRef<string[]>([]);
    
    // Inicializa API
    const initializeAPI = useCallback(async () => {
        if (!apiRef.current) {
            apiRef.current = new ChatAPI();
        }
    }, []);

    // Hook de efeito de digitação
    const processTypingQueue = useCallback(() => {
        if (typingQueueRef.current.length === 0) {
            dispatch({ type: 'STOP_TYPING' });
            return;
        }

        dispatch({ type: 'START_TYPING' });
        const chunk = typingQueueRef.current.shift()!;
        const words = chunk.split(/(\s+)/);
        
        let wordIndex = 0;
        
        const typeNextWord = () => {
            if (wordIndex >= words.length) {
                // Terminou este chunk, processa próximo
                processTypingQueue();
                return;
            }

            const word = words[wordIndex];
            dispatch({ type: 'APPEND_STREAM_CONTENT', content: word });
            wordIndex++;

            // Calcula delay baseado no tipo de palavra
            let delay = Math.random() * 40 + 80; // 80-120ms base
            
            // Palavras técnicas/longas têm delay maior
            if (word.length > 8 || /[{}()\[\]<>]/.test(word)) {
                delay += 50;
            }
            
            // Pontuação tem pausa maior
            if (/[.!?:;]/.test(word)) {
                delay += 200;
            }
            
            // Espaços em branco são processados mais rapidamente
            if (/^\s+$/.test(word)) {
                delay = 20; // Espaços são "digitados" muito rapidamente
            }
            
            // Code blocks têm ritmo diferente
            if (word.includes('```') || word.includes('`')) {
                delay += 100; // Pausa antes/depois de code blocks
            }

            typingTimeoutRef.current = setTimeout(typeNextWord, delay);
        };

        typeNextWord();
    }, []);

    // Adiciona chunk à fila de digitação
    const addToTypingQueue = useCallback((content: string) => {
        typingQueueRef.current.push(content);
        
        // Se não está digitando, inicia processo
        if (!state.isTyping && typingQueueRef.current.length === 1) {
            processTypingQueue();
        }
    }, [state.isTyping, processTypingQueue]);

    // Limpa fila de digitação (para interrupções)
    const clearTypingQueue = useCallback(() => {
        typingQueueRef.current = [];
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        dispatch({ type: 'STOP_TYPING' });
    }, []);
    
    
    // Envia mensagem com streaming e efeito de digitação
    const sendMessage = useCallback(async (message: string) => {
        if (!apiRef.current) return;
        
        // Limpa qualquer digitação em andamento
        clearTypingQueue();
        
        // Adiciona mensagem do usuário
        const userMessage: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: new Date()
        };
        
        dispatch({ type: 'ADD_MESSAGE', message: userMessage });
        dispatch({ type: 'START_STREAMING' });
        dispatch({ type: 'START_PROCESSING' });
        
        let finalContent = '';
        let finalTokens: { input?: number; output?: number } | null = null;
        let finalCost: number | null = null;
        let isFirstTextChunk = true;
        
        try {
            await apiRef.current.sendMessage(
                message,
                (data: StreamResponse) => {
                    if (data.type === 'session_migrated') {
                        console.log(`✅ Session ID: ${data.session_id}`);
                        dispatch({ type: 'SET_SESSION', sessionId: data.session_id });
                        
                    } else if (data.type === 'processing') {
                        // Mantém indicador "Processando..." ativo
                        dispatch({ type: 'START_PROCESSING' });
                        
                    } else if (data.type === 'text_chunk') {
                        // Para o indicador "Processando..." no primeiro chunk de texto
                        if (isFirstTextChunk) {
                            dispatch({ type: 'STOP_PROCESSING' });
                            isFirstTextChunk = false;
                        }
                        
                        // Adiciona à fila de digitação em vez de mostrar direto
                        if (data.content) {
                            addToTypingQueue(data.content);
                            finalContent += data.content;
                        }
                        
                    } else if (data.type === 'tool_use') {
                        const toolMsg = `\n📦 Usando ferramenta: ${data.tool}\n`;
                        addToTypingQueue(toolMsg);
                        finalContent += toolMsg;
                        
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
                    dispatch({ type: 'STOP_PROCESSING' });
                    const errorMsg = `\n❌ Erro: ${error}`;
                    addToTypingQueue(errorMsg);
                    finalContent += errorMsg;
                },
                () => {
                    dispatch({ type: 'STOP_PROCESSING' });
                    
                    // Aguarda digitação terminar antes de finalizar
                    const waitForTypingToFinish = () => {
                        if (state.isTyping || typingQueueRef.current.length > 0) {
                            setTimeout(waitForTypingToFinish, 100);
                            return;
                        }
                        
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
                    };
                    
                    waitForTypingToFinish();
                }
            );
        } catch (error) {
            console.error('Error sending message:', error);
            dispatch({ type: 'STOP_PROCESSING' });
            clearTypingQueue();
            dispatch({ type: 'FINISH_STREAMING' });
        }
    }, [clearTypingQueue, addToTypingQueue, state.isTyping]);
    
    // Limpa sessão
    const clearSession = useCallback(async () => {
        if (!apiRef.current) return; // Permite limpar a qualquer momento
        
        // Limpa fila de digitação
        clearTypingQueue();
        
        try {
            await apiRef.current.clearSession();
            dispatch({ type: 'CLEAR_SESSION' });
        } catch (error) {
            console.error('Error clearing session:', error);
        }
    }, [clearTypingQueue]);
    
    // Interrompe streaming
    const interruptStreaming = useCallback(async () => {
        if (!apiRef.current || !state.isStreaming) return;
        
        // Limpa fila de digitação imediatamente
        clearTypingQueue();
        
        try {
            await apiRef.current.interruptSession();
            
            // Salva conteúdo parcial
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
    }, [state.isStreaming, state.currentStreamContent, clearTypingQueue]);
    
    // Cleanup
    const cleanup = useCallback(async () => {
        // Limpa fila de digitação
        clearTypingQueue();
        
        if (apiRef.current && state.sessionId) {
            try {
                await apiRef.current.deleteSession();
            } catch (error) {
                console.error('Error deleting session:', error);
            }
            apiRef.current = null;
        }
    }, [state.sessionId, clearTypingQueue]);

    // Cleanup automático na desmontagem
    useEffect(() => {
        return () => {
            clearTypingQueue();
        };
    }, [clearTypingQueue]);
    
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