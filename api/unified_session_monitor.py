#!/usr/bin/env python3
"""
Monitor que sincroniza qualquer arquivo JSONL para o arquivo unificado
Mantém sempre o 00000000-0000-0000-0000-000000000001.jsonl atualizado
"""

import os
import sys
import json
import time
import shutil
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Session ID unificado
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"
PROJECT_NAME = "-Users-2a--claude-cc-sdk-chat-api"

class UnifiedSessionHandler(FileSystemEventHandler):
    def __init__(self, project_path):
        self.project_path = project_path
        self.unified_file = project_path / f"{UNIFIED_SESSION_ID}.jsonl"
        self.last_synced_files = {}
        
    def on_modified(self, event):
        if event.is_directory:
            return
            
        file_path = Path(event.src_path)
        
        # Ignora se não for JSONL ou se for o próprio arquivo unificado
        if not file_path.suffix == '.jsonl' or file_path.name == f"{UNIFIED_SESSION_ID}.jsonl":
            return
            
        # Sincroniza com arquivo unificado
        self.sync_to_unified(file_path)
    
    def on_created(self, event):
        if event.is_directory:
            return
            
        file_path = Path(event.src_path)
        
        # Se um novo arquivo JSONL foi criado (não o unificado)
        if file_path.suffix == '.jsonl' and file_path.name != f"{UNIFIED_SESSION_ID}.jsonl":
            print(f"🆕 Novo arquivo detectado: {file_path.name}")
            self.sync_to_unified(file_path)
    
    def sync_to_unified(self, source_file):
        """Sincroniza conteúdo do arquivo fonte para o arquivo unificado"""
        try:
            # Lê linhas do arquivo fonte
            with open(source_file, 'r') as f:
                new_lines = f.readlines()
            
            # Pega última posição sincronizada
            last_position = self.last_synced_files.get(str(source_file), 0)
            
            # Se há novas linhas
            if len(new_lines) > last_position:
                lines_to_add = new_lines[last_position:]
                
                # Adiciona ao arquivo unificado
                with open(self.unified_file, 'a') as f:
                    for line in lines_to_add:
                        if line.strip():  # Ignora linhas vazias
                            # Parse JSON para modificar session_id
                            try:
                                data = json.loads(line)
                                # Atualiza session_id para o unificado
                                data['sessionId'] = UNIFIED_SESSION_ID
                                f.write(json.dumps(data) + '\n')
                            except json.JSONDecodeError:
                                # Se não for JSON válido, escreve como está
                                f.write(line)
                
                # Atualiza posição
                self.last_synced_files[str(source_file)] = len(new_lines)
                
                print(f"✅ Sincronizado: {len(lines_to_add)} novas linhas de {source_file.name}")
                print(f"   → {self.unified_file.name}")
                
        except Exception as e:
            print(f"❌ Erro ao sincronizar: {e}")

def initial_sync(project_path):
    """Faz sincronização inicial de todos os arquivos existentes"""
    unified_file = project_path / f"{UNIFIED_SESSION_ID}.jsonl"
    
    print("🔄 Sincronização inicial...")
    
    # Limpa arquivo unificado
    with open(unified_file, 'w') as f:
        pass
    
    # Pega todos os arquivos JSONL exceto o unificado
    jsonl_files = [f for f in project_path.glob("*.jsonl") 
                   if f.name != f"{UNIFIED_SESSION_ID}.jsonl"]
    
    # Ordena por data de modificação
    jsonl_files.sort(key=lambda f: f.stat().st_mtime)
    
    all_entries = []
    
    for file in jsonl_files:
        print(f"  📄 Processando: {file.name}")
        with open(file, 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        data = json.loads(line)
                        # Atualiza session_id
                        data['sessionId'] = UNIFIED_SESSION_ID
                        all_entries.append(data)
                    except json.JSONDecodeError:
                        pass
    
    # Ordena por timestamp
    all_entries.sort(key=lambda x: x.get('timestamp', ''))
    
    # Escreve no arquivo unificado
    with open(unified_file, 'w') as f:
        for entry in all_entries:
            f.write(json.dumps(entry) + '\n')
    
    print(f"✅ Sincronizadas {len(all_entries)} entradas no arquivo unificado")
    
    return len(all_entries)

def main():
    """Monitor principal"""
    print("=" * 60)
    print("🚀 Monitor de Session ID Unificado")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    # Caminho do projeto
    project_path = Path.home() / ".claude" / "projects" / PROJECT_NAME
    
    if not project_path.exists():
        print(f"❌ Diretório não existe: {project_path}")
        return
    
    print(f"📁 Monitorando: {project_path}")
    print(f"🎯 Arquivo unificado: {UNIFIED_SESSION_ID}.jsonl")
    print()
    
    # Sincronização inicial
    total_synced = initial_sync(project_path)
    print()
    
    # Configura monitor
    event_handler = UnifiedSessionHandler(project_path)
    observer = Observer()
    observer.schedule(event_handler, str(project_path), recursive=False)
    
    # Inicia monitoramento
    observer.start()
    print("👀 Monitorando mudanças...")
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