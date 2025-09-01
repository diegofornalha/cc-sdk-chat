'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, FolderOpen, MessageSquare, Clock, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface WebSession {
  id: string;
  project: string;
  total_messages: number;
  first_message: string | null;
  last_activity: string | null;
  url: string;
}

export default function Home() {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<WebSession[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadWebSessions = async () => {
      try {
        const response = await fetch('http://localhost:8992/api/web-sessions');
        const data = await response.json();
        
        if (data.sessions) {
          setSessions(data.sessions);
          toast.success(`💬 ${data.count} sessões Web encontradas`);
        }
      } catch (error) {
        console.error('Erro ao carregar sessões Web:', error);
        toast.error('Erro ao carregar sessões');
      } finally {
        setLoading(false);
      }
    };

    loadWebSessions();
  }, []);

  const formatProjectName = (name: string) => {
    return name
      .replace(/-/g, ' ')
      .replace(/home|suthub|claude|api|code|app/gi, '')
      .trim()
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Projeto Claude';
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
              <h1 className="text-2xl font-bold">Suas Conversas Web</h1>
              <p className="text-sm text-muted-foreground">
                Todas as suas conversas criadas via interface Web
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {sessions.length === 0 ? (
          <Card className="p-12 text-center">
            <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground" />
            <h2 className="mt-6 text-xl font-medium">Nenhuma conversa Web encontrada</h2>
            <p className="mt-2 text-muted-foreground">
              Crie uma nova conversa para começar
            </p>
            <Button 
              className="mt-4"
              onClick={() => router.push('/new')}
            >
              Nova Conversa Web
            </Button>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Suas Conversas ({sessions.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Clique em uma conversa para continuar
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <Card 
                  key={session.id}
                  className="p-6 transition-all hover:shadow-lg cursor-pointer"
                  onClick={() => router.push(session.url)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">
                        💬 Conversa {session.id.slice(-8)}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {session.project.replace(/-/g, ' ')}
                      </p>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      <span>{session.total_messages} mensagens</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Última atividade: {formatLastActivity(session.last_activity)}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(session.url);
                      }}
                    >
                      Abrir Conversa
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