/**
 * Cliente API aprimorado com autenticação e gerenciamento de sessão
 * Usa os novos endpoints do backend ao invés de lógica local
 */

import { config } from './config';

export interface SessionResponse {
  session_id: string;
  created_at: string;
}

export interface SessionMetrics {
  total_messages: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
  average_response_time: number;
  cache_hit_rate: number;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
  component: string;
  session_id?: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

class EnhancedChatAPI {
  private baseUrl: string;
  private sessionId: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.getApiUrl();
    this.loadStoredSession();
  }

  /**
   * Carrega sessão armazenada (se existir)
   */
  private loadStoredSession() {
    if (typeof window !== 'undefined') {
      const storedSession = localStorage.getItem('session_id');
      
      if (storedSession) {
        this.sessionId = storedSession;
        console.log('📦 Sessão restaurada');
      }
    }
  }

  /**
   * Cria nova sessão no servidor
   * Remove lógica de UUID fixo do frontend
   */
  async createSession(projectPath?: string, metadata?: Record<string, any>): Promise<SessionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: this.getUserId(),
          project_path: projectPath,
          metadata: metadata || {}
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao criar sessão: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Salvar sessão
      this.sessionId = data.session_id;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('session_id', data.session_id);
      }

      // Registrar log no servidor
      await this.sendLog({
        level: 'info',
        message: 'Nova sessão criada',
        component: 'frontend',
        session_id: data.session_id,
        metadata: { project_path: projectPath }
      });

      console.log('✅ Sessão criada:', data.session_id);
      return data;
    } catch (error) {
      console.error('❌ Erro ao criar sessão:', error);
      throw error;
    }
  }

  /**
   * Valida se sessão atual ainda é válida
   */
  async validateSession(): Promise<boolean> {
    if (!this.sessionId) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: this.sessionId })
      });

      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      console.error('❌ Erro ao validar sessão:', error);
      return false;
    }
  }

  /**
   * Obtém métricas da sessão do servidor
   * Não calcula localmente
   */
  async getSessionMetrics(): Promise<SessionMetrics | null> {
    if (!this.sessionId) {
      console.warn('⚠️ Sem sessão para obter métricas');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${this.sessionId}/metrics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao obter métricas: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao obter métricas:', error);
      return null;
    }
  }

  /**
   * Obtém histórico da sessão do servidor
   */
  async getSessionHistory() {
    if (!this.sessionId) {
      console.warn('⚠️ Sem sessão para obter histórico');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${this.sessionId}/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao obter histórico: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao obter histórico:', error);
      return null;
    }
  }

  /**
   * Envia log para o servidor
   * Substitui localStorage
   */
  async sendLog(entry: LogEntry): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/logs/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      // Falha silenciosa para não interromper fluxo
      console.error('❌ Erro ao enviar log:', error);
    }
  }

  /**
   * Busca logs do servidor
   */
  async searchLogs(filters: {
    level?: string;
    component?: string;
    session_id?: string;
    limit?: number;
  }) {
    try {
      const response = await fetch(`${this.baseUrl}/api/logs/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filters)
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar logs: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao buscar logs:', error);
      return { logs: [] };
    }
  }

  /**
   * Obtém estatísticas de logs
   */
  async getLogStats(hours: number = 24) {
    try {
      const response = await fetch(`${this.baseUrl}/api/logs/stats?hours=${hours}`, {
        method: 'GET',
        headers: {
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao obter estatísticas: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }

  /**
   * Envia mensagem com autenticação
   */
  async sendMessage(
    message: string,
    onStream: (data: any) => void,
    onError?: (error: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    // Validar sessão primeiro
    const isValid = await this.validateSession();
    if (!isValid) {
      console.log('🔄 Sessão inválida, criando nova...');
      await this.createSession();
    }

    // Iniciar timer de métrica
    const timerId = await this.startMetricTimer('chat_message', this.sessionId || undefined);
    
    // Incrementar contador de mensagens
    await this.incrementMetric('total_messages');

    // Log de início
    await this.sendLog({
      level: 'info',
      message: `Enviando mensagem: ${message.substring(0, 50)}...`,
      component: 'chat',
      session_id: this.sessionId || undefined
    });

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message,
          session_id: this.sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Processar streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Streaming não disponível');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onStream(data);

              // Atualizar métricas no servidor
              if (data.type === 'result' && data.input_tokens) {
                await this.updateServerMetrics(
                  data.input_tokens,
                  data.output_tokens || 0,
                  data.cost_usd || 0,
                  Date.now() - startTime
                );
              }
            } catch (e) {
              console.error('Erro ao processar chunk:', e);
            }
          }
        }
      }

      // Finalizar timer de métrica
      const duration = await this.endMetricTimer(timerId!);
      
      // Incrementar contador de sucessos
      await this.incrementMetric('successful_responses');

      // Log de conclusão
      await this.sendLog({
        level: 'info',
        message: 'Resposta concluída',
        component: 'chat',
        session_id: this.sessionId || undefined,
        metadata: { duration_ms: Date.now() - startTime }
      });

      if (onComplete) onComplete();
    } catch (error: any) {
      // Finalizar timer mesmo em caso de erro
      await this.endMetricTimer(timerId!);
      
      // Incrementar contador de erros
      await this.incrementMetric('error_responses');
      
      // Log de erro
      await this.sendLog({
        level: 'error',
        message: error.message,
        component: 'chat',
        session_id: this.sessionId || undefined,
        metadata: { error: error.toString() }
      });

      if (onError) onError(error.message);
    }
  }

  /**
   * Atualiza métricas no servidor
   */
  private async updateServerMetrics(
    tokensInput: number,
    tokensOutput: number,
    costUsd: number,
    responseTime: number
  ) {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/sessions/${this.sessionId}/update-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          cost_usd: costUsd,
          response_time: responseTime / 1000, // converter para segundos
          session_id: this.sessionId
        })
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar métricas:', error);
    }
  }

  /**
   * Limpa sessão no servidor
   */
  async clearSession() {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/sessions/${this.sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Limpar local
      this.sessionId = null;
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('session_id');
      }

      console.log('🧹 Sessão limpa');
    } catch (error) {
      console.error('❌ Erro ao limpar sessão:', error);
    }
  }

  /**
   * Obtém ID do usuário (pode ser melhorado com auth real)
   */
  private getUserId(): string {
    if (typeof window !== 'undefined') {
      let userId = localStorage.getItem('user_id');
      if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('user_id', userId);
      }
      return userId;
    }
    return 'anonymous';
  }

  /**
   * Obtém todas as sessões do usuário
   */
  async getUserSessions() {
    const userId = this.getUserId();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/user/${userId}/sessions`, {
        method: 'GET',
        headers: {
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao obter sessões: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao obter sessões:', error);
      return { sessions: [] };
    }
  }

  /**
   * Inicia um timer de métrica
   */
  async startMetricTimer(operation: string, sessionId?: string) {
    try {
      const response = await fetch(`${this.baseUrl}/api/metrics/timer/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation,
          session_id: sessionId || this.sessionId || 'global'
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao iniciar timer: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('⏱️ Timer iniciado:', data.timer_id);
      return data.timer_id;
    } catch (error) {
      console.error('❌ Erro ao iniciar timer:', error);
      return null;
    }
  }

  /**
   * Finaliza um timer de métrica
   */
  async endMetricTimer(timerId: string) {
    if (!timerId) return null;

    try {
      const response = await fetch(`${this.baseUrl}/api/metrics/timer/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timer_id: timerId })
      });

      if (!response.ok) {
        throw new Error(`Erro ao finalizar timer: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('⏱️ Timer finalizado:', data.duration_ms, 'ms');
      return data.duration_ms;
    } catch (error) {
      console.error('❌ Erro ao finalizar timer:', error);
      return null;
    }
  }

  /**
   * Incrementa contador de métrica
   */
  async incrementMetric(metric: string, value: number = 1) {
    try {
      await fetch(`${this.baseUrl}/api/metrics/increment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metric, value })
      });
      console.log('📊 Métrica incrementada:', metric, '+', value);
    } catch (error) {
      console.error('❌ Erro ao incrementar métrica:', error);
    }
  }

  /**
   * Obtém estatísticas de operação
   */
  async getOperationStats(operation: string, sessionId?: string) {
    try {
      const url = sessionId 
        ? `${this.baseUrl}/api/metrics/stats/${operation}?session_id=${sessionId}`
        : `${this.baseUrl}/api/metrics/stats/${operation}`;
        
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao obter estatísticas: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }

  /**
   * Obtém resumo de métricas
   */
  async getMetricsSummary() {
    try {
      const response = await fetch(`${this.baseUrl}/api/metrics/summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao obter resumo: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao obter resumo de métricas:', error);
      return null;
    }
  }
}

// Exportar instância singleton
export const enhancedAPI = new EnhancedChatAPI();

// Exportar classe para testes
export default EnhancedChatAPI;