/**
 * Configuração centralizada do sistema
 * 
 * Este arquivo gerencia todas as configurações de ambiente,
 * incluindo portas, URLs e detecção automática de ambientes.
 */

interface SystemConfig {
  api: {
    port: number;
    host: string;
    url: string;
  };
  frontend: {
    port: number;
  };
  isDevelopment: boolean;
  isProduction: boolean;
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: SystemConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): SystemConfig {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isProduction = process.env.NODE_ENV === 'production';

    // Carrega portas do ambiente ou usa padrões
    const apiPort = parseInt(process.env.NEXT_PUBLIC_API_PORT || '8989');
    const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
    const frontendPort = parseInt(process.env.NEXT_PUBLIC_FRONTEND_PORT || '3082');

    // Detecta a URL da API baseado no contexto
    let apiUrl = '';
    
    if (process.env.NEXT_PUBLIC_API_URL) {
      // Se explicitamente configurada, usa ela
      apiUrl = process.env.NEXT_PUBLIC_API_URL;
    } else if (typeof window !== 'undefined') {
      // No browser
      const host = window.location.hostname;
      
      if (host === 'suthub.agentesintegrados.com' || isProduction) {
        // Em produção, usa a mesma origem (proxy reverso)
        apiUrl = '';
      } else {
        // Em desenvolvimento, constrói a URL
        apiUrl = `http://${apiHost}:${apiPort}`;
      }
    } else {
      // SSR ou Node.js - usa configuração local
      apiUrl = `http://${apiHost}:${apiPort}`;
    }

    return {
      api: {
        port: apiPort,
        host: apiHost,
        url: apiUrl
      },
      frontend: {
        port: frontendPort
      },
      isDevelopment,
      isProduction
    };
  }

  getApiUrl(): string {
    return this.config.api.url;
  }

  getApiPort(): number {
    return this.config.api.port;
  }

  getFrontendPort(): number {
    return this.config.frontend.port;
  }

  isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  isProduction(): boolean {
    return this.config.isProduction;
  }

  // Método para debug - mostra configuração atual
  debug(): void {
    console.log('🔧 Configuração do Sistema:', {
      ambiente: this.config.isDevelopment ? 'desenvolvimento' : 'produção',
      api: {
        url: this.config.api.url,
        porta: this.config.api.port,
        host: this.config.api.host
      },
      frontend: {
        porta: this.config.frontend.port
      }
    });
  }
}

// Exporta uma instância única
export const config = ConfigManager.getInstance();

// Exporta também o tipo para uso em outros arquivos
export type { SystemConfig };