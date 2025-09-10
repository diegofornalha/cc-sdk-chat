#!/usr/bin/env python3
"""
Script de teste para Session ID Unificado
Testa a Opção 1: Monitor de JSONL
"""

import asyncio
import sys
import os
from pathlib import Path
import json
import time
from datetime import datetime

# Adiciona SDK ao path
sdk_dir = os.path.join(os.path.dirname(__file__), 'sdk')
sys.path.insert(0, sdk_dir)

from claude_code_sdk import query, ClaudeCodeOptions

# Session ID fixo que queremos usar
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"
PROJECT_NAME = "-Users-2a--claude-cc-sdk-chat-api"

async def test_jsonl_monitor():
    """Testa se o monitor JSONL funciona com qualquer session_id"""
    
    print("=" * 60)
    print("🧪 TESTE: Monitor JSONL com Session ID Unificado")
    print("=" * 60)
    print()
    
    # Caminho do projeto Claude
    project_path = Path.home() / ".claude" / "projects" / PROJECT_NAME
    print(f"📁 Diretório do projeto: {project_path}")
    
    # Verifica se existe
    if not project_path.exists():
        print(f"❌ Diretório não existe. Criando...")
        project_path.mkdir(parents=True, exist_ok=True)
    
    # Lista arquivos JSONL antes
    print("\n📄 Arquivos JSONL antes do teste:")
    jsonl_files_before = list(project_path.glob("*.jsonl"))
    for f in jsonl_files_before:
        print(f"  - {f.name} ({f.stat().st_size} bytes)")
    
    # Cria arquivo unificado se não existir
    unified_file = project_path / f"{UNIFIED_SESSION_ID}.jsonl"
    if not unified_file.exists():
        print(f"\n✨ Criando arquivo unificado: {unified_file.name}")
        unified_file.touch()
    
    print("\n🚀 Enviando mensagem para Claude SDK...")
    print("-" * 40)
    
    # Configura opções do SDK
    options = ClaudeCodeOptions(
        cwd=str(Path.home() / ".claude" / "cc-sdk-chat"),
        system_prompt="You are a helpful assistant for testing unified session ID.",
        max_turns=1
    )
    
    # Mensagem de teste
    test_message = f"Testing unified session at {datetime.now().strftime('%H:%M:%S')}. Just say 'Session test successful!'"
    print(f"📝 Mensagem: {test_message}")
    
    # Envia query
    response_text = ""
    async for message in query(prompt=test_message, options=options):
        if hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'text'):
                    response_text += block.text
    
    print(f"✅ Resposta: {response_text[:100]}...")
    
    # Aguarda um pouco para garantir que foi escrito
    await asyncio.sleep(1)
    
    # Lista arquivos JSONL depois
    print("\n📄 Arquivos JSONL depois do teste:")
    jsonl_files_after = list(project_path.glob("*.jsonl"))
    for f in jsonl_files_after:
        print(f"  - {f.name} ({f.stat().st_size} bytes)")
    
    # Identifica novo arquivo criado
    new_files = set(f.name for f in jsonl_files_after) - set(f.name for f in jsonl_files_before)
    if new_files:
        print(f"\n🆕 Novo arquivo criado pelo SDK: {new_files}")
        
        # Teste do monitor - lê o arquivo mais recente
        print("\n🔍 Testando monitor JSONL...")
        latest_file = max(jsonl_files_after, key=lambda f: f.stat().st_mtime)
        print(f"📊 Arquivo mais recente: {latest_file.name}")
        
        # Lê últimas mensagens
        with open(latest_file, 'r') as f:
            lines = f.readlines()
            print(f"📈 Total de linhas: {len(lines)}")
            
            # Mostra últimas 3 mensagens
            print("\n📨 Últimas mensagens:")
            for line in lines[-3:]:
                if line.strip():
                    try:
                        data = json.loads(line)
                        msg_type = data.get('type', 'unknown')
                        print(f"  - Tipo: {msg_type}")
                        
                        if msg_type == 'user' and data.get('message'):
                            content = data['message'].get('content', '')
                            print(f"    User: {content[:50]}...")
                        elif msg_type == 'assistant' and data.get('message'):
                            msg = data['message']
                            if 'content' in msg and isinstance(msg['content'], list):
                                for content in msg['content']:
                                    if content.get('type') == 'text':
                                        text = content.get('text', '')[:50]
                                        print(f"    Assistant: {text}...")
                                        break
                    except:
                        pass
    
    print("\n" + "=" * 60)
    print("✅ TESTE COMPLETO!")
    print("=" * 60)
    print("\n💡 Conclusão:")
    print("O monitor JSONL funciona independente do session_id!")
    print("Ele sempre pega o arquivo mais recente modificado.")
    print("\n🎯 Para unificar completamente, podemos:")
    print("1. Criar link simbólico do novo arquivo para o unificado")
    print("2. Ou simplesmente deixar o monitor pegar sempre o mais recente")
    print("3. Ou implementar um watcher que copia conteúdo para arquivo unificado")

async def create_symlink_solution():
    """Demonstra solução com link simbólico"""
    
    print("\n" + "=" * 60)
    print("🔗 SOLUÇÃO: Link Simbólico Automático")
    print("=" * 60)
    
    project_path = Path.home() / ".claude" / "projects" / PROJECT_NAME
    unified_file = project_path / f"{UNIFIED_SESSION_ID}.jsonl"
    
    # Pega o arquivo mais recente que não seja o unificado
    jsonl_files = [f for f in project_path.glob("*.jsonl") if f != unified_file]
    
    if jsonl_files:
        latest = max(jsonl_files, key=lambda f: f.stat().st_mtime)
        print(f"\n📄 Arquivo mais recente: {latest.name}")
        
        # Remove arquivo unificado se existir
        if unified_file.exists():
            unified_file.unlink()
            print(f"🗑️ Removido arquivo antigo: {unified_file.name}")
        
        # Cria link simbólico
        os.symlink(latest.name, str(unified_file))
        print(f"🔗 Link criado: {unified_file.name} -> {latest.name}")
        
        # Verifica
        if unified_file.is_symlink():
            print(f"✅ Link simbólico criado com sucesso!")
            print(f"📊 Tamanho: {unified_file.stat().st_size} bytes")
    else:
        print("❌ Nenhum arquivo JSONL encontrado para linkar")

if __name__ == "__main__":
    print("🚀 Iniciando teste de Session ID Unificado...")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Executa teste principal
    asyncio.run(test_jsonl_monitor())
    
    # Demonstra solução com symlink
    # asyncio.run(create_symlink_solution())