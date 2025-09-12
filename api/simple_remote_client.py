#!/usr/bin/env python3
"""
Cliente simples e direto para interação remota com Claude Code SDK
Ideal para scripts e automação

Exemplo de uso:
    from simple_remote_client import ClaudeRemote
    
    client = ClaudeRemote()
    response = client.chat("Olá, como você está?")
    print(response)
"""

import requests
import json
from typing import Optional, Generator, Dict, Any

class ClaudeRemote:
    """Cliente simples para Claude Code SDK via API REST"""
    
    def __init__(self, base_url: str = "http://127.0.0.1:8991", session_id: str = None):
        """
        Inicializa cliente
        
        Args:
            base_url: URL base da API (default: localhost:8991)
            session_id: ID da sessão (usa unificado se None)
        """
        self.base_url = base_url
        self.session_id = session_id or "00000000-0000-0000-0000-000000000001"
    
    def chat(self, message: str, stream: bool = False) -> str:
        """
        Envia mensagem e recebe resposta
        
        Args:
            message: Mensagem para enviar
            stream: Se True, retorna generator com chunks
        
        Returns:
            Resposta completa como string (ou generator se stream=True)
        """
        if stream:
            return self._chat_streaming(message)
        else:
            return self._chat_complete(message)
    
    def _chat_complete(self, message: str) -> str:
        """Envia mensagem e aguarda resposta completa"""
        payload = {
            "message": message,
            "session_id": self.session_id
        }
        
        response = requests.post(
            f"{self.base_url}/api/chat",
            json=payload,
            stream=True,
            headers={"Accept": "text/event-stream"}
        )
        
        full_response = ""
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith("data: "):
                    try:
                        data = json.loads(line_str[6:])
                        if data.get("type") == "content":
                            full_response += data.get("content", "")
                        elif data.get("type") == "done":
                            break
                    except json.JSONDecodeError:
                        continue
        
        return full_response
    
    def _chat_streaming(self, message: str) -> Generator[str, None, None]:
        """Envia mensagem e retorna generator com chunks"""
        payload = {
            "message": message,
            "session_id": self.session_id
        }
        
        response = requests.post(
            f"{self.base_url}/api/chat",
            json=payload,
            stream=True,
            headers={"Accept": "text/event-stream"}
        )
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith("data: "):
                    try:
                        data = json.loads(line_str[6:])
                        if data.get("type") == "content":
                            yield data.get("content", "")
                        elif data.get("type") == "done":
                            break
                    except json.JSONDecodeError:
                        continue
    
    def clear(self) -> bool:
        """Limpa contexto da sessão"""
        payload = {"session_id": self.session_id}
        response = requests.post(f"{self.base_url}/api/clear", json=payload)
        return response.status_code == 200
    
    def interrupt(self) -> bool:
        """Interrompe geração em andamento"""
        payload = {"session_id": self.session_id}
        response = requests.post(f"{self.base_url}/api/interrupt", json=payload)
        return response.status_code == 200
    
    def get_history(self) -> list:
        """Obtém histórico de mensagens"""
        response = requests.get(f"{self.base_url}/api/session-history/{self.session_id}")
        if response.status_code == 200:
            data = response.json()
            return data.get("messages", [])
        return []
    
    def health_check(self) -> Dict[str, Any]:
        """Verifica status do servidor"""
        response = requests.get(f"{self.base_url}/health/detailed")
        if response.status_code == 200:
            return response.json()
        return {"status": "error", "message": "Server unavailable"}


# Função de conveniência para uso rápido
def chat(message: str, base_url: str = "http://127.0.0.1:8991") -> str:
    """
    Função simples para enviar mensagem e receber resposta
    
    Exemplo:
        from simple_remote_client import chat
        response = chat("Olá!")
        print(response)
    """
    client = ClaudeRemote(base_url)
    return client.chat(message)


# Exemplos de uso
if __name__ == "__main__":
    # Exemplo 1: Chat simples
    print("=" * 60)
    print("Exemplo 1: Chat simples")
    print("=" * 60)
    
    client = ClaudeRemote()
    response = client.chat("Olá! Responda em português: qual é 2+2?")
    print(f"Resposta: {response}")
    
    # Exemplo 2: Chat com streaming
    print("\n" + "=" * 60)
    print("Exemplo 2: Streaming")
    print("=" * 60)
    
    print("Resposta: ", end="")
    for chunk in client.chat("Conte uma piada curta", stream=True):
        print(chunk, end="", flush=True)
    print()
    
    # Exemplo 3: Usando função de conveniência
    print("\n" + "=" * 60)
    print("Exemplo 3: Função rápida")
    print("=" * 60)
    
    response = chat("Qual é a capital do Brasil?")
    print(f"Resposta: {response}")
    
    # Exemplo 4: Histórico
    print("\n" + "=" * 60)
    print("Exemplo 4: Histórico")
    print("=" * 60)
    
    history = client.get_history()
    print(f"Total de mensagens no histórico: {len(history)}")
    
    if history:
        print("\nÚltimas 3 mensagens:")
        for msg in history[-3:]:
            role = msg.get("role", "?")
            content = msg.get("content", "")[:80]
            print(f"  [{role}]: {content}...")
    
    # Exemplo 5: Health check
    print("\n" + "=" * 60)
    print("Exemplo 5: Status do servidor")
    print("=" * 60)
    
    health = client.health_check()
    print(f"Status: {health.get('status')}")
    print(f"Uptime: {health.get('uptime_seconds', 0):.2f} segundos")
    print(f"Sessões ativas: {health.get('sessions', {}).get('active_count', 0)}")