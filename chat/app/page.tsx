'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, FolderOpen, MessageSquare, Clock, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WebSession {
  id: string;
  project: string;
  total_messages: number;
  first_message: string | null;
  last_activity: string | null;
  url: string;
}

interface ClaudeCodeProject {
  name: string;
  path: string;
  sessions_count: number;
  total_messages: number;
  last_activity: string;
  url_path: string;
}

export default function Home() {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<WebSession[]>([]);
  const [projects, setProjects] = React.useState<ClaudeCodeProject[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadClaudeCodeProjects = async () => {
      try {
        // Carregar apenas projetos Claude Code SDK
        const { config } = await import('@/lib/config');
        const apiUrl = config.getApiUrl();
        console.log('🔍 Buscando projetos de:', `${apiUrl}/api/analytics/projects`);
        
        const response = await fetch(`${apiUrl}/api/analytics/projects`);
        console.log('📡 Status da resposta:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📦 Dados recebidos:', data);
        
        setProjects(data.projects || []);
        console.log(`🤖 ${data.projects?.length || 0} projetos Claude Code SDK encontrados`);
      } catch (error) {
        console.error('❌ Erro ao carregar projetos Claude Code SDK:', error);
        setProjects([]); // Definir array vazio em caso de erro
      } finally {
        setLoading(false);
      }
    };

    loadClaudeCodeProjects();
  }, []);

  const formatProjectName = (name: string) => {
    // Nomes específicos e simples para cada projeto
    if (name === '-home-suthub--claude') {
      return '.claude';
    }
    if (name === '-home-suthub--claude-api-claude-code-app') {
      return 'api-claude-code-app';
    }
    if (name.includes('-cc-sdk-chat-api')) {
      return 'cc-sdk-chat-api';
    }
    if (name.includes('-cc-sdk-chat')) {
      return 'cc-sdk-chat';
    }
    
    // Fallback para outros projetos
    return name
      .replace(/-/g, ' ')
      .replace(/home|suthub/gi, '')
      .trim() || 'Projeto';
  };

  const formatLastActivity = (timestamp: string | null) => {
    if (!timestamp) return 'Nunca';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Bot className="mx-auto h-12 w-12 animate-pulse text-primary" />
          <h2 className="mt-4 text-lg font-medium">Descobrindo projetos...</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Escaneando /home/suthub/.claude/projects
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Suas Sessões Oficiais</h1>
              <p className="text-sm text-muted-foreground">
                Todas as suas conversas do Claude Code SDK
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <Card className="p-12 text-center">
            <Bot className="mx-auto h-16 w-16 text-muted-foreground" />
            <h2 className="mt-6 text-xl font-medium">Nenhum projeto Claude Code SDK encontrado</h2>
            <p className="mt-2 text-muted-foreground">
              Crie uma sessão no Claude Code CLI para começar
            </p>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Seus Projetos ({projects.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Clique em um projeto para ver as sessões
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card 
                  key={project.name}
                  className="p-6 transition-all hover:shadow-lg cursor-pointer"
                  onClick={() => router.push(`/${project.url_path}?tab=overview`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">
                        🤖 {formatProjectName(project.name)}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          Claude Code SDK
                        </span>
                        {project.name === '-home-suthub--claude' || 
                         project.name === '-home-suthub--claude-api-claude-code-app' ? (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            🏠 Terminal
                          </span>
                        ) : project.name.includes('-claude-api-claude-code-app-cc-sdk-chat-api') ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            🚀 Projeto
                          </span>
                        ) : project.name.includes('-claude-api-claude-code-app-cc-sdk-chat') ? (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            🏠 Terminal
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {project.sessions_count} {project.sessions_count === 1 ? 'sessão' : 'sessões'}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      <span>{project.total_messages} mensagens</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Última atividade: {formatLastActivity(project.last_activity)}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${project.url_path}?tab=overview`);
                      }}
                    >
                      Ver Sessões
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}