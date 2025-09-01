import React from 'react'
import { ChevronRight, Home, GitBranch, MessageSquare, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface NavigationBreadcrumbProps {
  activeSessionId: string | null
  sessionTitle?: string
  showNavigationHint?: boolean
}

export function NavigationBreadcrumb({ 
  activeSessionId, 
  sessionTitle, 
  showNavigationHint = false 
}: NavigationBreadcrumbProps) {
  const router = useRouter();

  // Não mostra breadcrumb se não há sessão ativa ou se é temporária
  if (!activeSessionId || activeSessionId.startsWith('temp-')) {
    return null
  }

  const isProjectContext = activeSessionId.startsWith('project-')
  const isSpecificSession = !activeSessionId.startsWith('project-') && !activeSessionId.startsWith('temp-')

  const handleProjectDashboardClick = () => {
    const projectPath = '-home-suthub--claude-api-claude-code-app-cc-sdk-chat';
    router.push(`/${projectPath}`);
  };

  return (
    <div className="border-b bg-muted/30 px-4 py-2">
      <div className="mx-auto max-w-4xl">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          {/* Home/Projeto */}
          <div className="flex items-center space-x-1">
            <Home className="h-4 w-4" />
            <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => router.push('/')}>
              Início
            </span>
          </div>

          {/* Separador */}
          <ChevronRight className="h-4 w-4" />

          {/* Dashboard do Projeto (sempre clicável quando em sessão específica) */}
          <div className="flex items-center space-x-1">
            <FolderOpen className="h-4 w-4" />
            <span 
              className={cn(
                "transition-colors",
                isSpecificSession 
                  ? "hover:text-foreground cursor-pointer" 
                  : "text-foreground font-medium"
              )}
              onClick={isSpecificSession ? handleProjectDashboardClick : undefined}
            >
              Dashboard do Projeto
            </span>
          </div>

          {/* Separador e contexto atual */}
          {isSpecificSession && (
            <>
              <ChevronRight className="h-4 w-4" />
              <div className="flex items-center space-x-1 text-foreground">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">
                  {sessionTitle || `Sessão ${activeSessionId.slice(-8)}`}
                </span>
                <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                  Sessão Específica
                </span>
              </div>
            </>
          )}

          {isProjectContext && (
            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
              Visão Completa
            </span>
          )}

          {/* Hint de navegação automática */}
          {showNavigationHint && (
            <>
              <div className="mx-2 h-4 w-px bg-border" />
              <div className="flex items-center space-x-2 text-xs">
                <div className="flex h-2 w-2 items-center justify-center">
                  <div className="h-full w-full rounded-full bg-green-500 animate-pulse" />
                </div>
                <span className="text-green-600 dark:text-green-400">
                  Navegação automática ativa
                </span>
              </div>
            </>
          )}
        </nav>

        {/* Informação adicional sobre navegação */}
        {isProjectContext && (
          <div className="mt-1 text-xs text-muted-foreground">
            💡 Ao enviar mensagem, você será redirecionado automaticamente para a sessão específica
          </div>
        )}
      </div>
    </div>
  )
}