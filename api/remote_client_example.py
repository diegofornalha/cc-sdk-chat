#!/usr/bin/env python3
"""
Cliente de exemplo para interação remota com Claude Code SDK
Demonstra diferentes formas de interagir com a API REST/SSE

Autor: Claude Code SDK Team
"""

import asyncio
import aiohttp
import json
import sys
from typing import Optional, AsyncGenerator, Dict, Any
from datetime import datetime

# Configuração do servidor
API_BASE_URL = "http://127.0.0.1:8991"
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"

class ClaudeRemoteClient:
    """Cliente para interação remota com Claude Code SDK"""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.session = None
        self.current_session_id = UNIFIED_SESSION_ID
    
    async def __aenter__(self):
        """Contexto assíncrono para gerenciar sessão HTTP"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Fecha sessão HTTP ao sair do contexto"""
        if self.session:
            await self.session.close()
    
    async def health_check(self) -> Dict[str, Any]:
        """Verifica status do servidor"""
        async with self.session.get(f"{self.base_url}/health/detailed") as resp:
            return await resp.json()
    
    async def send_message_streaming(self, message: str, session_id: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Envia mensagem e recebe resposta via SSE (Server-Sent Events)
        
        Args:
            message: Mensagem para enviar ao Claude
            session_id: ID da sessão (usa UNIFIED_SESSION_ID se não especificado)
        
        Yields:
            Chunks da resposta em streaming
        """
        session_id = session_id or self.current_session_id
        
        payload = {
            "message": message,
            "session_id": session_id
        }
        
        async with self.session.post(
            f"{self.base_url}/api/chat",
            json=payload,
            headers={"Accept": "text/event-stream"}
        ) as response:
            async for line in response.content:
                line = line.decode('utf-8').strip()
                
                # SSE format: "data: {json}"
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        yield data
                    except json.JSONDecodeError:
                        continue
    
    async def send_message_complete(self, message: str, session_id: Optional[str] = None) -> str:
        """
        Envia mensagem e aguarda resposta completa
        
        Args:
            message: Mensagem para enviar
            session_id: ID da sessão
        
        Returns:
            Resposta completa do Claude
        """
        full_response = ""
        
        async for chunk in self.send_message_streaming(message, session_id):
            if chunk.get("type") == "content":
                content = chunk.get("content", "")
                full_response += content
                print(content, end="", flush=True)  # Print em tempo real
            elif chunk.get("type") == "done":
                print("\n")  # Nova linha ao finalizar
                break
        
        return full_response
    
    async def interrupt_session(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Interrompe geração de resposta em andamento"""
        session_id = session_id or self.current_session_id
        
        payload = {"session_id": session_id}
        
        async with self.session.post(
            f"{self.base_url}/api/interrupt",
            json=payload
        ) as resp:
            return await resp.json()
    
    async def clear_session(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Limpa histórico da sessão mantendo o ID"""
        session_id = session_id or self.current_session_id
        
        payload = {"session_id": session_id}
        
        async with self.session.post(
            f"{self.base_url}/api/clear",
            json=payload
        ) as resp:
            return await resp.json()
    
    async def get_session_info(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Obtém informações detalhadas da sessão"""
        session_id = session_id or self.current_session_id
        
        async with self.session.get(
            f"{self.base_url}/api/session/{session_id}"
        ) as resp:
            if resp.status == 200:
                return await resp.json()
            else:
                return {"error": f"Status {resp.status}"}
    
    async def get_session_history(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Obtém histórico completo da sessão"""
        session_id = session_id or self.current_session_id
        
        async with self.session.get(
            f"{self.base_url}/api/session-history/{session_id}"
        ) as resp:
            return await resp.json()
    
    async def list_all_sessions(self) -> Dict[str, Any]:
        """Lista todas as sessões ativas"""
        async with self.session.get(f"{self.base_url}/api/sessions") as resp:
            return await resp.json()
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Obtém métricas do servidor"""
        async with self.session.get(f"{self.base_url}/api/metrics") as resp:
            return await resp.json()
    
    async def create_session_with_config(
        self,
        system_prompt: Optional[str] = None,
        allowed_tools: Optional[list] = None,
        max_turns: Optional[int] = None,
        cwd: Optional[str] = None
    ) -> str:
        """
        Cria nova sessão com configuração específica
        
        Returns:
            ID da nova sessão criada
        """
        config = {}
        if system_prompt:
            config["system_prompt"] = system_prompt
        if allowed_tools:
            config["allowed_tools"] = allowed_tools
        if max_turns:
            config["max_turns"] = max_turns
        if cwd:
            config["cwd"] = cwd
        
        async with self.session.post(
            f"{self.base_url}/api/session-with-config",
            json=config
        ) as resp:
            data = await resp.json()
            return data.get("session_id")


# ============= EXEMPLOS DE USO =============

async def example_simple_chat():
    """Exemplo 1: Chat simples com resposta completa"""
    print("=" * 60)
    print("EXEMPLO 1: Chat Simples")
    print("=" * 60)
    
    async with ClaudeRemoteClient() as client:
        # Verifica saúde do servidor
        health = await client.health_check()
        print(f"Status do servidor: {health['status']}")
        print(f"Sessões ativas: {health['sessions']['active_count']}")
        print()
        
        # Envia mensagem e recebe resposta completa
        print("Enviando mensagem...")
        response = await client.send_message_complete(
            "Olá! Responda em português: Qual é a capital do Brasil?"
        )
        
        print(f"\nResposta completa: {response}")


async def example_streaming_chat():
    """Exemplo 2: Chat com streaming de resposta"""
    print("=" * 60)
    print("EXEMPLO 2: Chat com Streaming")
    print("=" * 60)
    
    async with ClaudeRemoteClient() as client:
        print("Iniciando chat com streaming...")
        print("Resposta: ", end="")
        
        # Processa resposta em chunks
        chunks_received = 0
        async for chunk in client.send_message_streaming(
            "Conte uma piada curta sobre programação"
        ):
            if chunk.get("type") == "content":
                print(chunk.get("content", ""), end="", flush=True)
                chunks_received += 1
            elif chunk.get("type") == "done":
                print(f"\n\n✅ Streaming finalizado. {chunks_received} chunks recebidos.")
                break


async def example_session_management():
    """Exemplo 3: Gerenciamento de sessões"""
    print("=" * 60)
    print("EXEMPLO 3: Gerenciamento de Sessões")
    print("=" * 60)
    
    async with ClaudeRemoteClient() as client:
        # Cria nova sessão com configuração
        print("Criando nova sessão personalizada...")
        new_session_id = await client.create_session_with_config(
            system_prompt="Você é um assistente especializado em Python.",
            allowed_tools=["Read", "Write", "Bash"],
            max_turns=5
        )
        print(f"Nova sessão criada: {new_session_id}")
        
        # Envia mensagem para nova sessão
        print("\nEnviando mensagem para nova sessão...")
        await client.send_message_complete(
            "Como criar uma função async em Python?",
            session_id=new_session_id
        )
        
        # Obtém informações da sessão
        print("\nObtendo informações da sessão...")
        info = await client.get_session_info(new_session_id)
        print(f"Sessão ativa: {info.get('active', False)}")
        print(f"Configuração: {json.dumps(info.get('config', {}), indent=2)}")
        
        # Lista todas as sessões
        print("\nListando todas as sessões...")
        sessions = await client.list_all_sessions()
        print(f"Total de sessões: {len(sessions)}")
        for session in sessions[:3]:  # Mostra apenas 3 primeiras
            print(f"  - {session.get('session_id')}: {session.get('active')}")


async def example_history_and_context():
    """Exemplo 4: Histórico e contexto de conversa"""
    print("=" * 60)
    print("EXEMPLO 4: Histórico e Contexto")
    print("=" * 60)
    
    async with ClaudeRemoteClient() as client:
        # Primeira mensagem
        print("Mensagem 1:")
        await client.send_message_complete("Meu nome é João")
        
        # Segunda mensagem (deve lembrar o contexto)
        print("\nMensagem 2:")
        await client.send_message_complete("Qual é meu nome?")
        
        # Obtém histórico
        print("\nObtendo histórico da sessão...")
        history = await client.get_session_history()
        
        if "messages" in history:
            print(f"Total de mensagens no histórico: {history.get('total_messages', 0)}")
            print("\nÚltimas 3 mensagens:")
            for msg in history["messages"][-3:]:
                role = msg.get("role", "unknown")
                content = msg.get("content", "")[:100]  # Primeiros 100 chars
                print(f"  [{role}]: {content}...")
        
        # Limpa contexto
        print("\nLimpando contexto da sessão...")
        clear_result = await client.clear_session()
        print(f"Status: {clear_result.get('status')}")
        
        # Testa se contexto foi limpo
        print("\nTestando após limpar:")
        await client.send_message_complete("Qual é meu nome?")


async def example_metrics_monitoring():
    """Exemplo 5: Monitoramento de métricas"""
    print("=" * 60)
    print("EXEMPLO 5: Monitoramento de Métricas")
    print("=" * 60)
    
    async with ClaudeRemoteClient() as client:
        # Obtém métricas do servidor
        metrics = await client.get_metrics()
        
        print("📊 Métricas do Servidor:")
        print(f"  Requests totais: {metrics.get('requests_total', 0)}")
        print(f"  Requests em andamento: {metrics.get('requests_in_progress', 0)}")
        print(f"  Erros totais: {metrics.get('errors_total', 0)}")
        print(f"  Sessões criadas: {metrics.get('sessions_created', 0)}")
        print(f"  Sessões ativas: {metrics.get('sessions_active', 0)}")
        print(f"  Uptime: {metrics.get('uptime_seconds', 0):.2f} segundos")
        print(f"  CPU: {metrics.get('cpu_usage_percent', 0):.1f}%")
        print(f"  Memória: {metrics.get('memory_usage_percent', 0):.1f}%")


async def example_interrupt_generation():
    """Exemplo 6: Interromper geração de resposta"""
    print("=" * 60)
    print("EXEMPLO 6: Interrupção de Resposta")
    print("=" * 60)
    
    async with ClaudeRemoteClient() as client:
        print("Enviando pergunta que gera resposta longa...")
        
        # Inicia task para enviar mensagem
        message_task = asyncio.create_task(
            client.send_message_complete(
                "Escreva um ensaio detalhado de 1000 palavras sobre inteligência artificial"
            )
        )
        
        # Aguarda 2 segundos e interrompe
        await asyncio.sleep(2)
        print("\n\n⏸️ Interrompendo geração...")
        interrupt_result = await client.interrupt_session()
        print(f"Status: {interrupt_result.get('status')}")
        
        # Cancela task
        message_task.cancel()
        try:
            await message_task
        except asyncio.CancelledError:
            print("✅ Geração interrompida com sucesso")


async def interactive_mode():
    """Modo interativo - chat contínuo"""
    print("=" * 60)
    print("MODO INTERATIVO")
    print("=" * 60)
    print("Digite suas mensagens. Use 'sair' para encerrar.")
    print("Comandos especiais:")
    print("  /clear - Limpa contexto da sessão")
    print("  /info - Mostra informações da sessão")
    print("  /history - Mostra histórico")
    print("=" * 60)
    
    async with ClaudeRemoteClient() as client:
        while True:
            try:
                # Lê entrada do usuário
                user_input = input("\n👤 Você: ")
                
                if user_input.lower() == 'sair':
                    print("Encerrando...")
                    break
                
                # Comandos especiais
                if user_input == "/clear":
                    result = await client.clear_session()
                    print(f"✅ Contexto limpo: {result.get('status')}")
                    continue
                
                if user_input == "/info":
                    info = await client.get_session_info()
                    print(f"📋 Informações da sessão:")
                    print(json.dumps(info, indent=2))
                    continue
                
                if user_input == "/history":
                    history = await client.get_session_history()
                    print(f"📜 Histórico ({history.get('total_messages', 0)} mensagens)")
                    for msg in history.get("messages", [])[-5:]:
                        role = msg.get("role", "?")
                        content = msg.get("content", "")[:100]
                        print(f"  [{role}]: {content}...")
                    continue
                
                # Envia mensagem normal
                print("🤖 Claude: ", end="")
                await client.send_message_complete(user_input)
                
            except KeyboardInterrupt:
                print("\n\nInterrompido pelo usuário")
                break
            except Exception as e:
                print(f"\n❌ Erro: {e}")


async def main():
    """Menu principal de exemplos"""
    print("\n" + "=" * 60)
    print("🚀 CLIENTE REMOTO CLAUDE CODE SDK")
    print("=" * 60)
    
    print("\nEscolha um exemplo:")
    print("1. Chat simples")
    print("2. Chat com streaming")
    print("3. Gerenciamento de sessões")
    print("4. Histórico e contexto")
    print("5. Monitoramento de métricas")
    print("6. Interrupção de resposta")
    print("7. Modo interativo")
    print("0. Executar todos os exemplos")
    
    choice = input("\nOpção: ").strip()
    
    examples = {
        "1": example_simple_chat,
        "2": example_streaming_chat,
        "3": example_session_management,
        "4": example_history_and_context,
        "5": example_metrics_monitoring,
        "6": example_interrupt_generation,
        "7": interactive_mode
    }
    
    if choice == "0":
        # Executa todos exceto o modo interativo
        for key in ["1", "2", "3", "4", "5", "6"]:
            await examples[key]()
            print("\n" + "=" * 60 + "\n")
            await asyncio.sleep(1)
    elif choice in examples:
        await examples[choice]()
    else:
        print("Opção inválida")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nPrograma encerrado pelo usuário")
    except Exception as e:
        print(f"\n❌ Erro fatal: {e}")
        sys.exit(1)