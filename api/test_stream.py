#!/usr/bin/env python3
"""Script para testar o streaming de realtime."""

import asyncio
import aiohttp
import json

async def test_stream():
    """Testa o endpoint de streaming."""
    url = "http://localhost:8991/api/realtime/stream/-Users-2a--claude-cc-sdk-chat-api"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            print(f"Status: {response.status}")
            print(f"Headers: {response.headers}")
            print("\nStreaming data:")
            
            async for line in response.content:
                line = line.decode('utf-8').strip()
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        print(f"Type: {data.get('type')}, Content: {data.get('content', '')[:50]}")
                    except json.JSONDecodeError:
                        pass

if __name__ == "__main__":
    try:
        asyncio.run(test_stream())
    except KeyboardInterrupt:
        print("\nInterrompido pelo usuário")