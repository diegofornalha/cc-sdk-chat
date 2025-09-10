#!/usr/bin/env python3
"""
Monitor Unificado de Session ID
Implementa a Opção 1: Monitor de JSONL que funciona com qualquer session_id
"""

import asyncio
from pathlib import Path
import json
import time
from datetime import datetime
import shutil

# Session ID unificado
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"

class UnifiedSessionMonitor:
    """Monitor que unifica todos os arquivos JSONL em um único session ID"""
    
    def __init__(self, project_path: str = None):
        if project_path:
            self.project_path = Path(project_path)
        else:
            # Detecta automaticamente o diretório do projeto
            base = Path.home() / ".claude" / "projects"
            # Procura por diretórios que contenham cc-sdk-chat
            for p in base.glob("*cc-sdk-chat*"):
                if p.is_dir():
                    self.project_path = p
                    break
            else:
                self.project_path = base / "-Users-2a--claude-cc-sdk-chat"
        
        self.unified_file = self.project_path / f"{UNIFIED_SESSION_ID}.jsonl"
        self.last_processed = {}
        
    def ensure_unified_file(self):
        """Garante que o arquivo unificado existe"""
        self.project_path.mkdir(parents=True, exist_ok=True)
        if not self.unified_file.exists():
            self.unified_file.touch()
            print(f"✨ Criado arquivo unificado: {self.unified_file}")
    
    async def monitor_and_unify(self):
        """Monitora todos os arquivos JSONL e unifica no arquivo principal"""
        
        print(f"🔍 Monitorando: {self.project_path}")
        print(f"📄 Arquivo unificado: {self.unified_file.name}")
        print("-" * 60)
        
        self.ensure_unified_file()
        
        while True:
            try:
                # Lista todos os arquivos JSONL exceto o unificado
                jsonl_files = [
                    f for f in self.project_path.glob("*.jsonl")
                    if f != self.unified_file
                ]
                
                for jsonl_file in jsonl_files:
                    # Verifica se o arquivo cresceu
                    current_size = jsonl_file.stat().st_size
                    last_size = self.last_processed.get(jsonl_file.name, 0)
                    
                    if current_size > last_size:
                        # Lê apenas as novas linhas
                        with open(jsonl_file, 'r', encoding='utf-8') as f:
                            f.seek(last_size)
                            new_content = f.read()
                        
                        if new_content.strip():
                            # Adiciona ao arquivo unificado
                            with open(self.unified_file, 'a', encoding='utf-8') as f:
                                f.write(new_content)
                                if not new_content.endswith('\n'):
                                    f.write('\n')
                            
                            # Conta linhas novas
                            new_lines = len([l for l in new_content.split('\n') if l.strip()])
                            
                            print(f"📝 {datetime.now().strftime('%H:%M:%S')} - "
                                  f"Copiadas {new_lines} linhas de {jsonl_file.name}")
                            
                            # Mostra preview do conteúdo
                            for line in new_content.split('\n')[:2]:  # Primeiras 2 linhas
                                if line.strip():
                                    try:
                                        data = json.loads(line)
                                        if data.get('type') == 'user':
                                            msg = data.get('message', {})
                                            content = msg.get('content', '')[:50]
                                            print(f"   👤 User: {content}...")
                                        elif data.get('type') == 'assistant':
                                            msg = data.get('message', {})
                                            if isinstance(msg.get('content'), list):
                                                for item in msg['content']:
                                                    if item.get('type') == 'text':
                                                        text = item.get('text', '')[:50]
                                                        print(f"   🤖 Assistant: {text}...")
                                                        break
                                    except:
                                        pass
                        
                        self.last_processed[jsonl_file.name] = current_size
                
            except Exception as e:
                print(f"❌ Erro: {e}")
            
            await asyncio.sleep(0.5)  # Verifica a cada 500ms
    
    def get_stats(self):
        """Retorna estatísticas do monitoramento"""
        stats = {
            "project_path": str(self.project_path),
            "unified_file": str(self.unified_file),
            "unified_size": self.unified_file.stat().st_size if self.unified_file.exists() else 0,
            "monitored_files": len(self.last_processed),
            "total_bytes_processed": sum(self.last_processed.values())
        }
        return stats

async def test_with_sdk():
    """Testa o monitor com uma mensagem real do SDK"""
    import sys
    import os
    
    # Adiciona SDK ao path
    sdk_dir = os.path.join(os.path.dirname(__file__), 'sdk')
    sys.path.insert(0, sdk_dir)
    
    from claude_code_sdk import query, ClaudeCodeOptions
    
    print("\n" + "=" * 60)
    print("🧪 TESTE COM SDK")
    print("=" * 60)
    
    # Inicia o monitor em background
    monitor = UnifiedSessionMonitor()
    monitor_task = asyncio.create_task(monitor.monitor_and_unify())
    
    # Aguarda um pouco
    await asyncio.sleep(1)
    
    # Envia mensagem via SDK
    print("\n📤 Enviando mensagem para Claude...")
    options = ClaudeCodeOptions(
        system_prompt="You are a test assistant. Keep responses very short.",
        max_turns=1
    )
    
    response = ""
    async for msg in query(prompt="Say 'Monitor test OK!' and nothing else", options=options):
        if hasattr(msg, 'content'):
            for block in msg.content:
                if hasattr(block, 'text'):
                    response += block.text
    
    print(f"📥 Resposta recebida: {response[:100]}")
    
    # Aguarda processar
    await asyncio.sleep(2)
    
    # Mostra estatísticas
    stats = monitor.get_stats()
    print("\n📊 Estatísticas do Monitor:")
    for key, value in stats.items():
        print(f"  - {key}: {value}")
    
    # Cancela monitor
    monitor_task.cancel()
    
    print("\n✅ Teste completo!")
    print(f"📄 Verifique o arquivo unificado em:\n   {monitor.unified_file}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # Modo teste com SDK
        print("🚀 Iniciando teste com SDK...")
        asyncio.run(test_with_sdk())
    else:
        # Modo monitor contínuo
        print("🚀 Iniciando Monitor de Session ID Unificado...")
        print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        monitor = UnifiedSessionMonitor()
        
        try:
            asyncio.run(monitor.monitor_and_unify())
        except KeyboardInterrupt:
            print("\n\n⏹️ Monitor interrompido.")
            stats = monitor.get_stats()
            print("\n📊 Estatísticas finais:")
            for key, value in stats.items():
                print(f"  - {key}: {value}")