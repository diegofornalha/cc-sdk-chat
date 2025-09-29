#!/usr/bin/env python3
"""
API Claude Chat - Simples e Modular
Mantém sessões do navegador e terminal completamente separadas
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging
from pathlib import Path

# Importar módulos
from routes import create_routes
from session_manager import SessionManager

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== CONFIGURAÇÃO DA API =====

app = FastAPI(
    title="Claude Chat API",
    description="API simplificada para chat com sessões isoladas",
    version="2.0.0"
)

# CORS - permitir acesso do navegador
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== INICIALIZAÇÃO =====

# Gerenciador de sessões
session_manager = SessionManager()

# Adicionar rotas
app.include_router(create_routes(session_manager))

# Servir arquivos estáticos (se existir pasta static)
static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# ===== ROTAS DO CHAT =====

@app.get("/chat", response_class=FileResponse)
async def chat_page():
    """Serve a página do chat"""
    chat_file = static_path / "chat.html"
    if chat_file.exists():
        return FileResponse(chat_file)
    return HTMLResponse("<h1>Chat não encontrado. Crie o arquivo /static/chat.html</h1>")

# ===== PÁGINA INICIAL =====

@app.get("/", response_class=HTMLResponse)
async def home():
    """Página inicial com informações da API"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Claude Chat API</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background: #f5f5f5;
            }
            .container {
                background: white;
                border-radius: 10px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #333; margin-bottom: 10px; }
            h2 { color: #666; margin-top: 30px; }
            .status {
                background: #4CAF50;
                color: white;
                padding: 5px 10px;
                border-radius: 5px;
                display: inline-block;
                margin-left: 10px;
            }
            .endpoint {
                background: #f0f0f0;
                padding: 15px;
                border-radius: 5px;
                margin: 10px 0;
                font-family: monospace;
            }
            .session-box {
                border: 2px solid #2196F3;
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
                background: #E3F2FD;
            }
            .warning {
                background: #FFF3CD;
                border: 1px solid #FFC107;
                padding: 10px;
                border-radius: 5px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Claude Chat API <span class="status">Online</span></h1>
            <p><strong>Versão 2.0</strong> - Sessões completamente isoladas</p>

            <div class="warning">
                <strong>💬 Chat disponível em:</strong>
                <a href="/chat" style="color: #1976D2; font-weight: bold;">Abrir Chat</a>
            </div>

            <h2>📁 Sessões Protegidas</h2>
            <div class="session-box">
                <strong>🌐 Navegador:</strong>
                <code>00000000-0000-0000-0000-000000000001</code>
            </div>
            <div class="session-box">
                <strong>💻 Terminal:</strong>
                <code>4b5f9b35-31b7-4789-88a1-390ecdf21559</code>
            </div>

            <h2>🔌 Endpoints Principais</h2>

            <div class="endpoint">
                <strong>GET</strong> /api/sessions
                <br>Lista todas as sessões ativas
            </div>

            <div class="endpoint">
                <strong>GET</strong> /api/session/{session_id}
                <br>Obtém mensagens de uma sessão específica
            </div>

            <div class="endpoint">
                <strong>POST</strong> /api/session/{session_id}/message
                <br>Envia mensagem para uma sessão
            </div>

            <div class="endpoint">
                <strong>GET</strong> /api/health
                <br>Status de saúde da API
            </div>

            <h2>📚 Documentação</h2>
            <p>
                <a href="/docs">📖 Swagger UI</a> |
                <a href="/redoc">📘 ReDoc</a>
            </p>
        </div>
    </body>
    </html>
    """

# ===== INICIAR SERVIDOR =====

if __name__ == "__main__":
    logger.info("🚀 Iniciando Claude Chat API...")
    logger.info("📍 Acesse http://localhost:3082")
    logger.info("📚 Documentação em http://localhost:3082/docs")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=3082,
        log_level="info"
    )