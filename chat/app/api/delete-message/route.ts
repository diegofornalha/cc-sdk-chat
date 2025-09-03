import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, messageIndex, projectPath } = await request.json();
    
    if (!sessionId || messageIndex === undefined || !projectPath) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Constrói o caminho completo para o arquivo JSONL
    const homeDir = os.homedir();
    const filePath = path.join(homeDir, '.claude', 'projects', projectPath, `${sessionId}.jsonl`);
    
    console.log('🗑️ Deletando mensagem:', {
      filePath,
      messageIndex,
      sessionId
    });

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Session file not found' },
        { status: 404 }
      );
    }

    // Lê todas as linhas do arquivo
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`📄 Arquivo tem ${lines.length} linhas`);
    
    // Processa as linhas para identificar mensagens
    const messages = [];
    const otherLines = [];
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        // Identifica linhas que são mensagens
        if (data.type === 'user' || data.type === 'assistant' || 
            (data.message && (data.message.role === 'user' || data.message.role === 'assistant'))) {
          messages.push(line);
        } else {
          otherLines.push(line);
        }
      } catch {
        // Se não for JSON válido, mantém a linha
        otherLines.push(line);
      }
    }
    
    console.log(`📨 Encontradas ${messages.length} mensagens`);
    
    // Verifica se o índice é válido
    if (messageIndex < 0 || messageIndex >= messages.length) {
      return NextResponse.json(
        { error: 'Invalid message index' },
        { status: 400 }
      );
    }
    
    // Remove a mensagem do índice especificado
    const deletedMessage = messages[messageIndex];
    messages.splice(messageIndex, 1);
    
    console.log(`🗑️ Deletando mensagem no índice ${messageIndex}`);
    
    // Reconstrói o arquivo sem a mensagem deletada
    const newContent = [...otherLines, ...messages].join('\n');
    
    // Escreve o novo conteúdo diretamente (sem backup)
    fs.writeFileSync(filePath, newContent + '\n');
    
    console.log('✅ Mensagem deletada com sucesso');
    
    return NextResponse.json({
      success: true,
      deletedIndex: messageIndex,
      remainingMessages: messages.length
    });
    
  } catch (error) {
    console.error('❌ Erro ao deletar mensagem:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}