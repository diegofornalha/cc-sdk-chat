import React from 'react'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { Button } from '../ui/button'
import { Plus, X, MessageSquare } from 'lucide-react'
import { Session } from '@/stores/chatStore'
import { cn } from '@/lib/utils'

interface SessionTabsProps {
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onSessionClose: (sessionId: string) => void
  onNewSession: () => void
}

export function SessionTabs({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionClose,
  onNewSession
}: SessionTabsProps) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
      <div className="flex-1 overflow-x-auto">
        <div className="flex items-center gap-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-1.5",
                "border bg-background transition-all",
                "hover:bg-accent hover:text-accent-foreground",
                "cursor-pointer",
                activeSessionId === session.id && "bg-primary text-primary-foreground"
              )}
              onClick={() => onSessionSelect(session.id)}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="max-w-[150px] truncate text-sm">
                {session.title}
              </span>
              <span className="text-xs opacity-60">
                ({session.messages.length})
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onSessionClose(session.id)
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onNewSession}
        className="shrink-0"
      >
        <Plus className="mr-2 h-4 w-4" />
        Nova Sessão
      </Button>
    </div>
  )
}