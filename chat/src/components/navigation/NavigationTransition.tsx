import React from 'react'
import { ArrowRight, MessageSquare } from 'lucide-react'
import { Card } from '../ui/card'

interface NavigationTransitionProps {
  isVisible: boolean
  fromContext: string
  toContext: string
  message?: string
}

export function NavigationTransition({
  isVisible,
  fromContext,
  toContext,
  message
}: NavigationTransitionProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="p-8 max-w-md w-full mx-4 animate-in zoom-in-50 duration-300">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <MessageSquare className="h-5 w-5" />
              <span className="text-sm">{fromContext}</span>
            </div>
            
            <div className="relative">
              <ArrowRight className="h-6 w-6 text-blue-500 animate-pulse" />
              <div className="absolute inset-0 h-6 w-6 bg-blue-500/20 rounded-full animate-ping" />
            </div>
            
            <div className="flex items-center space-x-2 text-foreground">
              <MessageSquare className="h-5 w-5" />
              <span className="text-sm font-medium">{toContext}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '100%' }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Navegando automaticamente...
            </p>
            {message && (
              <p className="text-xs text-muted-foreground mt-2">
                "{message.substring(0, 50)}..."
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}