'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { config } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, 
  Terminal, 
  Globe, 
  Clock, 
  MessageCircle, 
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowRight,
  FolderOpen,
  Activity,
  Plus,
  ArrowLeft,
  Trash2,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import useChatStore from '@/stores/chatStore';
import { cn, formatCost, formatTokens } from '@/lib/utils';

interface ProjectSession {
  id: string;
  title: string;
  origin: string;
  total_messages: number;
  first_message_time: string;
  last_message_time: string;
  total_tokens: number;
  total_cost: number;
  messages: any[];
}

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projectSessions, setProjectSessions] = useState<ProjectSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(''); // Será definido após carregar sessões
  const [unifiedMessages, setUnifiedMessages] = useState<any[]>([]);
  const [deletingMessages, setDeletingMessages] = useState<Set<string>>(new Set()); // Rastreia mensagens sendo deletadas
  const [copiedSessions, setCopiedSessions] = useState<Set<string>>(new Set()); // Rastreia sessões copiadas
  const [isDeletingSession, setIsDeletingSession] = useState<string | null>(null); // Rastreia sessão sendo limpa
  const shouldStopDeletingRef = useRef(false); // Usa ref para garantir que o valor seja acessível no loop
  
  const { 
    sessions, 
    loadExternalSession, 
    setActiveSession,
    loadCrossSessionHistory 
  } = useChatStore();

  const projectName = params?.project as string;

  useEffect(() => {
    if (projectName) {
      loadProjectData();
    }
  }, [projectName]);

  const loadProjectData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔍 Carregando projeto:', projectName);
      
      // Carrega sessões do projeto - usa a rota local da API
      const url = `/api/projects/${projectName}/sessions`;
      console.log('📡 Buscando sessões em:', url);
      
      let response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          // Adiciona timeout de 10 segundos
          signal: AbortSignal.timeout(10000)
        });
      } catch (fetchError) {
        console.error('❌ Erro de conexão:', fetchError);
        console.log('💡 Verifique se o servidor backend está rodando na porta', config.getApiPort());
        console.log('📍 URL tentada:', url);
        
        // Se for erro de conexão, mostra mensagem mais clara
        if (fetchError instanceof TypeError && fetchError.message === 'Failed to fetch') {
          throw new Error(`Não foi possível conectar ao servidor. Verifique se o backend está rodando em ${apiBaseUrl || 'localhost:' + config.getApiPort()}`);
        }
        throw fetchError;
      }

      if (!response.ok) {
        throw new Error(`Erro ao carregar dados do projeto: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📦 Dados recebidos:', data);
      const sessionsData = data.sessions || [];
      console.log('📊 Sessões encontradas:', sessionsData.length);
      
      // Busca histórico completo de cada sessão
      const sessionsWithMessages = await Promise.all(
        sessionsData.map(async (session: any) => {
          // O endpoint retorna 'id' não 'session_id'
          const sessionId = session.id || session.session_id;
          console.log(`📝 Buscando histórico da sessão: ${sessionId}`);
          
          try {
            const historyResponse = await fetch(`/api/session-history/${sessionId}`);
            if (historyResponse.ok) {
              const historyData = await historyResponse.json();
              console.log(`✅ Histórico carregado: ${historyData.messages?.length || 0} mensagens`);
              return {
                id: sessionId,
                title: session.title || `Sessão ${sessionId.slice(0, 8)}`,
                origin: session.origin || 'terminal',
                total_messages: session.total_messages || session.messages_count || 0,
                first_message_time: session.first_message_time || session.created_at,
                last_message_time: session.last_message_time || session.last_activity,
                total_tokens: session.total_tokens || session.tokens_used || 0,
                total_cost: session.total_cost || 0,
                messages: historyData.messages || []
              };
            } else {
              console.error(`❌ Erro ao buscar histórico: ${historyResponse.status}`);
            }
          } catch (error) {
            console.error('❌ Erro ao buscar histórico da sessão:', sessionId, error);
          }
          
          // Retorna sessão com os dados que já temos
          return {
            id: sessionId,
            title: session.title || `Sessão ${sessionId.slice(0, 8)}`,
            origin: session.origin || 'terminal',
            total_messages: session.total_messages || session.messages_count || 0,
            first_message_time: session.first_message_time || session.created_at,
            last_message_time: session.last_message_time || session.last_activity,
            total_tokens: session.total_tokens || session.tokens_used || 0,
            total_cost: session.total_cost || 0,
            messages: session.messages || []
          };
        })
      );
      
      console.log('✅ Sessões com mensagens carregadas:', sessionsWithMessages.length);
      sessionsWithMessages.forEach(s => {
        console.log(`  - ${s.id}: ${s.messages.length} mensagens`);
      });
      setProjectSessions(sessionsWithMessages);

      // Cria mensagens unificadas ordenadas por tempo
      const allMessages: any[] = [];
      sessionsWithMessages.forEach((session: ProjectSession) => {
        if (session.messages && session.messages.length > 0) {
          session.messages.forEach((msg: any) => {
            allMessages.push({
              ...msg,
              sessionOrigin: session.id,
              sessionTitle: getSessionDisplayName(session.origin, session.id),
              timestamp: new Date(msg.timestamp || msg.created_at)
            });
          });
        }
      });

      // Ordena por timestamp
      allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setUnifiedMessages(allMessages);

      // Ordena sessões por data de primeira mensagem (ordem cronológica)
      const sortedSessions = sessionsWithMessages.sort((a: ProjectSession, b: ProjectSession) => {
        return new Date(a.first_message_time).getTime() - new Date(b.first_message_time).getTime();
      });

      // Carrega sessões no store para navegação
      sortedSessions.forEach((sessionData: ProjectSession) => {
        loadExternalSession({
          id: sessionData.id,
          messages: sessionData.messages,
          origin: sessionData.origin
        });
      });
      
      setProjectSessions(sortedSessions);

      // Define aba baseada no query parameter
      const tabParam = searchParams?.get('tab');
      if (tabParam) {
        // Se tem tab específica na URL (?tab=05d20033)
        if (tabParam === 'overview') {
          // Se tentar acessar overview, redireciona para primeira sessão
          if (sortedSessions.length > 0) {
            setActiveTab(sortedSessions[0].id);
          }
        } else {
          // Busca sessão que termine com o ID curto
          const matchingSession = sortedSessions.find((s: any) => 
            s.id.slice(-8) === tabParam || s.id === tabParam
          );
          if (matchingSession) {
            setActiveTab(matchingSession.id);
          } else if (sortedSessions.length > 0) {
            setActiveTab(sortedSessions[0].id); // Usa primeira sessão como fallback
          }
        }
      } else {
        // Sem query parameter, SEMPRE abre a primeira sessão por padrão
        if (sortedSessions.length > 0) {
          setActiveTab(sortedSessions[0].id);
        }
      }

      console.log(`📊 Dashboard carregado: ${sessionsWithMessages.length} sessões`);
    } catch (error) {
      console.error('❌ Erro ao carregar projeto:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
      
      // Define mensagem de erro amigável
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Erro desconhecido ao carregar o projeto');
      }
    } finally {
      setIsLoading(false);
    }
  };


  const handleSessionClick = (sessionId: string) => {
    // Vai diretamente para o chat com UUID completo (sem redundância)
    const newUrl = `/${projectName}/${sessionId}`;
    router.push(newUrl);
  };

  const calculateTotalStats = () => {
    return projectSessions.reduce((totals, session) => ({
      messages: totals.messages + session.total_messages,
      tokens: totals.tokens + (session.total_tokens || 0),
      cost: totals.cost + (session.total_cost || 0)
    }), { messages: 0, tokens: 0, cost: 0 });
  };

  const getSessionIcon = (origin: string) => {
    if (origin?.includes('Terminal') || origin?.includes('SDK')) return Terminal;
    if (origin?.includes('Web')) return Globe;
    return Terminal; // Default para sessões de terminal
  };
  
  // Função para padronizar os títulos das sessões
  const getSessionDisplayName = (origin: string, sessionId: string) => {
    // Se for sessão do Terminal/SDK, usa nome padronizado
    if (origin?.includes('Terminal') || origin?.includes('SDK') || origin?.includes('Claude Code')) {
      return `Agente SutHub • Claude (${sessionId.slice(-8)})`;
    }
    // Para outras sessões, mantém o formato original
    return `${origin} (${sessionId.slice(-8)})`;
  };

  const getSessionTitle = (session: ProjectSession, index: number) => {
    // Para sessões do projeto -home-suthub--claude, todas são do Terminal
    // Vamos identificar pela origem/contexto
    
    const firstMessage = session.messages?.[0]?.content;
    
    // Se é a primeira sessão (index 0), é a original
    if (index === 0) {
      return `terminal-${session.id.slice(-8)}`;
    }
    
    // Para outras sessões, detecta se referencia a sessão original
    if (firstMessage?.includes('05d20033') || firstMessage?.includes('Sessão:')) {
      return 'terminal-05d20033';
    }
    
    return `terminal-${session.id.slice(-8)}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dashboard do projeto...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <svg className="w-12 h-12 text-destructive mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">Erro ao carregar projeto</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={() => loadProjectData()} className="w-full">
              Tentar novamente
            </Button>
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (projectSessions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Projeto não encontrado</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Nenhuma sessão foi encontrada para este projeto.
          </p>
          <Button onClick={() => router.push('/')}>
            Voltar ao início
          </Button>
        </Card>
      </div>
    );
  }

  const totalStats = calculateTotalStats();
  
  const handleDeleteMessage = async (sessionId: string, messageIndex: number) => {
    // Validação de índice
    const session = projectSessions.find(s => s.id === sessionId);
    
    // Validação detalhada
    if (!session) {
      console.error(`❌ Sessão não encontrada: ${sessionId}`);
      return;
    }
    
    if (!session.messages || session.messages.length === 0) {
      console.log(`⚠️ Sessão sem mensagens: ${sessionId}`);
      return;
    }
    
    if (messageIndex < 0 || messageIndex >= session.messages.length) {
      console.error(`❌ Índice inválido: ${messageIndex} (total de mensagens: ${session.messages.length})`);
      return;
    }
    
    const messageKey = `${sessionId}-${messageIndex}`;
    
    try {
      // Marca mensagem como sendo deletada (animação)
      setDeletingMessages(prev => new Set(prev).add(messageKey));
      
      // Aguarda um pouco para a animação
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Remove da UI após animação (otimistic update)
      setProjectSessions(prevSessions => 
        prevSessions.map(session => {
          if (session.id === sessionId) {
            const updatedMessages = [...session.messages];
            if (messageIndex >= 0 && messageIndex < updatedMessages.length) {
              updatedMessages.splice(messageIndex, 1);
              return {
                ...session,
                messages: updatedMessages,
                total_messages: updatedMessages.length
              };
            }
          }
          return session;
        })
      );
      
      // Remove do estado de deleção
      setDeletingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageKey);
        return newSet;
      });
      
      const response = await fetch('/api/delete-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          messageIndex,
          projectPath: projectName
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Mensagem ${messageIndex} deletada da sessão ${sessionId.slice(-8)}`);
        
        // Atualiza também as mensagens unificadas
        if (unifiedMessages.length > 0) {
          setUnifiedMessages(prev => {
            // Filtra removendo a mensagem deletada baseado no sessionOrigin
            const updatedMessages = [...prev];
            // Remove mensagens que correspondem ao sessionId e índice
            return updatedMessages.filter((msg) => {
              if (msg.sessionOrigin === sessionId) {
                // Conta quantas mensagens da mesma sessão vêm antes desta
                const sameSessionMessages = prev.filter(m => m.sessionOrigin === sessionId);
                const msgIndex = sameSessionMessages.indexOf(msg);
                return msgIndex !== messageIndex;
              }
              return true;
            });
          });
        }
      } else {
        // Se falhar, reverte a mudança otimista
        setDeletingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageKey);
          return newSet;
        });
        await loadProjectData();
        
        // Tenta obter informações do erro
        let errorMessage = `Status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
          } else {
            const textError = await response.text();
            if (textError) {
              errorMessage = textError;
            }
          }
        } catch (parseError) {
          console.error('Erro ao processar resposta de erro:', parseError);
        }
        
        console.error(`❌ Falha ao deletar no backend: ${errorMessage}`);
      }
    } catch (error) {
      // Se falhar, reverte a mudança otimista
      setDeletingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageKey);
        return newSet;
      });
      await loadProjectData();
      console.error('❌ Erro de conexão ao deletar mensagem:', error);
    }
  };

  // Função para limpar todas as mensagens de uma sessão
  const handleClearSession = async (sessionId: string) => {
    try {
      // Obtém a sessão atual
      const session = projectSessions.find(s => s.id === sessionId);
      if (!session || !session.messages || session.messages.length === 0) {
        console.log('Sessão vazia ou não encontrada');
        return;
      }
      
      // Define que está deletando esta sessão e reseta flag de interrupção
      setIsDeletingSession(sessionId);
      shouldStopDeletingRef.current = false;
      
      const totalMessages = session.messages.length;
      console.log(`🧹 Iniciando limpeza de ${totalMessages} mensagens da sessão ${sessionId.slice(-8)}`);
      
      // Deleta sempre a primeira mensagem (índice 0) até não haver mais
      let deletedCount = 0;
      
      while (deletedCount < totalMessages) {
        // Verifica se deve parar usando a ref
        if (shouldStopDeletingRef.current) {
          console.log(`⏹️ Exclusão interrompida: ${deletedCount}/${totalMessages} mensagens deletadas`);
          break;
        }
        
        // Busca sessão atualizada a cada iteração
        const currentSession = projectSessions.find(s => s.id === sessionId);
        
        // Verifica se ainda há mensagens para deletar
        if (!currentSession || !currentSession.messages || currentSession.messages.length === 0) {
          console.log(`✅ Sessão limpa: ${deletedCount} mensagens deletadas`);
          break;
        }
        
        // Log do estado atual
        console.log(`📋 Deletando mensagem 1 de ${currentSession.messages.length} restantes`);
        
        // Sempre deleta a primeira mensagem (índice 0)
        // Mas só se realmente houver mensagens
        if (currentSession.messages.length > 0) {
          await handleDeleteMessage(sessionId, 0);
          deletedCount++;
          console.log(`📊 Progresso: ${deletedCount}/${totalMessages} mensagens deletadas`);
        } else {
          console.log(`⚠️ Não há mais mensagens para deletar`);
          break;
        }
        
        // Pequeno delay entre deleções para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      if (!shouldStopDeletingRef.current && deletedCount === totalMessages) {
        console.log(`✅ Sessão limpa completamente: ${deletedCount} mensagens deletadas`);
      }
    } catch (error) {
      console.error('❌ Erro ao limpar sessão:', error);
    } finally {
      setIsDeletingSession(null);
      shouldStopDeletingRef.current = false;
    }
  };
  
  // Função para interromper a exclusão
  const handleStopDeleting = () => {
    shouldStopDeletingRef.current = true;
    console.log('🛑 Solicitando interrupção da exclusão...');
  };
  
  // Função para copiar todas as conversas
  const handleCopyAllConversations = async (sessionId: string) => {
    try {
      // Obtém a sessão atual
      const session = projectSessions.find(s => s.id === sessionId);
      if (!session || !session.messages || session.messages.length === 0) {
        console.log('Sessão vazia ou não encontrada');
        return;
      }
      
      // Formata as mensagens para copiar
      let formattedText = `🔹 Sessão: ${session.origin} (${session.id})\n`;
      formattedText += `📅 Período: ${new Date(session.first_message_time).toLocaleString('pt-BR')} - ${new Date(session.last_message_time).toLocaleString('pt-BR')}\n`;
      formattedText += `📊 Total: ${session.total_messages} mensagens | ${session.total_tokens.toLocaleString()} tokens | $${session.total_cost.toFixed(4)}\n`;
      formattedText += `${'━'.repeat(80)}\n\n`;
      
      // Adiciona cada mensagem formatada
      session.messages.forEach((msg: any, index: number) => {
        const timestamp = new Date(msg.timestamp).toLocaleString('pt-BR');
        const role = msg.role === 'user' ? '👤 Usuário' : '🤖 Claude';
        
        formattedText += `[${timestamp}] ${role}:\n`;
        
        // Processa o conteúdo da mensagem
        let content = '';
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content.map((item: any) => {
            if (typeof item === 'string') return item;
            if (item.type === 'text') return item.text;
            if (item.type === 'tool_use') return `[Ferramenta: ${item.name}]`;
            return '[Conteúdo não textual]';
          }).join('\n');
        }
        
        formattedText += content + '\n';
        
        // Adiciona métricas se disponíveis
        if (msg.tokens || msg.cost) {
          formattedText += `  ⚡ Tokens: ${msg.tokens || 0} | Custo: $${(msg.cost || 0).toFixed(4)}\n`;
        }
        
        formattedText += '\n' + '─'.repeat(40) + '\n\n';
      });
      
      // Copia para a área de transferência
      await navigator.clipboard.writeText(formattedText);
      
      // Adiciona feedback visual
      setCopiedSessions(prev => new Set(prev).add(sessionId));
      
      // Remove o feedback após 2 segundos
      setTimeout(() => {
        setCopiedSessions(prev => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }, 2000);
      
      console.log('📋 Conversa copiada para a área de transferência!');
    } catch (error) {
      console.error('Erro ao copiar conversa:', error);
      alert('Erro ao copiar conversa. Verifique as permissões do navegador.');
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Dashboard do Projeto</h1>
              <p className="text-sm text-muted-foreground">
                {projectSessions.length} {projectSessions.length === 1 ? 'sessão' : 'sessões'} • {totalStats.messages} {totalStats.messages === 1 ? 'mensagem' : 'mensagens'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right text-sm mr-4">
              <div className="font-medium">{totalStats.tokens.toLocaleString()} tokens</div>
            </div>
            
            {/* Botão Voltar */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="shrink-0"
              title="Voltar para início"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            {/* Botão Nova Sessão */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Redireciona para a página principal para criar nova sessão
                router.push('/');
              }}
              className="shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Sessão
            </Button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="px-4 py-2 text-sm text-muted-foreground border-t">
          <span className="hover:text-foreground cursor-pointer" onClick={() => router.push('/')}>
            Início
          </span>
          <ArrowRight className="inline h-3 w-3 mx-2" />
          <span className="hover:text-foreground cursor-pointer" onClick={() => router.push('/')}>
            {projectName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
          <ArrowRight className="inline h-3 w-3 mx-2" />
          <span className="text-foreground font-medium">
            Sessões do Projeto
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <div className="border-b bg-background">
            <TabsList className="w-full justify-start rounded-none bg-transparent px-4">
              {/* Aba Overview sempre primeira */}
              {/* Abas das sessões individuais */}
              {projectSessions.map((session, index) => {
                const Icon = getSessionIcon(session.origin);
                return (
                  <TabsTrigger 
                    key={session.id} 
                    value={session.id}
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => router.push(`/${projectName}?tab=${session.id.slice(-8)}`)}
                  >
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs font-medium">
                      #{index + 1}
                    </span>
                    <Icon className="h-4 w-4" />
                    {getSessionTitle(session, index)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {/* Overview Tab */}
            <TabsContent value="overview" className="h-full">
              <div className="flex h-full">
                {/* Sidebar com estatísticas */}
                <div className="w-80 border-r bg-muted/30 p-4 overflow-y-auto">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Estatísticas do Projeto
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Cards de estatísticas */}
                    <Card className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Mensagens</span>
                      </div>
                      <div className="text-2xl font-bold">{totalStats.messages}</div>
                    </Card>

                    <Card className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Tokens</span>
                      </div>
                      <div className="text-2xl font-bold">{totalStats.tokens.toLocaleString()}</div>
                    </Card>

                    <Card className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">Atividade</span>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">Hoje: {
                          projectSessions.filter(s => {
                            const today = new Date().toDateString();
                            return new Date(s.last_message_time).toDateString() === today;
                          }).length
                        }</div>
                        <div className="text-muted-foreground">Média: {
                          Math.round(totalStats.messages / projectSessions.length)
                        } msgs/sessão</div>
                      </div>
                    </Card>

                    {/* Lista de sessões */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Sessões ({projectSessions.length})
                      </h4>
                      {projectSessions.map((session, index) => {
                        const Icon = getSessionIcon(session.origin);
                        return (
                          <Card 
                            key={session.id} 
                            className="p-3 hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => handleSessionClick(session.id)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="flex items-center justify-center w-5 h-5 bg-primary/10 text-primary rounded-full text-xs font-bold">
                                {index + 1}
                              </span>
                              <Icon className="h-3 w-3" />
                              <span className="text-xs font-medium">
                                {getSessionTitle(session, index)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {session.total_messages} mensagens
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(session.last_message_time).toLocaleDateString('pt-BR')}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Timeline unificada */}
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <div className="mx-auto max-w-4xl">
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold mb-2">Visão Geral do Projeto</h2>
                      <p className="text-sm text-muted-foreground">
                        Histórico completo de {projectSessions.length === 1 ? 'uma sessão' : `todas as ${projectSessions.length} sessões`}
                      </p>
                    </div>

                    {unifiedMessages.length === 0 ? (
                      <Card className="p-8 text-center">
                        <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">Nenhuma mensagem encontrada</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Este projeto ainda não possui mensagens.
                        </p>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {unifiedMessages.map((message, index) => {
                          const messageKey = `${message.sessionOrigin}-unified-${index}`;
                          const isDeleting = deletingMessages.has(messageKey);
                          
                          // Encontra o índice real da mensagem na sessão original
                          const sessionMessages = projectSessions.find(s => s.id === message.sessionOrigin)?.messages || [];
                          const originalIndex = sessionMessages.findIndex((m: any) => 
                            m.content === message.content && 
                            m.role === message.role
                          );
                          
                          return (
                            <div 
                              key={`${message.sessionOrigin}-${index}`}
                              className={cn(
                                "relative group transition-all duration-300",
                                isDeleting && "opacity-50 scale-95 blur-sm pointer-events-none"
                              )}
                              style={{
                                transform: isDeleting ? 'translateX(-100px)' : 'translateX(0)',
                                transition: 'all 0.3s ease-out'
                              }}
                            >
                              {/* Botão de Deletar - aparece para TODAS as mensagens (user e assistant) */}
                              {!isDeleting && originalIndex >= 0 && (
                                <button
                                  onClick={() => {
                                    console.log(`🗑️ Deletando mensagem unificada - Role: ${message.role}, Index: ${originalIndex}`);
                                    handleDeleteMessage(message.sessionOrigin, originalIndex);
                                  }}
                                  className="absolute right-2 top-12 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:scale-110 z-50"
                                  title={`Deletar mensagem ${message.role === 'user' ? 'do usuário' : 'do Claude'}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                              
                              {/* Indicador de deleção */}
                              {isDeleting && (
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                  <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Deletando...
                                  </div>
                                </div>
                              )}
                              
                              <ChatMessage
                                role={message.role}
                                content={message.content}
                                timestamp={message.timestamp}
                                tokens={message.tokens}
                                cost={message.cost}
                                tools={message.tools}
                                sessionTitle={message.sessionTitle}
                                sessionId={message.sessionOrigin}
                                sessionOrigin={message.sessionOrigin}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tabs das sessões individuais */}
            {projectSessions.map((session) => (
              <TabsContent key={session.id} value={session.id} className="h-full">
                <div className="flex h-full">
                  {/* Sidebar da sessão */}
                  <div className="w-80 border-r bg-muted/30 p-4 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-4">
                      {React.createElement(getSessionIcon(session.origin), { className: "h-5 w-5" })}
                      <h3 className="font-semibold">{session.origin}</h3>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">
                        <strong>ID:</strong> {session.id}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground">Mensagens</div>
                          <div className="font-medium">
                            {isDeletingSession === session.id ? (
                              <span className="text-orange-500 animate-pulse">
                                Excluindo... {session.messages.length}
                              </span>
                            ) : (
                              session.total_messages
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Tokens</div>
                          <div className="font-medium">{session.total_tokens.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="pt-3 border-t">
                        <div className="text-xs text-muted-foreground mb-1">Primeira mensagem</div>
                        <div className="text-sm">
                          {new Date(session.first_message_time).toLocaleString('pt-BR')}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Última mensagem</div>
                        <div className="text-sm">
                          {new Date(session.last_message_time).toLocaleString('pt-BR')}
                        </div>
                      </div>

                      <Button 
                        className="w-full mt-4" 
                        onClick={() => handleSessionClick(session.id)}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Abrir Sessão
                      </Button>
                      
                      <Button 
                        className="w-full mt-2" 
                        variant="outline"
                        onClick={() => handleCopyAllConversations(session.id)}
                        disabled={session.messages.length === 0}
                      >
                        {copiedSessions.has(session.id) ? (
                          <>
                            <Check className="mr-2 h-4 w-4 text-green-600" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar Conversa
                          </>
                        )}
                      </Button>
                      
                      {isDeletingSession === session.id ? (
                        <Button 
                          className="w-full mt-2" 
                          variant="outline"
                          onClick={handleStopDeleting}
                        >
                          <AlertCircle className="mr-2 h-4 w-4 animate-pulse" />
                          Interromper Exclusão
                        </Button>
                      ) : (
                        <Button 
                          className="w-full mt-2" 
                          variant="destructive"
                          onClick={() => handleClearSession(session.id)}
                          disabled={session.messages.length === 0 || isDeletingSession !== null}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Limpar Tudo
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Conteúdo da sessão */}
                  <div className="flex-1 overflow-y-auto px-4 py-6 relative">
                    <div className="mx-auto max-w-4xl">
                      <div className="mb-6 flex items-start justify-between">
                        <div>
                          <h2 className="text-lg font-semibold mb-2">
                            {session.origin} • {session.id.slice(-8)}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {session.total_messages} mensagens • {session.total_tokens.toLocaleString()} tokens
                          </p>
                        </div>
                        
                        {/* Botão flutuante para copiar */}
                        {session.messages.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyAllConversations(session.id)}
                            className="sticky top-2 right-2"
                          >
                            {copiedSessions.has(session.id) ? (
                              <>
                                <Check className="mr-2 h-4 w-4 text-green-600" />
                                Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar Tudo
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {session.messages.length === 0 ? (
                        <Card className="p-8 text-center">
                          <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
                          <h3 className="mt-4 text-lg font-medium">Sessão vazia</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Esta sessão não possui mensagens.
                          </p>
                        </Card>
                      ) : (
                        <div className="space-y-4">
                          {session.messages.map((message: any, index: number) => {
                            const messageKey = `${session.id}-${index}`;
                            const isDeleting = deletingMessages.has(messageKey);
                            
                            return (
                              <div 
                                key={messageKey} 
                                className={cn(
                                  "relative group transition-all duration-300",
                                  isDeleting && "opacity-50 scale-95 blur-sm pointer-events-none"
                                )}
                                style={{
                                  transform: isDeleting ? 'translateX(-100px)' : 'translateX(0)',
                                  transition: 'all 0.3s ease-out'
                                }}
                              >
                                {/* Botão de Deletar - aparece para TODAS as mensagens (user e assistant) */}
                                {!isDeleting && (
                                  <button
                                    onClick={() => {
                                      console.log(`🗑️ Deletando mensagem ${index} - Role: ${message.role}`);
                                      handleDeleteMessage(session.id, index);
                                    }}
                                    className="absolute right-2 top-12 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:scale-110 z-50"
                                    title={`Deletar mensagem ${message.role === 'user' ? 'do usuário' : 'do Claude'}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                                
                                {/* Indicador de deleção */}
                                {isDeleting && (
                                  <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      Deletando...
                                    </div>
                                  </div>
                                )}
                                
                                <ChatMessage
                                  role={message.role}
                                  content={message.content}
                                  timestamp={new Date(message.timestamp)}
                                  tokens={message.tokens}
                                  cost={message.cost}
                                  tools={message.tools}
                                  sessionTitle={getSessionDisplayName(session.origin, session.id)}
                                  sessionId={session.id}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  );
}