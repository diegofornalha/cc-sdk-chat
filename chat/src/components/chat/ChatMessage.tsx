import React from 'react'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import { Copy, Check, User, Bot, Code, Terminal, FileText, Brain, Wrench, Star } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { cn, formatTokens, formatCost } from '@/lib/utils'
import { useRouter } from 'next/navigation'

// Tipos para os blocos de conteúdo
interface TextBlock {
  text: string
}

interface ThinkingBlock {
  thinking: string
  signature: string
}

interface ToolUseBlock {
  id: string
  name: string
  input: { [key: string]: any }
}

interface ToolResultBlock {
  tool_use_id: string
  content?: string | Array<{ [key: string]: any }> | null
  is_error?: boolean | null
}

type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock

// Componentes individuais para cada tipo de bloco - Memoizados para performance
const TextBlockComponent: React.FC<{ block: TextBlock }> = React.memo(({ block }) => {
  const html = React.useMemo(() => marked(block.text, { 
    breaks: true,
    gfm: true
  }), [block.text])

  return (
    <div 
      className="markdown-content prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  )
})

const ThinkingBlockComponent: React.FC<{ block: ThinkingBlock }> = React.memo(({ block }) => {
  return (
    <div className="thinking-block border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 pl-4 py-3 my-3 rounded-r-lg">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Pensamento
        </span>
        <span className="text-xs text-muted-foreground">
          {block.signature}
        </span>
      </div>
      <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
        {block.thinking}
      </div>
    </div>
  )
})

const ToolUseBlockComponent: React.FC<{ block: ToolUseBlock }> = React.memo(({ block }) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null)

  // Mapeamento de cores por ferramenta
  const toolColorMap: Record<string, { bg: string; text: string; border: string; accent: string }> = {
    'Read': { 
      bg: 'bg-blue-50 dark:bg-blue-900/20', 
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-400',
      accent: 'text-blue-600 dark:text-blue-400'
    },
    'Write': { 
      bg: 'bg-green-50 dark:bg-green-900/20', 
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-400',
      accent: 'text-green-600 dark:text-green-400'
    },
    'Edit': { 
      bg: 'bg-amber-50 dark:bg-amber-900/20', 
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-400',
      accent: 'text-amber-600 dark:text-amber-400'
    },
    'MultiEdit': { 
      bg: 'bg-orange-50 dark:bg-orange-900/20', 
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-400',
      accent: 'text-orange-600 dark:text-orange-400'
    },
    'Bash': { 
      bg: 'bg-gray-50 dark:bg-gray-900/20', 
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-400',
      accent: 'text-gray-600 dark:text-gray-400'
    },
    'Grep': { 
      bg: 'bg-purple-50 dark:bg-purple-900/20', 
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-400',
      accent: 'text-purple-600 dark:text-purple-400'
    },
    'Glob': { 
      bg: 'bg-indigo-50 dark:bg-indigo-900/20', 
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-400',
      accent: 'text-indigo-600 dark:text-indigo-400'
    },
    'Task': { 
      bg: 'bg-pink-50 dark:bg-pink-900/20', 
      text: 'text-pink-700 dark:text-pink-300',
      border: 'border-pink-400',
      accent: 'text-pink-600 dark:text-pink-400'
    },
    'WebFetch': { 
      bg: 'bg-cyan-50 dark:bg-cyan-900/20', 
      text: 'text-cyan-700 dark:text-cyan-300',
      border: 'border-cyan-400',
      accent: 'text-cyan-600 dark:text-cyan-400'
    },
    'WebSearch': { 
      bg: 'bg-teal-50 dark:bg-teal-900/20', 
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-400',
      accent: 'text-teal-600 dark:text-teal-400'
    }
  }

  const defaultToolColor = {
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-400',
    accent: 'text-slate-600 dark:text-slate-400'
  }

  const toolColors = toolColorMap[block.name] || defaultToolColor

  const handleCopy = async (content: string, section: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedSection(section)
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  const formatContent = (content: any): string => {
    if (typeof content === 'string') return content
    return JSON.stringify(content, null, 2)
  }

  // Formata o nome da ferramenta MCP de forma mais amigável
  const formatToolName = (name: string): string => {
    // Remove prefixo mcp__ e substitui underscores duplos
    if (name.startsWith('mcp__')) {
      const parts = name.substring(5).split('__')
      if (parts.length > 1) {
        // Ex: neo4j-memory__search_memories -> neo4j-memory: search memories
        return `${parts[0]}: ${parts[1].replace(/_/g, ' ')}`
      }
      return parts[0].replace(/_/g, ' ')
    }
    return name
  }

  return (
    <div className={`tool-use-block ${toolColors.bg} rounded-lg my-3 transition-all duration-300 shadow-sm hover:shadow-md border ${toolColors.border}`}>
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-t-lg" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${toolColors.text}`}>
            Usando ferramenta: {formatToolName(block.name)}
          </span>
          <span className="text-xs text-muted-foreground ml-auto mr-2">
            ID: {block.id.slice(-8)}
          </span>
          <span className="text-xs text-muted-foreground transition-transform duration-200">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>
      
      {isExpanded && block.input && Object.keys(block.input).length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              📥 Parâmetros
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCopy(formatContent(block.input), 'input')
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedSection === 'input' ? '✓ Copiado' : '📋 Copiar'}
            </button>
          </div>
          <pre className="text-xs bg-muted/30 dark:bg-muted/10 p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono border border-border/50">
            {formatContent(block.input)}
          </pre>
        </div>
      )}
    </div>
  )
})

const ToolResultBlockComponent: React.FC<{ block: ToolResultBlock }> = React.memo(({ block }) => {
  const [copied, setCopied] = React.useState(false)
  const [showAllFiles, setShowAllFiles] = React.useState(false) // Para listas longas de arquivos
  const isError = block.is_error || false
  const borderColor = isError ? 'border-red-400' : 'border-green-400'
  const bgColor = isError ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'
  const textColor = isError ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
  const accentColor = isError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'

  // Detecta se o conteúdo é uma lista de arquivos
  const isFileList = React.useMemo(() => {
    if (typeof block.content !== 'string') return false
    const lines = block.content.split('\n').filter(line => line.trim())
    
    // Verifica se é uma listagem de diretório (ls -la ou dir)
    const isDirectoryListing = lines.some(line => 
      line.startsWith('total ') || 
      line.match(/^[drwx-]{10}/) || // Unix permissions
      line.match(/^\d{2}\/\d{2}\/\d{4}/) // Windows date format
    )
    
    // Verifica se parece uma lista de caminhos de arquivo
    const isPathList = lines.length > 3 && lines.every(line => 
      line.includes('/') || line.includes('\\') || line.includes('.')
    )
    
    return isDirectoryListing || isPathList
  }, [block.content])

  // Processa lista de arquivos para melhor visualização
  const processFileList = React.useCallback((content: string) => {
    const lines = content.split('\n').filter(line => line.trim())
    const MAX_VISIBLE = 5
    
    // Detecta se é uma listagem de diretório detalhada (ls -la)
    const isDetailedListing = lines.some(line => 
      line.startsWith('total ') || line.match(/^[drwx-]{10}/)
    )
    
    if (isDetailedListing) {
      // Processa listagem detalhada
      const files: Array<{name: string; type: string; size?: string; date?: string; permissions?: string}> = []
      
      lines.forEach(line => {
        // Pula linha "total"
        if (line.startsWith('total ')) return
        
        // Parse de linha Unix (drwxr-xr-x@ 7 2a staff 224 Sep 11 06:34 filename)
        const unixMatch = line.match(/^([drwx-]{10})\s+\d+\s+\w+\s+\w+\s+(\d+)\s+(\w+\s+\d+\s+[\d:]+)\s+(.+)$/)
        if (unixMatch) {
          const [, permissions, size, date, name] = unixMatch
          files.push({
            name,
            type: permissions[0] === 'd' ? 'dir' : 'file',
            size,
            date,
            permissions
          })
        } else if (line.trim()) {
          // Fallback para outros formatos
          files.push({ name: line.trim(), type: 'file' })
        }
      })
      
      return {
        total: files.length,
        visible: showAllFiles ? files : files.slice(0, MAX_VISIBLE),
        hasMore: files.length > MAX_VISIBLE,
        isDetailed: true,
        files
      }
    } else {
      // Processa lista simples de caminhos
      const filesByDir = new Map<string, string[]>()
      
      lines.forEach(line => {
        const path = line.trim()
        const lastSlash = path.lastIndexOf('/')
        if (lastSlash > -1) {
          const dir = path.substring(0, lastSlash)
          const file = path.substring(lastSlash + 1)
          if (!filesByDir.has(dir)) {
            filesByDir.set(dir, [])
          }
          filesByDir.get(dir)!.push(file)
        } else {
          // Arquivo sem diretório
          if (!filesByDir.has('.')) {
            filesByDir.set('.', [])
          }
          filesByDir.get('.')!.push(path)
        }
      })
      
      return {
        total: lines.length,
        visible: showAllFiles ? lines : lines.slice(0, MAX_VISIBLE),
        hasMore: lines.length > MAX_VISIBLE,
        filesByDir,
        allFiles: lines,
        isDetailed: false
      }
    }
  }, [showAllFiles])

  const handleCopy = async () => {
    try {
      const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2)
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  const formatContent = (content: any): string => {
    if (typeof content === 'string') return content
    
    // Se for um array de objetos, formata cada um em uma linha
    if (Array.isArray(content)) {
      return content.map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // Formata cada objeto de forma compacta mas legível
          const formatted = Object.entries(item).map(([key, value]) => 
            `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`
          ).join(', ')
          return `${index + 1}. ${formatted}`
        }
        return JSON.stringify(item, null, 2)
      }).join('\n')
    }
    
    return JSON.stringify(content, null, 2)
  }

  // Conta quantos itens tem no resultado
  const itemCount = Array.isArray(block.content) ? block.content.length : null
  
  // Detecta se o conteúdo é código ou texto de edição
  const isCodeContent = typeof block.content === 'string' && 
    (block.content.includes('Applied') || 
     block.content.includes('edits to') || 
     block.content.includes('Replaced') ||
     block.content.includes('with'))
  
  // Detecta se é um snippet de código com números de linha
  const isCodeSnippet = React.useMemo(() => {
    if (typeof block.content !== 'string') return false
    const lines = block.content.split('\n')
    // Verifica se tem padrão de números de linha (ex: "   123→" ou "  1: ")
    const hasLineNumbers = lines.some(line => 
      line.match(/^\s*\d+[→:]\s/) || // Formato com → ou :
      line.match(/^\s*\d+\s+\|/) // Formato com |
    )
    // Também verifica se menciona "result of running cat -n" ou "has been updated"
    const hasCatReference = block.content.includes('result of running') && 
                           (block.content.includes('cat -n') || block.content.includes('snippet'))
    const hasUpdateMessage = block.content.includes('has been updated') && 
                            block.content.includes('Here\'s the result')
    
    return hasLineNumbers || hasCatReference || hasUpdateMessage
  }, [block.content])
  
  // Decide se deve começar expandido ou colapsado
  const [isExpanded, setIsExpanded] = React.useState(() => {
    // Snippets de código e listas de arquivos começam colapsados
    if (isCodeSnippet || isFileList) return false
    // Outros resultados começam expandidos
    return false // Mudando para sempre começar colapsado
  })
  
  // Para resultados de edição, extrai informações úteis
  const getEditSummary = () => {
    if (!isCodeContent || typeof block.content !== 'string') return null
    
    const match = block.content.match(/Applied (\d+) edits? to (.+):$/m)
    if (match) {
      return {
        count: match[1],
        file: match[2].split('/').pop() // Pega apenas o nome do arquivo
      }
    }
    return null
  }
  
  const editSummary = getEditSummary()

  // Processa dados da lista de arquivos se aplicável
  const fileListData = isFileList && typeof block.content === 'string' 
    ? processFileList(block.content)
    : null

  return (
    <div className={`tool-result-block ${bgColor} rounded-lg my-3 transition-all duration-300 shadow-sm border ${borderColor}`}>
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${textColor}`}>
            {isFileList ? '📁 Arquivos' : '📋 Resultado'}
          </span>
          {editSummary ? (
            <>
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                ✅ {editSummary.count} {parseInt(editSummary.count) === 1 ? 'edição' : 'edições'}
              </span>
              <span className="text-xs text-muted-foreground">
                em {editSummary.file}
              </span>
            </>
          ) : fileListData ? (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
              {fileListData.total} {fileListData.total === 1 ? 'arquivo' : 'arquivos'}
            </span>
          ) : itemCount !== null ? (
            <span className="text-xs bg-muted px-2 py-1 rounded-full">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </span>
          ) : null}
          {isError && (
            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
              Erro
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto mr-2">
            ID: {block.tool_use_id.slice(-8)}
          </span>
          <span className="text-xs text-muted-foreground transition-transform duration-200">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>
      
      {isExpanded && block.content && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {fileListData ? '📂 Conteúdo' : '📤 Conteúdo'}
            </span>
            <div className="flex items-center gap-2">
              {fileListData && fileListData.hasMore && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowAllFiles(!showAllFiles)
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showAllFiles ? 'Mostrar menos' : `Mostrar todos (${fileListData.total})`}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopy()
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? '✓ Copiado' : '📋 Copiar'}
              </button>
            </div>
          </div>
          {fileListData ? (
            <div className="bg-muted/30 dark:bg-muted/10 p-3 rounded-md border border-border/50">
              {fileListData.isDetailed ? (
                // Renderização para listagem detalhada (ls -la)
                <div className="space-y-1 font-mono text-xs">
                  {fileListData.visible.map((file: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2 transition-colors">
                      <span className={file.type === 'dir' ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}>
                        {file.type === 'dir' ? '📁' : '📄'} {file.name}
                      </span>
                      {file.size && (
                        <span className="text-muted-foreground ml-auto text-xs">
                          {parseInt(file.size) > 1024 ? `${(parseInt(file.size) / 1024).toFixed(1)}K` : `${file.size}B`}
                        </span>
                      )}
                      {file.date && (
                        <span className="text-muted-foreground text-xs">{file.date}</span>
                      )}
                    </div>
                  ))}
                  {fileListData.hasMore && !showAllFiles && (
                    <div className="text-center text-muted-foreground text-xs pt-2 border-t border-border/50">
                      ... e mais {fileListData.total - 5} arquivos
                    </div>
                  )}
                </div>
              ) : fileListData.filesByDir ? (
                // Renderização para lista de caminhos agrupados
                <div className="space-y-2 font-mono text-xs">
                  {Array.from(fileListData.filesByDir.entries()).slice(0, showAllFiles ? undefined : 3).map(([dir, files], idx) => (
                    <div key={idx}>
                      <div className="text-muted-foreground mb-1">📁 {dir === '.' ? '(raiz)' : dir}</div>
                      <div className="pl-4 space-y-0.5">
                        {files.slice(0, showAllFiles ? undefined : 2).map((file, fileIdx) => (
                          <div key={fileIdx} className="text-foreground">📄 {file}</div>
                        ))}
                        {!showAllFiles && files.length > 2 && (
                          <div className="text-muted-foreground">... +{files.length - 2} arquivos</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {fileListData.hasMore && !showAllFiles && (
                    <div className="text-center text-muted-foreground text-xs pt-2 border-t border-border/50">
                      Mostrando {5} de {fileListData.total} arquivos
                    </div>
                  )}
                </div>
              ) : (
                // Fallback para lista simples
                <div className="space-y-0.5 font-mono text-xs">
                  {fileListData.visible.map((path: string, idx: number) => (
                    <div key={idx} className="text-foreground">{path}</div>
                  ))}
                  {fileListData.hasMore && !showAllFiles && (
                    <div className="text-center text-muted-foreground text-xs pt-2 border-t border-border/50">
                      ... e mais {fileListData.total - 5} arquivos
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isCodeSnippet ? (
            // Renderização para snippets de código com números de linha
            <div className="bg-gray-900 dark:bg-gray-950 p-3 rounded-md border border-gray-700 overflow-x-auto">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
                <span className="text-xs text-gray-400 font-mono">
                  📝 {(() => {
                    // Tenta extrair o nome do arquivo do conteúdo
                    const fileMatch = block.content.match(/The file ([\w\/\.-]+) has been updated/) ||
                                     block.content.match(/file[:\s]+([\w\/\.-]+)/i)
                    if (fileMatch) {
                      const path = fileMatch[1]
                      const fileName = path.split('/').pop()
                      return `Código: ${fileName}`
                    }
                    return 'Snippet de Código'
                  })()}
                </span>
                {!showAllFiles && block.content.split('\n').length > 10 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAllFiles(!showAllFiles)
                    }}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {showAllFiles ? 'Mostrar menos' : 'Expandir código'}
                  </button>
                )}
              </div>
              <pre className="text-xs font-mono">
                {(() => {
                  const lines = block.content.split('\n')
                  
                  // Filtra linhas que são código (com números de linha)
                  let codeLines = lines.filter(line => 
                    line.match(/^\s*\d+[→:]\s/) || 
                    line.match(/^\s*\d+\s+\|/)
                  )
                  
                  // Se não encontrou linhas com padrão específico, pega todas exceto headers
                  if (codeLines.length === 0) {
                    codeLines = lines.filter(line => 
                      line.trim() && 
                      !line.includes('The file') && 
                      !line.includes('has been updated') &&
                      !line.includes('result of running')
                    )
                  }
                  
                  // Se não está expandido, mostra apenas primeiras e últimas linhas
                  const linesToShow = showAllFiles ? codeLines : [
                    ...codeLines.slice(0, 5),
                    ...(codeLines.length > 10 ? ['...'] : []),
                    ...(codeLines.length > 10 ? codeLines.slice(-3) : codeLines.slice(5, 10))
                  ]
                  
                  return linesToShow.map((line, idx) => {
                    if (line === '...') {
                      return (
                        <div key={idx} className="text-gray-500 text-center py-1">
                          ··· {codeLines.length - 8} linhas ocultas ···
                        </div>
                      )
                    }
                    
                    // Formata linha de código
                    const match = line.match(/^(\s*)(\d+)([→:|\s]+)(.*)$/)
                    if (match) {
                      const [, spaces, lineNum, separator, code] = match
                      return (
                        <div key={idx} className="hover:bg-gray-800/50 px-1 rounded">
                          <span className="text-gray-500">{spaces}{lineNum.padStart(4)}{separator}</span>
                          <span className="text-gray-300">{code}</span>
                        </div>
                      )
                    }
                    return <div key={idx} className="text-gray-300">{line}</div>
                  })
                })()}
              </pre>
            </div>
          ) : isCodeContent ? (
            <div className="bg-muted/30 dark:bg-muted/10 p-3 rounded-md border border-border/50 space-y-2">
              {formatContent(block.content).split('\n').map((line, idx) => {
                // Diferentes estilos para diferentes tipos de linha
                let lineStyle = 'text-xs font-mono text-muted-foreground'
                let prefix = ''
                let lineContent = line.trim()
                
                // Título principal: "Applied X edits to file:"
                if (line.includes('Applied') && line.includes('edits to')) {
                  lineStyle = 'text-sm font-mono font-bold text-green-600 dark:text-green-400 border-b border-green-200 dark:border-green-800 pb-2 mb-2'
                  prefix = '✅ '
                } 
                // Linhas numeradas (1. 2. 3. etc)
                else if (line.match(/^\d+\./)) {
                  const parts = line.match(/^(\d+)\.\s*(.*)\$/)
                  if (parts) {
                    const num = parts[1]
                    lineContent = parts[2]
                    
                    // Diferenciação visual baseada no conteúdo
                    if (lineContent.includes('Replaced')) {
                      lineStyle = 'text-xs font-mono text-blue-600 dark:text-blue-400 pl-4 py-1 bg-blue-50/50 dark:bg-blue-950/20 rounded'
                      prefix = `${num.padStart(2)}. ↔️ `
                    } else {
                      lineStyle = 'text-xs font-mono text-foreground pl-4'
                      prefix = `${num.padStart(2)}. `
                    }
                  }
                } 
                // Linhas "with" (continuação de Replaced)
                else if (line.trim().startsWith('with')) {
                  lineStyle = 'text-xs font-mono text-amber-600 dark:text-amber-400 pl-12 py-1 bg-amber-50/50 dark:bg-amber-950/20 rounded ml-8 mt-1'
                  prefix = '➜ '
                }
                // Strings quoted (removidas de edições)
                else if (line.includes('"') && (line.includes('Replaced') || line.includes('with'))) {
                  if (line.includes('Replaced')) {
                    lineStyle = 'text-xs font-mono text-blue-600 dark:text-blue-400 pl-8'
                    prefix = '↔️ '
                  } else {
                    lineStyle = 'text-xs font-mono text-amber-600 dark:text-amber-400 pl-8'
                    prefix = '➜ '
                  }
                }
                
                // Adiciona espaçamento entre diferentes edições
                const isNewEdit = line.match(/^\d+\./) && parseInt(line.match(/^(\d+)/)![1]) > 1
                const spacing = isNewEdit ? 'mt-3' : ''
                
                return lineContent ? (
                  <div key={idx} className={`${lineStyle} ${spacing}`}>
                    {prefix}{lineContent}
                  </div>
                ) : null
              })}
            </div>
          ) : (
            <pre className="text-xs bg-muted/30 dark:bg-muted/10 p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono border border-border/50">
              {formatContent(block.content)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
})

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system'
  content: string | { type: string; text?: string; thinking?: string } | Array<ContentBlock | any>
  timestamp?: Date
  tokens?: { input?: number; output?: number }
  cost?: number
  tools?: string[]
  isStreaming?: boolean
  sessionTitle?: string
  sessionId?: string
  sessionOrigin?: string
}

export function ChatMessage({
  role,
  content,
  timestamp,
  tokens,
  cost,
  tools,
  isStreaming = false,
  sessionTitle,
  sessionId,
  sessionOrigin
}: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false)
  const [favorited, setFavorited] = React.useState(false)
  const messageRef = React.useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Gerar ID único para esta mensagem baseado no conteúdo
  const messageId = React.useMemo(() => {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content)
    // Usar hash simples ao invés de btoa para suportar Unicode
    let hash = 0
    for (let i = 0; i < Math.min(contentStr.length, 100); i++) {
      const char = contentStr.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return `msg_${Math.abs(hash)}_${role}_${timestamp?.getTime() || Date.now()}`
  }, [content, role, timestamp])

  // Verificar se esta mensagem já foi favoritada (localStorage)
  React.useEffect(() => {
    const favoritedMessages = JSON.parse(localStorage.getItem('favoritedMessages') || '[]')
    if (favoritedMessages.includes(messageId)) {
      setFavorited(true)
    }
  }, [messageId])
  
  // Debug desabilitado - apenas para debugging específico quando necessário
  // Removido para prevenir loops infinitos de logging

  // Função para verificar se um item é um bloco específico
  const isTextBlock = (item: any): item is TextBlock => {
    return item && typeof item.text === 'string' && !item.thinking && !item.id
  }

  const isThinkingBlock = (item: any): item is ThinkingBlock => {
    return item && typeof item.thinking === 'string' && typeof item.signature === 'string'
  }

  const isToolUseBlock = (item: any): item is ToolUseBlock => {
    return item && typeof item.id === 'string' && typeof item.name === 'string' && item.input
  }

  const isToolResultBlock = (item: any): item is ToolResultBlock => {
    return item && typeof item.tool_use_id === 'string'
  }

  // Memoizar o processamento do conteúdo para evitar recálculos desnecessários
  const processedContent = React.useMemo(() => {
    const processMessageContent = (content: any): string => {
      if (typeof content === 'string') {
        return content;
      }
      
      if (Array.isArray(content)) {
        return content.map((item) => {
          // Compatibilidade com formato anterior
          if (item.type === 'text') return item.text;
          if (item.type === 'thinking') return `💭 ${item.thinking}`;
          
          // Novos tipos de bloco
          if (isTextBlock(item)) return item.text;
          if (isThinkingBlock(item)) return `💭 ${item.thinking}`;
          if (isToolUseBlock(item)) return `🔧 Usando ${item.name}`;
          if (isToolResultBlock(item)) {
            if (Array.isArray(item.content)) {
              return `📋 Resultado: ${item.content.length} itens`;
            }
            return `📋 Resultado: ${typeof item.content === 'object' ? JSON.stringify(item.content) : (item.content || 'N/A')}`;
          }
          
          return JSON.stringify(item);
        }).join('\n\n');
      }
      
      // Compatibilidade com formato anterior
      if (content.type === 'text') return content.text;
      if (content.type === 'thinking') return `💭 ${content.thinking}`;
      
      return JSON.stringify(content, null, 2);
    };
    
    return processMessageContent(content);
  }, [content]);

  // Memoizar função de cópia para evitar recriação a cada render
  const getContentForCopy = React.useCallback((): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content.map((item) => {
        // Compatibilidade com formato anterior
        if (item.type === 'text') return item.text;
        if (item.type === 'thinking') return `=== PENSAMENTO ===\n${item.thinking}`;
        
        // Novos tipos de bloco
        if (isTextBlock(item)) return item.text;
        if (isThinkingBlock(item)) return `=== PENSAMENTO ===\n${item.thinking}`;
        if (isToolUseBlock(item)) {
          return `=== USO DE FERRAMENTA: ${item.name} ===\nID: ${item.id}\nParâmetros:\n${JSON.stringify(item.input, null, 2)}`;
        }
        if (isToolResultBlock(item)) {
          const status = item.is_error ? 'ERRO' : 'SUCESSO';
          return `=== RESULTADO DA FERRAMENTA (${status}) ===\nID: ${item.tool_use_id}\n${typeof item.content === 'string' ? item.content : JSON.stringify(item.content, null, 2)}`;
        }
        
        return JSON.stringify(item, null, 2);
      }).join('\n\n');
    }
    
    return processedContent;
  }, [content, processedContent]);

  const handleCopy = React.useCallback(async () => {
    const contentToCopy = getContentForCopy();
    await navigator.clipboard.writeText(contentToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [getContentForCopy])

  const handleFavorite = React.useCallback(async () => {
    try {
      // Toggle favorito
      const newFavoritedState = !favorited

      if (newFavoritedState) {
        // Adicionar aos favoritos
        const favoritesSessionId = '00000000-0000-0000-0000-000000000002'

        // Preparar conteúdo para a sessão favorita
        const favoriteContent = {
          role,
          content: getContentForCopy(),
          timestamp: timestamp || new Date(),
          metadata: {
            originalSessionId: sessionId,
            originalSessionTitle: sessionTitle,
            favoritedAt: new Date().toISOString(),
            messageId: messageId
          }
        }

        // Salvar nos favoritos
        const response = await fetch('/api/sessions/favorite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: favoritesSessionId,
            message: favoriteContent
          })
        })

        if (response.ok) {
          // Atualizar estado e localStorage
          setFavorited(true)
          const favoritedMessages = JSON.parse(localStorage.getItem('favoritedMessages') || '[]')
          favoritedMessages.push(messageId)
          localStorage.setItem('favoritedMessages', JSON.stringify(favoritedMessages))

          console.log('✅ Mensagem adicionada aos favoritos!')
        } else {
          console.error('Erro ao favoritar mensagem')
        }
      } else {
        // Remover dos favoritos (apenas do localStorage, não do arquivo)
        setFavorited(false)
        const favoritedMessages = JSON.parse(localStorage.getItem('favoritedMessages') || '[]')
        const filtered = favoritedMessages.filter((id: string) => id !== messageId)
        localStorage.setItem('favoritedMessages', JSON.stringify(filtered))

        console.log('⭐ Mensagem removida dos favoritos (localmente)')
      }
    } catch (error) {
      console.error('Erro ao favoritar mensagem:', error)
    }
  }, [favorited, role, getContentForCopy, sessionId, sessionTitle, timestamp, messageId])

  const getIcon = () => {
    switch (role) {
      case 'user':
        return <User className="h-5 w-5" />
      case 'assistant':
        return <Bot className="h-5 w-5" />
      default:
        return null
    }
  }

  const getToolIcon = (tool: string) => {
    const icons: { [key: string]: JSX.Element } = {
      'Read': <FileText className="h-4 w-4" />,
      'Write': <FileText className="h-4 w-4" />,
      'Bash': <Terminal className="h-4 w-4" />,
      'Code': <Code className="h-4 w-4" />
    }
    return icons[tool] || <Code className="h-4 w-4" />
  }

  const renderContent = React.useMemo(() => {
    if (role === 'user') {
      return <p className="whitespace-pre-wrap">{processedContent}</p>
    }

    // Se o conteúdo é um array, renderizar cada bloco individualmente
    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item, index) => {
            // Compatibilidade com formato anterior
            if (item.type === 'text') {
              return <TextBlockComponent key={`text-${index}`} block={{ text: item.text }} />
            }
            if (item.type === 'thinking') {
              return <ThinkingBlockComponent key={`thinking-${index}`} block={{ thinking: item.thinking, signature: '' }} />
            }
            
            // Novos tipos de bloco
            if (isTextBlock(item)) {
              return <TextBlockComponent key={`textblock-${index}`} block={item} />
            }
            if (isThinkingBlock(item)) {
              return <ThinkingBlockComponent key={`thinkingblock-${index}`} block={item} />
            }
            if (isToolUseBlock(item)) {
              return <ToolUseBlockComponent key={`tooluse-${item.id || index}`} block={item} />
            }
            if (isToolResultBlock(item)) {
              return <ToolResultBlockComponent key={`toolresult-${item.tool_use_id || index}`} block={item} />
            }
            
            // Fallback para tipos desconhecidos
            return (
              <div key={`unknown-${index}`} className="bg-muted p-3 rounded">
                <pre className="text-sm">{JSON.stringify(item, null, 2)}</pre>
              </div>
            )
          })}
        </div>
      )
    }

    // Para assistente com conteúdo string, renderizar markdown
    const html = marked(processedContent, { 
      breaks: true,
      gfm: true
    })

    return (
      <div 
        className="markdown-content prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
      />
    )
  }, [role, content, processedContent])

  return (
    <div 
      ref={messageRef}
      className={cn(
        "group relative mb-6 animate-in fade-in slide-in-from-bottom-2",
        role === 'user' ? "ml-12" : "mr-12"
      )}
    >
      <div className={cn(
        "flex gap-3",
        role === 'user' && "flex-row-reverse"
      )}>
        {/* Avatar */}
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          role === 'user' 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}>
          {getIcon()}
        </div>

        {/* Message Content */}
        <Card className={cn(
          "flex-1 overflow-hidden",
          isStreaming && "animate-pulse"
        )}>
          <div className="p-4">
            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {role === 'user' ? 'Você' : (() => {
                    // Se já tem um sessionTitle customizado (como "Agente SutHub • Claude"), usa ele direto
                    if (sessionTitle && sessionTitle.includes('Agente SutHub')) {
                      return sessionTitle;
                    }
                    // Para outros casos, usa o formato padrão
                    const baseLabel = 'Claude';
                    if (sessionTitle && sessionTitle !== sessionId) return `${baseLabel} • ${sessionTitle}`;
                    if (sessionId && !sessionId.startsWith('temp-') && !sessionId.startsWith('project-')) {
                      return `${baseLabel} • ${sessionId.slice(-8)}`;
                    }
                    return baseLabel;
                  })()}
                  {sessionOrigin && sessionOrigin !== sessionId && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                      {sessionTitle}
                    </span>
                  )}
                </span>
                {timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {timestamp.toLocaleTimeString('pt-BR')}
                  </span>
                )}
                {tools && tools.length > 0 && (
                  <div className="flex items-center gap-1">
                    {tools.map((tool, i) => (
                      <span 
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                      >
                        {getToolIcon(tool)}
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!isStreaming && (
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className="h-8 w-8"
                    title="Copiar mensagem"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFavorite}
                    className="h-8 w-8"
                    title="Favoritar e criar sessão isolada"
                  >
                    {favorited ? (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="text-sm">
              {renderContent}
            </div>

            {/* Footer with metrics */}
            {(tokens || cost || sessionId) && !isStreaming && (
              <div className="mt-3 flex items-center gap-4 border-t pt-2 text-xs text-muted-foreground">
                {tokens && (
                  <span>Tokens: {formatTokens(tokens.input, tokens.output)}</span>
                )}
                {sessionId && !sessionId.startsWith('temp-') && !sessionId.startsWith('project-') && (
                  <span title={sessionId}>Sessão: {sessionId.slice(-8)}</span>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}