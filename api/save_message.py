#!/usr/bin/env python3
"""
Salva mensagem diretamente no JSONL
"""

import json
from pathlib import Path
from datetime import datetime

def save_message(content, role="user"):
    """Salva mensagem no JSONL"""
    jsonl_path = Path("/Users/2a/.claude/projects/-Users-2a--claude-cc-sdk-chat-api/00000000-0000-0000-0000-000000000001.jsonl")
    jsonl_path.parent.mkdir(parents=True, exist_ok=True)

    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    }

    with open(jsonl_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(message, ensure_ascii=False) + "\n")

    print(f"✅ Mensagem salva no JSONL!")
    print(f"📁 Arquivo: {jsonl_path}")
    print(f"💬 Conteúdo: {content}")

if __name__ == "__main__":
    # Salvar a mensagem que foi enviada via interface
    save_message("Olá! Teste via MCP para verificar se a mensagem é salva no JSONL", "user")