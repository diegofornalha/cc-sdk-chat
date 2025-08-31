import React from 'react'
import { cn } from '@/lib/utils'

interface ThinkingBlockProps {
  content: string
  className?: string
}

export function ThinkingBlock({ content, className }: ThinkingBlockProps) {
  return (
    <div className={cn("my-4 thinking-block", className)}>
      <details className="group">
        <summary className="cursor-pointer list-none flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors select-none">
          <span className="group-open:rotate-90 transition-transform duration-200">
            ▶
          </span>
          💡 Ver raciocínio
        </summary>
        
        <div className="thinking-content mt-3 pl-6 border-l-2 border-muted/50">
          <div className="text-sm text-muted-foreground italic whitespace-pre-wrap leading-relaxed bg-muted/20 rounded-md p-3">
            {content}
          </div>
        </div>
      </details>
    </div>
  )
}