'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  AlertCircle
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
  const [activeTab, setActiveTab] = useState<string>(''); // Será definido após carregar sessões
  const [unifiedMessages, setUnifiedMessages] = useState<any[]>([]);
  const [deletingMessages, setDeletingMessages] = useState<Set<string>>(new Set()); // Rastreia mensagens sendo deletadas
  
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
      
      // Carrega histórico de todas as sessões do projeto
      const response = await fetch('/api/load-project-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectPath: `/home/suthub/.claude/projects/${projectName}`,
          primarySessionId: 'dashboard' // ID dummy para o dashboard
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar dados do projeto');
      }

      const { sessions: sessionsData } = await response.json();
      setProjectSessions(sessionsData);

      // Cria mensagens unificadas ordenadas por tempo
      const allMessages: any[] = [];
      sessionsData.forEach((session: ProjectSession) => {
        session.messages.forEach((msg: any) => {
          allMessages.push({
            ...msg,
            sessionOrigin: session.id,
            sessionTitle: getSessionDisplayName(session.origin, session.id),
            timestamp: new Date(msg.timestamp)
          });
        });
      });

      // Ordena por timestamp
      allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setUnifiedMessages(allMessages);

      // Ordena sessões por data de primeira mensagem (ordem cronológica)
      const sortedSessions = sessionsData.sort((a: ProjectSession, b: ProjectSession) => {
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

      console.log(`📊 Dashboard carregado: ${sessionsData.length} sessões`);
    } catch (error) {
      console.error('Erro ao carregar projeto:', error);
      console.error('Erro ao carregar dados do projeto');
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
    // Confirmação antes de deletar
    if (!confirm('Tem certeza que deseja deletar esta mensagem? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    const messageKey = `${sessionId}-${messageIndex}`;
    
    try {
      // Marca mensagem como sendo deletada (animação)
      setDeletingMessages(prev => new Set(prev).add(messageKey));
      
      // Aguarda um pouco para a animação
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Remove da UI após animação
      setProjectSessions(prevSessions => 
        prevSessions.map(session => {
          if (session.id === sessionId) {
            const updatedMessages = [...session.messages];
            updatedMessages.splice(messageIndex, 1);
            return {
              ...session,
              messages: updatedMessages,
              total_messages: updatedMessages.length
            };
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
        console.log('✅ Mensagem deletada:', result);
        console.log('🗑️ Mensagem removida com sucesso!');
        
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
        const error = await response.json();
        console.error('❌ Erro ao deletar mensagem:', error);
        alert('Erro ao deletar mensagem: ' + error.error);
      }
    } catch (error) {
      // Se falhar, reverte a mudança otimista
      setDeletingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageKey);
        return newSet;
      });
      await loadProjectData();
      console.error('❌ Erro ao deletar mensagem:', error);
      alert('Erro ao deletar mensagem');
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
                {projectSessions.length} sessões • {totalStats.messages} mensagens
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
                        Histórico completo de todas as {projectSessions.length} sessões
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
                                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:scale-110 z-50"
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
                          <div className="font-medium">{session.total_messages}</div>
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
                    </div>
                  </div>

                  {/* Conteúdo da sessão */}
                  <div className="flex-1 overflow-y-auto px-4 py-6">
                    <div className="mx-auto max-w-4xl">
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2">
                          {session.origin} • {session.id.slice(-8)}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {session.total_messages} mensagens • {session.total_tokens.toLocaleString()} tokens
                        </p>
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
                                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:scale-110 z-50"
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