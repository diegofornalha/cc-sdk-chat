#!/usr/bin/env python3
"""
Script de teste para o Gerenciador Unificado de Sessões
"""

import asyncio
import json
from pathlib import Path
from unified_session_manager import UnifiedSessionManager

async def test_unified_manager():
    """Testa o gerenciador unificado"""
    print("🧪 Testando Gerenciador Unificado de Sessões\n")

    # Cria instância do gerenciador
    manager = UnifiedSessionManager()

    # Mostra estatísticas iniciais
    stats = manager.get_stats()
    print("📊 Estatísticas iniciais:")
    print(f"  - Arquivo unificado: {stats['unified_file']}")
    print(f"  - Linhas no arquivo: {stats['unified_lines']}")
    print(f"  - Tamanho: {stats['unified_size_mb']} MB")
    print()

    # Testa consolidação
    print("🔄 Executando consolidação...")
    total = manager.consolidate_existing_files()
    print(f"  - Total consolidado: {total} entradas")
    print()

    # Mostra estatísticas finais
    stats = manager.get_stats()
    print("📊 Estatísticas finais:")
    print(f"  - Linhas no arquivo: {stats['unified_lines']}")
    print(f"  - Tamanho: {stats['unified_size_mb']} MB")
    print()

    # Verifica conteúdo do arquivo unificado
    unified_file = Path(stats['unified_file'])
    if unified_file.exists():
        print("📄 Amostra do arquivo unificado:")
        with open(unified_file, 'r') as f:
            lines = f.readlines()

        # Mostra primeira e última entrada
        if lines:
            first = json.loads(lines[0])
            last = json.loads(lines[-1])

            print(f"  Primeira entrada:")
            print(f"    - Tipo: {first.get('type', 'N/A')}")
            print(f"    - SessionId: {first.get('sessionId', 'N/A')}")
            print(f"    - Timestamp: {first.get('timestamp', 'N/A')[:19]}")

            print(f"  Última entrada:")
            print(f"    - Tipo: {last.get('type', 'N/A')}")
            print(f"    - SessionId: {last.get('sessionId', 'N/A')}")
            print(f"    - Timestamp: {last.get('timestamp', 'N/A')[:19]}")

    print("\n✅ Teste concluído!")

if __name__ == "__main__":
    asyncio.run(test_unified_manager())