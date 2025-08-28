import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`
}

export function formatTokens(input?: number, output?: number): string {
  if (!input && !output) return ""
  return `${input || 0}↑ ${output || 0}↓`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`
}