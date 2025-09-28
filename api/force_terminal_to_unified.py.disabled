#!/usr/bin/env python3
"""
Força TODAS as sessões do terminal para usar a sessão unificada
Move conteúdo de qualquer sessão nova para 00000000-0000-0000-0000-000000000001
"""

import os
import json
import time
import shutil
from pathlib import Path
from datetime import datetime
from typing import Set

# Session ID unificado
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"
PROJECT_PATH = Path.home() / ".claude" / "projects" / "-Users-2a--claude-cc-sdk-chat-api"

class TerminalSessionRedirector:
    def __init__(self):
        self.unified_file = PROJECT_PATH / f"{UNIFIED_SESSION_ID}.jsonl"
        self.processed_files: Set[str] = set()
        self.last_sizes = {}

    def is_terminal_session(self, file_path: Path) -> bool:
        """Verifica se é uma sessão do terminal"""
        if file_path.name == f"{UNIFIED_SESSION_ID}.jsonl":
            return False

        try:
            with open(file_path, 'r') as f:
                first_line = f.readline()
                if first_line:
                    data = json.loads(first_line)
                    # Sessões do terminal têm userType: external
                    return data.get('userType') == 'external'
        except:
            pass
        return False

    def redirect_to_unified(self, source_file: Path):
        """Redireciona conteúdo para sessão unificada"""
        try:
            # Lê todo conteúdo do arquivo
            lines_to_move = []
            with open(source_file, 'r') as f:
                for line in f:
                    if line.strip():
                        try:
                            data = json.loads(line)
                            # Força session ID unificado
                            data['sessionId'] = UNIFIED_SESSION_ID
                            # Marca origem
                            data['origin'] = 'terminal_redirected'
                            lines_to_move.append(json.dumps(data) + '\n')
                        except json.JSONDecodeError:
                            pass

            if lines_to_move:
                # Adiciona ao arquivo unificado
                with open(self.unified_file, 'a') as f:
                    f.writelines(lines_to_move)

                print(f"✅ Redirecionadas {len(lines_to_move)} mensagens para sessão unificada")

                # Deleta arquivo original
                source_file.unlink()
                print(f"🗑️ Arquivo {source_file.name} removido")
                return True

        except Exception as e:
            print(f"❌ Erro ao redirecionar: {e}")

        return False

    def monitor_and_redirect(self):
        """Monitor contínuo que redireciona novas sessões"""
        print("🔄 Monitor de Redirecionamento Ativo")
        print(f"📁 Monitorando: {PROJECT_PATH}")
        print(f"🎯 Destino: {UNIFIED_SESSION_ID}.jsonl")
        print("-" * 50)

        while True:
            try:
                # Lista todos os arquivos JSONL
                for jsonl_file in PROJECT_PATH.glob("*.jsonl"):
                    # Pula o arquivo unificado
                    if jsonl_file.name == f"{UNIFIED_SESSION_ID}.jsonl":
                        continue

                    # Se é sessão do terminal
                    if self.is_terminal_session(jsonl_file):
                        file_size = jsonl_file.stat().st_size
                        last_size = self.last_sizes.get(str(jsonl_file), 0)

                        # Se o arquivo cresceu ou é novo
                        if file_size > last_size:
                            print(f"\n🚨 Sessão terminal detectada: {jsonl_file.name}")

                            # Aguarda estabilizar
                            time.sleep(0.5)

                            # Redireciona para unificado
                            if self.redirect_to_unified(jsonl_file):
                                self.processed_files.add(str(jsonl_file))
                            else:
                                self.last_sizes[str(jsonl_file)] = file_size

                time.sleep(1)  # Verifica a cada segundo

            except KeyboardInterrupt:
                print("\n⏹️ Monitor interrompido")
                break
            except Exception as e:
                print(f"❌ Erro no monitor: {e}")
                time.sleep(2)

def main():
    print("=" * 60)
    print("🚀 FORÇANDO SESSÕES TERMINAL PARA UNIFICADA")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()

    # Garante que diretório existe
    PROJECT_PATH.mkdir(parents=True, exist_ok=True)

    # Garante que arquivo unificado existe
    unified_file = PROJECT_PATH / f"{UNIFIED_SESSION_ID}.jsonl"
    if not unified_file.exists():
        unified_file.touch()
        print(f"✨ Criado arquivo unificado: {unified_file.name}")

    # Processa arquivos existentes
    print("\n🧹 Processando sessões existentes...")
    redirector = TerminalSessionRedirector()

    existing_count = 0
    for jsonl_file in PROJECT_PATH.glob("*.jsonl"):
        if jsonl_file.name != f"{UNIFIED_SESSION_ID}.jsonl":
            if redirector.is_terminal_session(jsonl_file):
                print(f"  📄 Encontrada: {jsonl_file.name}")
                if redirector.redirect_to_unified(jsonl_file):
                    existing_count += 1

    if existing_count > 0:
        print(f"\n✅ {existing_count} sessões redirecionadas")
    else:
        print("  ℹ️ Nenhuma sessão terminal encontrada")

    print("\n👁️ Iniciando monitoramento contínuo...")
    print("   Qualquer nova sessão terminal será redirecionada")
    print("   Pressione Ctrl+C para parar\n")

    # Inicia monitor
    redirector.monitor_and_redirect()

if __name__ == "__main__":
    main()