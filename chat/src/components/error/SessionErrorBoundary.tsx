'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Plus, X } from 'lucide-react';

interface Props {
  children: ReactNode;
  sessionId: string;
  sessionTitle?: string;
  onSessionCleanup?: (sessionId: string) => void;
  onCreateNewSession?: () => void;
  onSessionRecovery?: (sessionId: string) => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class SessionErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `session-error-${Date.now()}-${Math.random().toString(36).substring(2)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { sessionId, sessionTitle } = this.props;
    
    console.error(`🚨 Session Error Boundary [${sessionId}] - Erro capturado:`, error);
    console.error(`🔍 Informações do erro da sessão [${sessionTitle || sessionId}]:`, errorInfo);
    
    // Log estruturado específico para sessão
    const sessionErrorLog = {
      timestamp: new Date().toISOString(),
      sessionId,
      sessionTitle: sessionTitle || 'Sessão sem título',
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      context: {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
      }
    };

    // Log específico para monitoramento de sessões
    console.error(`📊 Session Error Log [${sessionId}]:`, JSON.stringify(sessionErrorLog, null, 2));

    this.setState({
      hasError: true,
      error,
      errorInfo,
      errorId: sessionErrorLog.timestamp
    });

    // Auto-cleanup se exceder tentativas máximas
    if (this.retryCount >= this.maxRetries) {
      console.warn(`⚠️ Sessão ${sessionId} excedeu máximo de tentativas. Executando cleanup automático.`);
      this.handleAutoCleanup();
    }
  }

  handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`🔄 Tentativa de recuperação ${this.retryCount}/${this.maxRetries} para sessão ${this.props.sessionId}`);
      
      // Tenta recuperar o estado da sessão
      if (this.props.onSessionRecovery) {
        this.props.onSessionRecovery(this.props.sessionId);
      }
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: ''
      });
    } else {
      console.error(`❌ Máximo de tentativas excedido para sessão ${this.props.sessionId}`);
      this.handleAutoCleanup();
    }
  };

  handleCleanupSession = () => {
    const { sessionId, onSessionCleanup } = this.props;
    console.log(`🧹 Executando cleanup manual da sessão ${sessionId}`);
    
    if (onSessionCleanup) {
      onSessionCleanup(sessionId);
    }
    
    // Reset do boundary após cleanup
    this.retryCount = 0;
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  handleAutoCleanup = () => {
    const { sessionId, onSessionCleanup } = this.props;
    console.log(`🤖 Executando cleanup automático da sessão ${sessionId}`);
    
    if (onSessionCleanup) {
      onSessionCleanup(sessionId);
    }
  };

  handleCreateNewSession = () => {
    const { onCreateNewSession } = this.props;
    console.log(`➕ Criando nova sessão após erro na sessão ${this.props.sessionId}`);
    
    if (onCreateNewSession) {
      onCreateNewSession();
    }
  };

  render() {
    if (this.state.hasError) {
      const { sessionId, sessionTitle, fallback } = this.props;
      
      // Se um fallback customizado foi fornecido, usar ele
      if (fallback) {
        return fallback;
      }

      const shortSessionId = sessionId.slice(-8);
      const displayTitle = sessionTitle || `Sessão ${shortSessionId}`;

      // UI de fallback específica para sessão
      return (
        <div className="flex items-center justify-center p-4 h-64">
          <Card className="w-full max-w-lg p-6 text-center border-destructive/50 bg-destructive/5">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">
              Erro na Sessão
            </h2>
            
            <p className="text-sm text-muted-foreground mb-1">
              <strong>{displayTitle}</strong>
            </p>
            
            <p className="text-sm text-muted-foreground mb-4">
              Esta sessão encontrou um erro, mas outras sessões continuam funcionando normalmente.
            </p>

            {/* Informações do erro em desenvolvimento */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-xs font-medium mb-2 text-muted-foreground">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <div className="bg-muted p-3 rounded text-xs text-muted-foreground font-mono overflow-auto max-h-24">
                  <div className="mb-1">
                    <strong>Erro:</strong> {this.state.error.message}
                  </div>
                  <div className="mb-1">
                    <strong>Tentativas:</strong> {this.retryCount}/{this.maxRetries}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack (primeiras linhas):</strong>
                      <pre className="whitespace-pre-wrap mt-1 text-xs">
                        {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              {this.retryCount < this.maxRetries ? (
                <Button 
                  onClick={this.handleRetry} 
                  size="sm"
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente ({this.maxRetries - this.retryCount} tentativas)
                </Button>
              ) : (
                <Button 
                  onClick={this.handleCleanupSession}
                  size="sm"
                  className="flex-1"
                  variant="destructive"
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar Sessão
                </Button>
              )}
              
              <Button 
                onClick={this.handleCreateNewSession}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Sessão
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>Erro ID: {this.state.errorId}</div>
              <div>Sessão: {shortSessionId}</div>
              {this.retryCount >= this.maxRetries && (
                <div className="text-destructive font-medium">
                  ⚠️ Sessão instável - recomenda-se criar nova sessão
                </div>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SessionErrorBoundary;