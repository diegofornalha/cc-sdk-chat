#!/usr/bin/env python3
"""
Força TODAS as sessões para o arquivo unificado
Move conteúdo de qualquer novo arquivo JSONL para 00000000-0000-0000-0000-000000000001.jsonl
e deleta os arquivos com UUIDs aleatórios
"""

import os
import json
import time
import shutil
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Session ID unificado
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"
PROJECT_PATH = Path.home() / ".claude" / "projects" / "-Users-2a--claude-cc-sdk-chat-api"

class ForceUnifiedSessionHandler(FileSystemEventHandler):
    def __init__(self):
        self.unified_file = PROJECT_PATH / f"{UNIFIED_SESSION_ID}.jsonl"
        self.processing = set()
        
    def on_created(self, event):
        """Quando um novo arquivo é criado, move conteúdo para o unificado"""
        if event.is_directory:
            return
            
        file_path = Path(event.src_path)
        
        # Se é um arquivo JSONL e NÃO é o unificado
        if file_path.suffix == '.jsonl' and file_path.name != f"{UNIFIED_SESSION_ID}.jsonl":
            print(f"\n🚨 NOVO ARQUIVO DETECTADO: {file_path.name}")
            self.consolidate_file(file_path)
    
    def on_modified(self, event):
        """Quando um arquivo é modificado, move conteúdo novo para o unificado"""
        if event.is_directory:
            return
            
        file_path = Path(event.src_path)
        
        # Se é um arquivo JSONL e NÃO é o unificado
        if file_path.suffix == '.jsonl' and file_path.name != f"{UNIFIED_SESSION_ID}.jsonl":
            if str(file_path) not in self.processing:
                self.consolidate_file(file_path)
    
    def consolidate_file(self, source_file):
        """Move todo conteúdo do arquivo para o unificado e depois deleta"""
        self.processing.add(str(source_file))
        
        try:
            # Aguarda arquivo estabilizar
            time.sleep(0.1)
            
            # Lê conteúdo do arquivo fonte
            lines_to_move = []
            if source_file.exists():
                with open(source_file, 'r') as f:
                    for line in f:
                        if line.strip():
                            try:
                                # Parse JSON e força session ID unificado
                                data = json.loads(line)
                                data['sessionId'] = UNIFIED_SESSION_ID
                                lines_to_move.append(json.dumps(data) + '\n')
                            except json.JSONDecodeError:
                                lines_to_move.append(line)
            
            if lines_to_move:
                # Adiciona ao arquivo unificado
                with open(self.unified_file, 'a') as f:
                    f.writelines(lines_to_move)
                
                print(f"  ✅ Movidas {len(lines_to_move)} linhas para {UNIFIED_SESSION_ID}.jsonl")
                
                # Deleta arquivo original
                source_file.unlink()
                print(f"  🗑️  Arquivo {source_file.name} deletado")
            
        except Exception as e:
            print(f"  ❌ Erro ao consolidar: {e}")
        finally:
            self.processing.discard(str(source_file))

def clean_existing_files():
    """Limpa e consolida arquivos existentes"""
    print("\n🧹 Limpando arquivos existentes...")
    
    unified_file = PROJECT_PATH / f"{UNIFIED_SESSION_ID}.jsonl"
    
    # Lista todos os arquivos JSONL exceto o unificado
    other_files = [f for f in PROJECT_PATH.glob("*.jsonl") 
                   if f.name != f"{UNIFIED_SESSION_ID}.jsonl"]
    
    if not other_files:
        print("  ✅ Nenhum arquivo extra encontrado")
        return
    
    # Coleta todas as entradas
    all_entries = []
    
    # Primeiro, lê o arquivo unificado se existir
    if unified_file.exists():
        with open(unified_file, 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        data = json.loads(line)
                        all_entries.append(data)
                    except:
                        pass
    
    # Depois, lê os outros arquivos
    for file in other_files:
        print(f"  📄 Processando: {file.name}")
        with open(file, 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        data = json.loads(line)
                        # Força session ID unificado
                        data['sessionId'] = UNIFIED_SESSION_ID
                        all_entries.append(data)
                    except:
                        pass
        
        # Deleta arquivo após processar
        file.unlink()
        print(f"  🗑️  Deletado: {file.name}")
    
    # Ordena por timestamp
    all_entries.sort(key=lambda x: x.get('timestamp', ''))
    
    # Reescreve arquivo unificado
    with open(unified_file, 'w') as f:
        for entry in all_entries:
            f.write(json.dumps(entry) + '\n')
    
    print(f"\n✅ Consolidadas {len(all_entries)} entradas em {UNIFIED_SESSION_ID}.jsonl")
    print(f"📁 Arquivo único: {unified_file}")

def main():
    """Monitor principal que força sessão unificada"""
    print("=" * 60)
    print("🔒 FORÇANDO SESSÃO UNIFICADA")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    print(f"📁 Monitorando: {PROJECT_PATH}")
    print(f"🎯 Arquivo único: {UNIFIED_SESSION_ID}.jsonl")
    print()
    
    # Garante que diretório existe
    PROJECT_PATH.mkdir(parents=True, exist_ok=True)
    
    # Garante que arquivo unificado existe
    unified_file = PROJECT_PATH / f"{UNIFIED_SESSION_ID}.jsonl"
    if not unified_file.exists():
        unified_file.touch()
        print(f"✨ Criado arquivo unificado: {unified_file.name}")
    
    # Limpa e consolida arquivos existentes
    clean_existing_files()
    
    # Configura monitor
    event_handler = ForceUnifiedSessionHandler()
    observer = Observer()
    observer.schedule(event_handler, str(PROJECT_PATH), recursive=False)
    
    # Inicia monitoramento
    observer.start()
    print("\n👁️  Monitorando... Qualquer novo arquivo será consolidado!")
    print("   Pressione Ctrl+C para parar")
    print()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n🛑 Monitor parado")
    
    observer.join()

if __name__ == "__main__":
    main()