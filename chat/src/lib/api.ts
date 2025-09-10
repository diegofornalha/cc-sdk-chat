/**
 * Cliente API para comunicação com o backend
 */

import { config } from './config';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  tokens?: {
    input?: number;
    output?: number;
  };
  cost?: number;
}

export interface StreamResponse {
  type: 'text_chunk' | 'assistant_text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'done' | 'processing' | 'session_migrated';
  content?: string;
  tool?: string;
  id?: string;
  tool_id?: string;
  session_id: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  error?: string;
}

class ChatAPI {
  private baseUrl: string;
  private sessionId: string;
  // ID fixo para manter histórico unificado (UUID válido especial)
  private readonly UNIFIED_SESSION_ID = '00000000-0000-0000-0000-000000000001';
  private readonly USE_UNIFIED_SESSION = true; // Controle para usar sessão unificada

  constructor(baseUrl?: string) {
    // Usa a configuração centralizada
    this.baseUrl = baseUrl || config.getApiUrl();
    
    // SEMPRE usa sessão unificada com ID fixo
    if (this.USE_UNIFIED_SESSION) {
      // Usa ID fixo para manter todo histórico em um único arquivo
      this.sessionId = this.UNIFIED_SESSION_ID;
      console.log('📝 Usando Session ID Unificado:', this.sessionId);
      console.log('💾 Todas as conversas serão salvas no mesmo arquivo JSONL');
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('current_session_id', this.sessionId);
      }
    } else {
      // Modo dinâmico - cada sessão tem seu próprio arquivo
      if (typeof window !== 'undefined') {
        const storedSessionId = localStorage.getItem('current_session_id');
        if (storedSessionId && storedSessionId !== this.UNIFIED_SESSION_ID) {
          this.sessionId = storedSessionId;
          console.log('📂 Recuperando Session ID:', this.sessionId);
        } else {
          this.sessionId = this.generateSessionId();
          localStorage.setItem('current_session_id', this.sessionId);
          console.log('🆕 Novo Session ID gerado:', this.sessionId);
        }
      } else {
        this.sessionId = this.generateSessionId();
      }
    }
    
    // Debug em desenvolvimento
    if (config.isDevelopment()) {
      console.log('🔌 API configurada para:', this.baseUrl);
    }
  }

  private generateSessionId(): string {
    // Gera um UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Método para definir sessionId
  setSessionId(sessionId: string | null) {
    // Se está usando sessão unificada, NÃO muda o ID
    if (this.USE_UNIFIED_SESSION) {
      console.log('⚠️ Modo de sessão unificada ativo. Session ID mantido:', this.UNIFIED_SESSION_ID);
      return;
    }
    
    // Só aceita mudanças se não está em modo unificado
    if (sessionId && sessionId !== this.sessionId) {
      this.sessionId = sessionId;
      console.log('✅ Session ID atualizado para:', this.sessionId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('current_session_id', this.sessionId);
      }
    }
  }

  // Método para obter sessionId atual
  getSessionId(): string {
    return this.sessionId;
  }

  // Polling em tempo real para buscar mensagens do JSONL
  startRealtimePolling(
    projectName: string,
    onNewMessage: (message: any) => void
  ): () => void {
    let lastAssistantTimestamp: string | null = null;
    let polling = true;
    let pollStartTime = Date.now();
    
    const poll = async () => {
      if (!polling) return;
      
      try {
        const response = await fetch(`${this.baseUrl}/api/realtime/latest/${projectName}?limit=10`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.messages && data.messages.length > 0) {
            // Pega apenas mensagens do assistant
            const assistantMessages = data.messages.filter((msg: any) => msg.role === 'assistant');
            
            if (assistantMessages.length > 0) {
              // Pega a última mensagem do assistant
              const lastAssistant = assistantMessages[assistantMessages.length - 1];
              
              // Só processa se:
              // 1. É uma mensagem nova (timestamp diferente)
              // 2. A mensagem foi criada DEPOIS que começamos o polling
              const messageTime = new Date(lastAssistant.timestamp).getTime();
              
              if (lastAssistant.timestamp !== lastAssistantTimestamp && messageTime > pollStartTime) {
                console.log('🆕 Nova resposta do assistant:', lastAssistant.content.substring(0, 50));
                lastAssistantTimestamp = lastAssistant.timestamp;
                onNewMessage(lastAssistant);
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro no polling:', error);
      }
      
      // Continua polling a cada 300ms
      if (polling) {
        setTimeout(poll, 300);
      }
    };
    
    // Inicia o polling
    poll();
    
    // Retorna função para parar o polling
    return () => {
      polling = false;
    };
  }

  async sendMessage(
    message: string,
    onStream: (data: StreamResponse) => void,
    onError?: (error: string) => void,
    onComplete?: () => void,
    sessionId?: string // Parâmetro opcional para forçar sessionId
  ): Promise<void> {
    // Se sessionId foi passado, usa ele
    if (sessionId) {
      this.setSessionId(sessionId);
    }
    // Debug log
    console.log('📤 Enviando mensagem:', {
      message: message.substring(0, 100),
      sessionId: this.sessionId,
      url: `${this.baseUrl}/api/chat`,
      timestamp: new Date().toISOString()
    });

    const requestBody = {
      message,
      session_id: this.sessionId,
    };

    console.log('📦 Request body:', requestBody);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Response status:', response.status, response.statusText);

    if (!response.ok) {
      console.error('❌ Erro na resposta:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error('Failed to send message');
    }

    // Processa stream SSE
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error('No response body');
    }

    let buffer = '';
    let completeCalled = false;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Só chama onComplete se ainda não foi chamado
        if (onComplete && !completeCalled) {
          completeCalled = true;
          onComplete();
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr.trim()) {
            try {
              const data = JSON.parse(dataStr) as StreamResponse;
              
              console.log('📨 SSE data received:', {
                type: data.type,
                sessionId: data.session_id,
                content: data.content ? data.content.substring(0, 50) : undefined,
                timestamp: new Date().toISOString()
              });
              
              // Atualiza sessionId se necessário
              if (data.session_id && data.session_id !== this.sessionId) {
                console.log('🔄 Servidor retornou sessionId diferente:', data.session_id);
                console.log('📌 Session ID atual:', this.sessionId);
              }
              
              if (data.type === 'error' && onError) {
                console.error('❌ Erro no stream:', data.error);
                onError(data.error || 'Unknown error');
              } else if (data.type === 'done') {
                console.log('✅ Stream completo');
                // Marca como completo e chama callback
                if (onComplete && !completeCalled) {
                  completeCalled = true;
                  onComplete();
                }
                // Não precisa processar mais após 'done'
                return;
              } else {
                onStream(data);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e, 'Raw data:', dataStr);
            }
          }
        }
      }
    }
  }

  async interruptSession(): Promise<void> {
    if (!this.sessionId) return;

    const response = await fetch(`${this.baseUrl}/api/interrupt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: this.sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to interrupt session');
    }
  }

  async clearSession(): Promise<void> {
    if (!this.sessionId) return;

    const response = await fetch(`${this.baseUrl}/api/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: this.sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to clear session');
    }
  }

  async deleteSession(): Promise<void> {
    if (!this.sessionId) return;

    const response = await fetch(`${this.baseUrl}/api/session/${this.sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }

    this.sessionId = this.UNIFIED_SESSION_ID;
  }
}

export default ChatAPI;