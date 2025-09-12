/**
 * Cliente JavaScript para interação remota com Claude Code SDK
 * Compatível com navegadores modernos e Node.js
 * 
 * @example
 * const client = new ClaudeRemoteClient();
 * const response = await client.chat("Olá!");
 * console.log(response);
 */

class ClaudeRemoteClient {
    /**
     * Inicializa o cliente
     * @param {string} baseUrl - URL base da API (default: http://localhost:8991)
     * @param {string} sessionId - ID da sessão (usa unificado se não especificado)
     */
    constructor(baseUrl = 'http://localhost:8991', sessionId = null) {
        this.baseUrl = baseUrl;
        this.sessionId = sessionId || '00000000-0000-0000-0000-000000000001';
    }

    /**
     * Envia mensagem e recebe resposta completa
     * @param {string} message - Mensagem para enviar
     * @returns {Promise<string>} Resposta completa
     */
    async chat(message) {
        const response = await this.chatStreaming(message);
        let fullResponse = '';
        
        for await (const chunk of response) {
            if (chunk.type === 'content') {
                fullResponse += chunk.content;
            }
        }
        
        return fullResponse;
    }

    /**
     * Envia mensagem e recebe resposta em streaming
     * @param {string} message - Mensagem para enviar
     * @returns {AsyncGenerator} Generator com chunks da resposta
     */
    async* chatStreaming(message) {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                message: message,
                session_id: this.sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Processa todas as linhas completas
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        yield data;
                        
                        if (data.type === 'done') {
                            return;
                        }
                    } catch (e) {
                        console.error('Erro ao processar chunk:', e);
                    }
                }
            }
        }
    }

    /**
     * Limpa contexto da sessão
     * @returns {Promise<boolean>} True se sucesso
     */
    async clear() {
        const response = await fetch(`${this.baseUrl}/api/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: this.sessionId
            })
        });

        return response.ok;
    }

    /**
     * Interrompe geração em andamento
     * @returns {Promise<boolean>} True se sucesso
     */
    async interrupt() {
        const response = await fetch(`${this.baseUrl}/api/interrupt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: this.sessionId
            })
        });

        return response.ok;
    }

    /**
     * Obtém histórico de mensagens
     * @returns {Promise<Array>} Array com mensagens do histórico
     */
    async getHistory() {
        const response = await fetch(`${this.baseUrl}/api/session-history/${this.sessionId}`);
        
        if (response.ok) {
            const data = await response.json();
            return data.messages || [];
        }
        
        return [];
    }

    /**
     * Verifica status do servidor
     * @returns {Promise<Object>} Informações de status
     */
    async healthCheck() {
        const response = await fetch(`${this.baseUrl}/health/detailed`);
        
        if (response.ok) {
            return await response.json();
        }
        
        return { status: 'error', message: 'Server unavailable' };
    }

    /**
     * Obtém métricas do servidor
     * @returns {Promise<Object>} Métricas
     */
    async getMetrics() {
        const response = await fetch(`${this.baseUrl}/api/metrics`);
        
        if (response.ok) {
            return await response.json();
        }
        
        return {};
    }

    /**
     * Cria nova sessão com configuração
     * @param {Object} config - Configuração da sessão
     * @returns {Promise<string>} ID da nova sessão
     */
    async createSession(config = {}) {
        const response = await fetch(`${this.baseUrl}/api/session-with-config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        if (response.ok) {
            const data = await response.json();
            return data.session_id;
        }
        
        throw new Error('Failed to create session');
    }
}

// Exporta para Node.js se disponível
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClaudeRemoteClient;
}

// Exemplos de uso
if (typeof window === 'undefined') {
    // Exemplo para Node.js
    (async () => {
        console.log('='.repeat(60));
        console.log('Exemplo Node.js: Claude Remote Client');
        console.log('='.repeat(60));

        const client = new ClaudeRemoteClient();

        // Exemplo 1: Chat simples
        console.log('\n1. Chat simples:');
        const response = await client.chat('Olá! Qual é 2+2?');
        console.log('Resposta:', response);

        // Exemplo 2: Streaming
        console.log('\n2. Chat com streaming:');
        process.stdout.write('Resposta: ');
        for await (const chunk of client.chatStreaming('Conte uma piada curta')) {
            if (chunk.type === 'content') {
                process.stdout.write(chunk.content);
            }
        }
        console.log();

        // Exemplo 3: Histórico
        console.log('\n3. Histórico:');
        const history = await client.getHistory();
        console.log(`Total de mensagens: ${history.length}`);

        // Exemplo 4: Status
        console.log('\n4. Status do servidor:');
        const health = await client.healthCheck();
        console.log(`Status: ${health.status}`);
        console.log(`Uptime: ${health.uptime_seconds?.toFixed(2)} segundos`);
    })().catch(console.error);
}