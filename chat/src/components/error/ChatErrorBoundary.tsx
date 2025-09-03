'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, MessageSquare, Save, Router } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sessionId?: string;
  onErrorRecovery?: () => void;
  onPreserveSession?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveryAttempts: number;
  isRecovering: boolean;
  lastErrorTime: number;
}

interface ChatErrorDetails {
  isStreamingError: boolean;
  isApiError: boolean;
  isRenderError: boolean;
  errorType: 'STREAMING' | 'API' | 'RENDER' | 'UNKNOWN';
}

export class ChatErrorBoundary extends Component<Props, State> {
  private maxRecoveryAttempts = 3;
  private recoveryTimeWindow = 60000; // 1 minuto

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: 0,
      isRecovering: false,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Chat Error Boundary - Erro capturado:', error);
    console.error('🔍 Chat Error Info:', errorInfo);
    
    const errorDetails = this.analyzeError(error, errorInfo);
    
    // Log estruturado específico para chat
    const chatErrorLog = {
      timestamp: new Date().toISOString(),
      sessionId: this.props.sessionId,
      errorDetails,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      recoveryAttempts: this.state.recoveryAttempts,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    };

    console.error('📊 Chat Error Log:', JSON.stringify(chatErrorLog, null, 2));

    // Auto-recovery para erros específicos
    this.attemptAutoRecovery(errorDetails);

    this.setState({
      hasError: true,
      error,
      errorInfo
    });
  }

  private analyzeError(error: Error, errorInfo: ErrorInfo): ChatErrorDetails {
    const errorMessage = error.message.toLowerCase();
    const componentStack = errorInfo.componentStack.toLowerCase();

    // Detecta tipo de erro baseado na mensagem e stack
    const isStreamingError = errorMessage.includes('stream') || 
                            errorMessage.includes('chunk') ||
                            errorMessage.includes('aborted') ||
                            componentStack.includes('streaming');

    const isApiError = errorMessage.includes('fetch') ||
                      errorMessage.includes('api') ||
                      errorMessage.includes('network') ||
                      errorMessage.includes('timeout');

    const isRenderError = errorMessage.includes('render') ||
                         errorMessage.includes('component') ||
                         errorMessage.includes('hook') ||
                         componentStack.includes('chatmessage') ||
                         componentStack.includes('messageinput');

    let errorType: ChatErrorDetails['errorType'] = 'UNKNOWN';
    if (isStreamingError) errorType = 'STREAMING';
    else if (isApiError) errorType = 'API';
    else if (isRenderError) errorType = 'RENDER';

    return {
      isStreamingError,
      isApiError,
      isRenderError,
      errorType
    };
  }

  private attemptAutoRecovery = (errorDetails: ChatErrorDetails) => {
    const now = Date.now();
    const timeSinceLastError = now - this.state.lastErrorTime;

    // Reset counter se passou tempo suficiente
    if (timeSinceLastError > this.recoveryTimeWindow) {
      this.setState({ recoveryAttempts: 0 });
    }

    // Não tenta auto-recovery se já excedeu tentativas
    if (this.state.recoveryAttempts >= this.maxRecoveryAttempts) {
      return;
    }

    // Auto-recovery para erros de streaming
    if (errorDetails.isStreamingError) {
      setTimeout(() => {
        this.handleStreamingRecovery();
      }, 1000);
    }
  };

  private handleStreamingRecovery = () => {
    this.setState({ isRecovering: true });
    
    try {
      // Limpa estados de streaming que podem estar corrompidos
      if (typeof window !== 'undefined') {
        // Interrompe qualquer fetch em andamento
        window.dispatchEvent(new Event('chat-interrupt'));
        
        // Limpa timers de digitação
        const timers = (window as any).__chatTimers || [];
        timers.forEach((timer: any) => clearTimeout(timer));
        (window as any).__chatTimers = [];
      }

      console.log('🔄 Recuperando chat...');

      setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          errorInfo: null,
          recoveryAttempts: prevState.recoveryAttempts + 1,
          isRecovering: false
        }));

        this.props.onErrorRecovery?.();
        console.log('✅ Chat recuperado!');
      }, 2000);

    } catch (recoveryError) {
      console.error('Erro durante recovery automático:', recoveryError);
      this.setState({ isRecovering: false });
    }
  };

  private handleManualRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: prevState.recoveryAttempts + 1,
      isRecovering: false
    }));

    this.props.onErrorRecovery?.();
    console.log('🔄 Tentando novamente...');
  };

  private handlePreserveSession = () => {
    try {
      // Salva dados da sessão no localStorage
      if (this.props.sessionId && typeof window !== 'undefined') {
        const sessionKey = `chat_session_backup_${this.props.sessionId}`;
        const backupData = {
          sessionId: this.props.sessionId,
          timestamp: Date.now(),
          error: this.state.error?.message,
          url: window.location.href
        };
        
        localStorage.setItem(sessionKey, JSON.stringify(backupData));
        console.log('💾 Sessão preservada!');
      }

      this.props.onPreserveSession?.();
    } catch (error) {
      console.error('Erro ao preservar sessão:', error);
      console.error('Erro ao preservar sessão');
    }
  };

  private handleNavigateHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  private getErrorTitle = (): string => {
    if (!this.state.error) return 'Erro no Chat';
    
    const errorMessage = this.state.error.message.toLowerCase();
    
    if (errorMessage.includes('stream') || errorMessage.includes('chunk')) {
      return 'Erro na Resposta';
    }
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'Erro de Conexão';
    }
    if (errorMessage.includes('render') || errorMessage.includes('component')) {
      return 'Erro de Exibição';
    }
    
    return 'Erro no Chat';
  };

  private getErrorMessage = (): string => {
    if (!this.state.error) return 'Ocorreu um erro inesperado no chat.';
    
    const errorMessage = this.state.error.message.toLowerCase();
    
    if (errorMessage.includes('stream') || errorMessage.includes('chunk')) {
      return 'Houve um problema durante a geração da resposta. Você pode tentar enviar a mensagem novamente.';
    }
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'Problema de conexão com o servidor. Verifique sua internet e tente novamente.';
    }
    if (errorMessage.includes('render') || errorMessage.includes('component')) {
      return 'Erro ao exibir o conteúdo do chat. A navegação permanece funcionando.';
    }
    
    return 'Ocorreu um erro inesperado no chat. A navegação permanece funcionando normalmente.';
  };

  render() {
    if (this.state.hasError) {
      // Se um fallback customizado foi fornecido, usar ele
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.recoveryAttempts < this.maxRecoveryAttempts;

      // UI de fallback específica para chat
      return (
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <Card className="w-full max-w-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <MessageSquare className="h-12 w-12 text-orange-500" />
            </div>
            
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {this.getErrorTitle()}
            </h2>
            
            <p className="text-muted-foreground mb-6">
              {this.getErrorMessage()}
            </p>

            {/* Indicador de recovery em andamento */}
            {this.state.isRecovering && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Recuperando chat...</span>
                </div>
              </div>
            )}

            {/* Tentativas de recovery */}
            {this.state.recoveryAttempts > 0 && (
              <div className="mb-4 text-xs text-muted-foreground">
                Tentativa {this.state.recoveryAttempts}/{this.maxRecoveryAttempts}
              </div>
            )}

            {/* Detalhes do erro em desenvolvimento */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm font-medium mb-2">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <div className="bg-muted p-3 rounded text-xs text-muted-foreground font-mono overflow-auto max-h-32">
                  <div className="mb-2">
                    <strong>Erro:</strong> {this.state.error.message}
                  </div>
                  {this.state.errorInfo?.componentStack && (
                    <div className="mb-2">
                      <strong>Componente:</strong>
                      <pre className="whitespace-pre-wrap mt-1 text-xs">
                        {this.state.errorInfo.componentStack.split('\n').slice(0, 5).join('\n')}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col gap-3">
              {/* Retry button */}
              {canRetry && !this.state.isRecovering && (
                <Button 
                  onClick={this.handleManualRetry}
                  className="w-full"
                  variant="default"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar novamente
                </Button>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={this.handlePreserveSession}
                  variant="outline"
                  size="sm"
                  disabled={!this.props.sessionId}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Salvar Sessão
                </Button>
                
                <Button 
                  onClick={this.handleNavigateHome}
                  variant="outline"
                  size="sm"
                >
                  <Router className="w-4 h-4 mr-1" />
                  Página Inicial
                </Button>
              </div>
            </div>

            {/* Status info */}
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p>🛡️ A navegação permanece funcionando</p>
              {this.props.sessionId && (
                <p>Sessão: {this.props.sessionId.slice(-8)}</p>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChatErrorBoundary;