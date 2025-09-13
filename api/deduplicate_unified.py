#!/usr/bin/env python3
"""
Script para remover duplicados do arquivo unificado
Mantém apenas entradas únicas baseadas no UUID
"""

import json
from pathlib import Path
from datetime import datetime

def deduplicate_unified_file():
    """Remove duplicados do arquivo unificado mantendo ordem cronológica"""

    # Caminho do arquivo unificado
    unified_path = Path.home() / ".claude" / "unified-sessions" / "-Users-2a--claude-cc-sdk-chat-api_00000000-0000-0000-0000-000000000001.jsonl"

    if not unified_path.exists():
        print(f"❌ Arquivo não encontrado: {unified_path}")
        return

    print(f"📄 Processando: {unified_path}")

    # Lê todas as entradas
    entries = []
    seen_uuids = set()
    duplicates_count = 0

    with open(unified_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if not line.strip():
                continue

            try:
                data = json.loads(line)

                # Usa UUID como chave única (ou cria um hash único)
                entry_uuid = data.get('uuid')

                # Se não tem UUID, cria um identificador único baseado no conteúdo
                if not entry_uuid:
                    # Cria hash baseado em timestamp + tipo + parte do conteúdo
                    timestamp = data.get('timestamp', '')
                    entry_type = data.get('type', '')

                    # Para mensagens, usa parte do conteúdo
                    content_sample = ''
                    if 'message' in data:
                        msg = data['message']
                        if isinstance(msg, dict) and 'content' in msg:
                            content = msg['content']
                            if isinstance(content, str):
                                content_sample = content[:100]
                            elif isinstance(content, list) and content:
                                first_block = content[0]
                                if isinstance(first_block, dict) and 'text' in first_block:
                                    content_sample = first_block['text'][:100]

                    entry_uuid = f"{timestamp}_{entry_type}_{hash(content_sample)}"

                if entry_uuid not in seen_uuids:
                    seen_uuids.add(entry_uuid)
                    entries.append(data)
                else:
                    duplicates_count += 1

            except json.JSONDecodeError as e:
                print(f"  ⚠️ Linha {line_num} inválida: {e}")
                continue

    print(f"  📊 Total de entradas: {len(entries) + duplicates_count}")
    print(f"  🔄 Duplicados encontrados: {duplicates_count}")
    print(f"  ✅ Entradas únicas: {len(entries)}")

    if duplicates_count > 0:
        # Ordena por timestamp
        entries.sort(key=lambda x: x.get('timestamp', ''))

        # Faz backup do arquivo original
        backup_path = unified_path.with_suffix('.jsonl.backup')
        print(f"  💾 Criando backup: {backup_path.name}")
        unified_path.rename(backup_path)

        # Escreve arquivo limpo
        with open(unified_path, 'w', encoding='utf-8') as f:
            for entry in entries:
                # Garante que tem o sessionId unificado
                entry['sessionId'] = '00000000-0000-0000-0000-000000000001'
                f.write(json.dumps(entry) + '\n')

        print(f"  ✨ Arquivo limpo salvo com {len(entries)} entradas únicas")

        # Calcula tamanho dos arquivos
        original_size = backup_path.stat().st_size
        new_size = unified_path.stat().st_size
        saved = original_size - new_size

        print(f"  📉 Tamanho reduzido: {saved / 1024:.2f} KB ({saved / original_size * 100:.1f}%)")
    else:
        print("  ✅ Nenhum duplicado encontrado!")

    return len(entries), duplicates_count

if __name__ == "__main__":
    print("🧹 Removendo duplicados do arquivo unificado")
    print("=" * 50)

    unique_count, duplicate_count = deduplicate_unified_file()

    print("\n✅ Processo concluído!")
    print(f"   Entradas únicas mantidas: {unique_count}")
    print(f"   Duplicados removidos: {duplicate_count}")