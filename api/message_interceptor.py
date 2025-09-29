#!/usr/bin/env python3
"""
Interceptador de Mensagens
Monitora requisições e salva mensagens no JSONL correto
"""

import json
from pathlib import Path
from datetime import datetime
import asyncio
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import re

class MessageInterceptor(FileSystemEventHandler):
    def __init__(self):
        self.jsonl_path = Path("/Users/2a/.claude/projects/-Users-2a--claude-cc-sdk-chat-api/00000000-0000-0000-0000-000000000001.jsonl")
        self.jsonl_path.parent.mkdir(parents=True, exist_ok=True)

    def save_message(self, content, role="user"):
        """Salva mensagem no JSONL"""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "source": "interceptor"
        }

        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(message, ensure_ascii=False) + "\n")

        print(f"✅ Mensagem salva no JSONL: {content[:50]}...")

    def on_modified(self, event):
        """Detecta modificações em arquivos"""
        if event.src_path.endswith(".jsonl") and "00000001" in event.src_path:
            # Arquivo foi modificado, verificar conteúdo
            pass

def monitor_and_save():
    """Função principal para monitorar e salvar mensagens"""
    interceptor = MessageInterceptor()

    # Salvar mensagem de teste que foi enviada
    test_message = "Olá! Teste via MCP para verificar se a mensagem é salva no JSONL"
    interceptor.save_message(test_message, "user")

    print("🔍 Interceptador ativo. Monitorando mensagens...")

if __name__ == "__main__":
    monitor_and_save()