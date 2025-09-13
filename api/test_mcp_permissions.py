#!/usr/bin/env python3
"""
Script de teste para verificar se MCP Neo4j funciona com bypass permissions
"""

import asyncio
import aiohttp
import json
import sys

async def test_mcp_neo4j():
    """Testa se o MCP Neo4j funciona através da API"""

    api_url = "http://localhost:8991"
    session_id = "00000000-0000-0000-0000-000000000001"

    # Mensagem solicitando uso do MCP Neo4j
    message = {
        "content": "Use a ferramenta mcp__neo4j-memory__search_memories para buscar memórias com label Learning",
        "session_id": session_id
    }

    print("🧪 Testando MCP Neo4j com bypass permissions...")
    print(f"📍 API: {api_url}")
    print(f"🆔 Session: {session_id}")
    print("-" * 50)

    async with aiohttp.ClientSession() as session:
        try:
            # Primeiro cria/garante que a sessão existe
            create_url = f"{api_url}/sessions/{session_id}"
            async with session.post(create_url, json={}) as resp:
                if resp.status == 200:
                    print("✅ Sessão criada/reutilizada")
                else:
                    print(f"⚠️ Status da criação: {resp.status}")

            # Envia mensagem para testar MCP
            chat_url = f"{api_url}/chat"
            print("\n📤 Enviando requisição para usar MCP Neo4j...")

            async with session.post(chat_url, json=message) as resp:
                print(f"📨 Status da resposta: {resp.status}")

                if resp.status == 200:
                    # Processa streaming response
                    full_response = ""
                    async for line in resp.content:
                        if line:
                            text = line.decode('utf-8').strip()
                            if text.startswith('data: '):
                                data_str = text[6:]
                                if data_str != '[DONE]':
                                    try:
                                        data = json.loads(data_str)
                                        if 'content' in data:
                                            full_response += data['content']
                                            print(data['content'], end='', flush=True)
                                    except json.JSONDecodeError:
                                        pass

                    print("\n\n" + "=" * 50)

                    # Verifica se houve erro de permissão
                    if "permission" in full_response.lower() and "denied" in full_response.lower():
                        print("❌ FALHA: Permissões ainda bloqueando MCP")
                        print("   Bypass permissions NÃO está funcionando!")
                        return False
                    elif "mcp__neo4j" in full_response.lower() or "learning" in full_response.lower():
                        print("✅ SUCESSO: MCP Neo4j funcionou!")
                        print("   Bypass permissions ESTÁ funcionando!")
                        return True
                    else:
                        print("⚠️ Resposta inconclusiva")
                        print(f"   Resposta: {full_response[:200]}...")
                        return None

                else:
                    text = await resp.text()
                    print(f"❌ Erro: {text}")
                    return False

        except Exception as e:
            print(f"❌ Erro na conexão: {e}")
            return False

async def main():
    result = await test_mcp_neo4j()

    print("\n" + "=" * 50)
    print("📊 RESULTADO DO TESTE:")

    if result is True:
        print("✅ Bypass permissions FUNCIONANDO!")
        print("   MCP Neo4j pode ser usado sem pedir permissão")
        sys.exit(0)
    elif result is False:
        print("❌ Bypass permissions NÃO está funcionando")
        print("   Ainda é necessário aprovar permissões manualmente")
        sys.exit(1)
    else:
        print("⚠️ Teste inconclusivo")
        print("   Verifique os logs da API para mais detalhes")
        sys.exit(2)

if __name__ == "__main__":
    asyncio.run(main())