#!/usr/bin/env python3
"""
API Claude Chat - Servidor simplificado
Serve interface própria e salva mensagens no JSONL
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
import json
from pathlib import Path
import logging
import uvicorn

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Claude Chat API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Diretório do projeto
PROJECT_DIR = Path("/Users/2a/.claude/projects/-Users-2a--claude-cc-sdk-chat-api")
PROJECT_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/")
async def home():
    """Serve a interface principal"""
    chat_file = Path(__file__).parent / "chat.html"
    if chat_file.exists():
        return FileResponse(chat_file)
    return HTMLResponse("<h1>Interface não encontrada</h1>")

@app.get("/-Users-2a--claude-cc-sdk-chat-api/{session_id}")
async def chat_page(session_id: str):
    """Serve a interface de chat para uma sessão específica"""
    chat_file = Path(__file__).parent / "chat.html"
    if chat_file.exists():
        return FileResponse(chat_file)
    return HTMLResponse("<h1>Interface não encontrada</h1>")

@app.post("/api/sessions/{session_id}/messages")
async def save_message(session_id: str, request: Request):
    """Salva mensagem no JSONL"""
    try:
        data = await request.json()
        jsonl_file = PROJECT_DIR / f"{session_id}.jsonl"

        message = {
            "role": data.get("role", "user"),
            "content": data.get("content", ""),
            "timestamp": data.get("timestamp")
        }

        # Salvar no arquivo JSONL
        with open(jsonl_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(message, ensure_ascii=False) + "\n")

        logger.info(f"💾 Mensagem salva: {jsonl_file}")
        return JSONResponse({"success": True, "message": "Mensagem salva com sucesso"})

    except Exception as e:
        logger.error(f"Erro ao salvar mensagem: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Recupera mensagens de uma sessão"""
    try:
        jsonl_file = PROJECT_DIR / f"{session_id}.jsonl"
        messages = []

        if jsonl_file.exists():
            with open(jsonl_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        messages.append(json.loads(line))

        return JSONResponse({
            "session_id": session_id,
            "messages": messages,
            "count": len(messages)
        })

    except Exception as e:
        logger.error(f"Erro ao recuperar sessão: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/health")
async def health():
    """Status de saúde da API"""
    return JSONResponse({"status": "ok", "service": "Claude Chat API"})

if __name__ == "__main__":
    logger.info("🚀 Iniciando Claude Chat API...")
    logger.info("📍 Acesse http://localhost:3082")
    logger.info("💬 Chat: http://localhost:3082/-Users-2a--claude-cc-sdk-chat-api/00000000-0000-0000-0000-000000000001")

    uvicorn.run(app, host="0.0.0.0", port=3082)