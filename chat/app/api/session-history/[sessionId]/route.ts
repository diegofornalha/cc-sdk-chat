import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
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