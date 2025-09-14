import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Se for a sessão de favoritos, ler do arquivo local
    if (sessionId === '00000000-0000-0000-0000-000000000002') {
      try {
        const homeDir = os.homedir();
        const filePath = path.join(
          homeDir,
          '.claude',
          'projects',
          '-Users-2a--claude-cc-sdk-chat-api',
          `${sessionId}.jsonl`
        );

        console.log('📁 Lendo arquivo de favoritos:', filePath);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        console.log('📝 Conteúdo bruto:', fileContent.length, 'caracteres');

        const lines = fileContent.trim().split('\n').filter(line => line.trim());
        console.log('📊 Linhas encontradas:', lines.length);

        const messages = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.error('Erro ao parsear linha:', line);
            return null;
          }
        }).filter(Boolean);

        console.log('✅ Mensagens parseadas:', messages.length);

        return NextResponse.json({
          sessionId,
          messages,
          title: 'Favoritos',
          origin: 'local_favorites'
        });
      } catch (fileError) {
        console.error('❌ Erro ao ler arquivo de favoritos:', fileError);
        console.log('Tentando API fallback...');
      }
    }

    // Buscar na API FastAPI
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8991';
    const response = await fetch(`${apiUrl}/api/session-history/${sessionId}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro ao buscar histórico da sessão:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar histórico da sessão' },
      { status: 500 }
    );
  }
}