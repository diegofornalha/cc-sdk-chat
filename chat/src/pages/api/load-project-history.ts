import { NextApiRequest, NextApiResponse } from 'next'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

interface ProjectHistoryRequest {
  projectPath: string
  primarySessionId: string
}

interface ParsedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  tokens?: { input?: number; output?: number }
  cost?: number
}

interface SessionData {
  id: string
  messages: ParsedMessage[]
  cwd?: string
  origin?: string
  createdAt?: string
  title?: string
  total_messages: number
  first_message_time: string
  last_message_time: string
  total_tokens: number
  total_cost: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { projectPath, primarySessionId }: ProjectHistoryRequest = req.body

    if (!projectPath || !primarySessionId) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // 🔗 CORREÇÃO: Detecta projeto pai - busca em diretórios relacionados
    const projectPaths = [projectPath]
    
    // Adiciona variações do path (com/sem sufixos -chat)
    if (projectPath.includes('cc-sdk-chat')) {
      const basePath = projectPath.replace(/-chat$/, '')
      const chatPath = basePath + '-chat'
      
      if (basePath !== projectPath) projectPaths.push(basePath)
      if (chatPath !== projectPath) projectPaths.push(chatPath)
    }

    const sessions: SessionData[] = []
    let totalFiles = 0

    // Processa TODOS os paths relacionados
    for (const currentPath of projectPaths) {
      try {
        const files = await readdir(currentPath)
        const jsonlFiles = files.filter(file => file.endsWith('.jsonl'))
        totalFiles += jsonlFiles.length
        
        // Processa cada arquivo JSONL do path atual
        for (const file of jsonlFiles) {
          try {
            const filePath = join(currentPath, file)
            const content = await readFile(filePath, 'utf-8')
            const lines = content.trim().split('\n').filter(line => line.trim())

            const sessionId = file.replace('.jsonl', '')
            const messages: ParsedMessage[] = []
            let cwd: string | undefined
            let origin: string | undefined

            for (const line of lines) {
              try {
                const data = JSON.parse(line)
                
                // Extrai CWD da primeira mensagem
                if (!cwd && data.cwd) {
                  cwd = data.cwd
                }

                // Determina origem baseado no tipo de conversa
                if (!origin) {
                  if (data.type === 'summary') {
                    origin = 'SDK Web'
                  } else if (data.userType === 'external') {
                    origin = 'Terminal'
                  }
                }

                // Processa mensagens de usuário e assistente
                if (data.type === 'user' && data.message) {
                  messages.push({
                    id: data.uuid,
                    role: 'user',
                    content: data.message.content,
                    timestamp: data.timestamp
                  })
                } else if (data.type === 'assistant' && data.message) {
                  const content = Array.isArray(data.message.content) 
                    ? data.message.content
                        .filter((c: any) => c.type === 'text')
                        .map((c: any) => c.text)
                        .join('')
                    : data.message.content

                  messages.push({
                    id: data.uuid,
                    role: 'assistant',
                    content,
                    timestamp: data.timestamp,
                    tokens: data.message.usage ? {
                      input: data.message.usage.input_tokens,
                      output: data.message.usage.output_tokens
                    } : undefined
                  })
                }
              } catch (parseError) {
                // Ignora linhas malformadas
                continue
              }
            }

            if (messages.length > 0) {
              // Calcula estatísticas da sessão
              const totalTokens = messages.reduce((total, msg) => 
                total + (msg.tokens?.input || 0) + (msg.tokens?.output || 0), 0
              );
              
              const totalCost = messages.reduce((total, msg) => 
                total + (msg.cost || 0), 0
              );

              const timestamps = messages.map(msg => new Date(msg.timestamp).getTime());
              const firstTime = Math.min(...timestamps);
              const lastTime = Math.max(...timestamps);

              sessions.push({
                id: sessionId,
                messages,
                cwd,
                origin: origin || 'Claude Code',
                createdAt: messages[0]?.timestamp,
                title: `${origin || 'Claude Code'} (${sessionId.slice(-8)})`,
                total_messages: messages.length,
                first_message_time: new Date(firstTime).toISOString(),
                last_message_time: new Date(lastTime).toISOString(),
                total_tokens: totalTokens,
                total_cost: totalCost
              })
            }
          } catch (fileError) {
            console.error(`Erro ao processar ${file}:`, fileError)
            continue
          }
        }
      } catch (dirError) {
        console.error(`Erro ao acessar diretório ${currentPath}:`, dirError)
        continue
      }
    }

    // Ordena sessões por data de criação
    sessions.sort((a, b) => 
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    )

    const isSingleSession = totalFiles === 1

    res.status(200).json({ 
      sessions,
      isSingleSession,
      continuationMode: isSingleSession ? 'extend' : 'cross-reference',
      totalFiles,
      searchedPaths: projectPaths
    })
  } catch (error) {
    console.error('Erro ao carregar histórico do projeto:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}