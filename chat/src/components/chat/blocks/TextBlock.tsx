import React from 'react'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import { cn } from '@/lib/utils'

interface TextBlockProps {
  content: string
  className?: string
}

export function TextBlock({ content, className }: TextBlockProps) {
  const html = React.useMemo(() => {
    return marked(content, { 
      breaks: true,
      gfm: true
    })
  }, [content])

  return (
    <div 
      className={cn(
        "markdown-content prose prose-sm dark:prose-invert max-w-none",
        "text-sm leading-relaxed",
        className
      )}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  )
}