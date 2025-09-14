import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export async function POST(request: NextRequest) {
  try {
    const { id, message } = await request.json()

    if (!id || !message) {
      return NextResponse.json(
        { error: 'ID e mensagem são obrigatórios' },
        { status: 400 }
      )
    }

    // Caminho para o arquivo JSONL
    const homeDir = os.homedir()
    const projectsDir = path.join(homeDir, '.claude', 'projects')
    const sessionDir = path.join(projectsDir, '-Users-2a--claude-cc-sdk-chat-api')

    // Criar diretório se não existir
    await fs.mkdir(sessionDir, { recursive: true })

    const filePath = path.join(sessionDir, `${id}.jsonl`)

    // Preparar mensagem no formato JSONL
    const jsonlContent = JSON.stringify({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      metadata: message.metadata
    }) + '\n'

    // Escrever arquivo
    await fs.writeFile(filePath, jsonlContent, 'utf-8')

    return NextResponse.json({
      success: true,
      sessionId: id,
      path: filePath
    })
  } catch (error) {
    console.error('Erro ao criar sessão favorita:', error)
    return NextResponse.json(
      { error: 'Erro ao criar sessão favorita' },
      { status: 500 }
    )
  }
}