import React from 'react'
import Editor from '@monaco-editor/react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { 
  Save, 
  Copy, 
  Download, 
  Maximize2, 
  Minimize2,
  FileCode,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  fileName?: string
  className?: string
}

export function CodeEditor({
  value,
  onChange,
  language = 'typescript',
  readOnly = false,
  fileName,
  className
}: CodeEditorProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const editorRef = React.useRef<any>(null)

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    
    // Add custom keybindings
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS
      ],
      run: () => {
        handleSave()
      }
    })
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Código copiado')
  }

  const handleSave = () => {
    if (onChange) {
      toast.success('Arquivo salvo')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || `code.${language}`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Arquivo baixado')
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const getLanguageFromFileName = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase()
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'md': 'markdown',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'dockerfile': 'dockerfile',
      'docker': 'dockerfile'
    }
    return languageMap[ext || ''] || 'plaintext'
  }

  const detectedLanguage = fileName 
    ? getLanguageFromFileName(fileName)
    : language

  return (
    <Card className={cn(
      "overflow-hidden",
      isFullscreen && "fixed inset-4 z-50",
      className
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          {fileName && (
            <span className="text-sm font-medium">{fileName}</span>
          )}
          <span className="rounded bg-muted px-2 py-0.5 text-xs">
            {detectedLanguage}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className="h-8 w-8"
              title="Salvar (Ctrl+S)"
            >
              <Save className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8"
            title="Copiar código"
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
            onClick={handleDownload}
            className="h-8 w-8"
            title="Baixar arquivo"
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8"
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className={cn(
        "relative",
        isFullscreen ? "h-[calc(100%-48px)]" : "h-[400px]"
      )}>
        <Editor
          height="100%"
          language={detectedLanguage}
          value={value}
          onChange={(newValue) => onChange?.(newValue || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: isFullscreen },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabSize: 2,
            insertSpaces: true,
            folding: true,
            bracketPairColorization: {
              enabled: true
            }
          }}
        />
      </div>
    </Card>
  )
}