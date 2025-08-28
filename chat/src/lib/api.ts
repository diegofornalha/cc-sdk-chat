/**
 * Cliente API para comunicação com o backend
 */

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
  type: 'assistant_text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'done' | 'processing';
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
  private sessionId: string | null = null;
  private eventSource: EventSource | null = null;

  constructor(baseUrl?: string) {
    // Detecta automaticamente a URL baseado no ambiente
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (typeof window !== 'undefined') {
      // No browser, usa a mesma origem ou localhost para desenvolvimento
      const host = window.location.hostname;
      if (host === 'chat.agentesintegrados.com') {
        // Em produção, usa a mesma origem (Caddy fará o proxy)
        this.baseUrl = '';
      } else {
        // Em desenvolvimento, usa localhost
        this.baseUrl = 'http://localhost:8002';
      }
    } else {
      // SSR ou ambiente Node.js
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';
    }
  }

  async createSession(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/new-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    const data = await response.json();
    this.sessionId = data.session_id;
    return data.session_id;
  }

  async createSessionWithConfig(config: any): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/session-with-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error('Failed to create session with config');
    }

    const data = await response.json();
    this.sessionId = data.session_id;
    return data.session_id;
  }

  async sendMessage(
    message: string,
    onStream: (data: StreamResponse) => void,
    onError?: (error: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!this.sessionId) {
      this.sessionId = await this.createSession();
    }

    // Fecha EventSource anterior se existir
    if (this.eventSource) {
      this.eventSource.close();
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        session_id: this.sessionId,
      }),
    });

    if (!response.ok) {
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
              
              if (data.type === 'error' && onError) {
                onError(data.error || 'Unknown error');
              } else if (data.type === 'done') {
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
              console.error('Failed to parse SSE data:', e);
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

    this.sessionId = null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

export default ChatAPI;