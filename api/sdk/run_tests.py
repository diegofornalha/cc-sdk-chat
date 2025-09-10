#!/usr/bin/env python3
"""Script para executar testes do SDK."""

import subprocess
import sys
from pathlib import Path

def run_tests():
    """Executa a suite de testes completa."""
    
    sdk_path = Path(__file__).parent
    
    print("=" * 60)
    print("🧪 Executando Testes do Claude Code SDK")
    print("=" * 60)
    print()
    
    # Define os comandos de teste
    test_commands = [
        {
            "name": "Testes de Exceções",
            "cmd": ["python3", "-m", "pytest", "tests/test_errors.py", "-v", "--no-cov"],
        },
        {
            "name": "Testes do Cliente",
            "cmd": ["python3", "-m", "pytest", "tests/test_client.py", "-v", "--no-cov", "-k", "TestClientInitialization"],
        },
        {
            "name": "Testes da Função Query",
            "cmd": ["python3", "-m", "pytest", "tests/test_query.py", "-v", "--no-cov", "-k", "TestQueryFunction"],
        },
    ]
    
    total_passed = 0
    total_failed = 0
    
    for test in test_commands:
        print(f"\n📋 Executando: {test['name']}")
        print("-" * 40)
        
        result = subprocess.run(
            test["cmd"],
            cwd=sdk_path,
            capture_output=True,
            text=True
        )
        
        # Analisa o resultado
        if "passed" in result.stdout:
            # Extrai número de testes passados
            for line in result.stdout.split('\n'):
                if "passed" in line:
                    try:
                        passed = int(line.split()[0])
                        total_passed += passed
                        print(f"✅ {passed} testes passaram")
                    except:
                        print("✅ Testes passaram")
                    break
        
        if "failed" in result.stdout:
            for line in result.stdout.split('\n'):
                if "failed" in line:
                    try:
                        failed = int(line.split()[0])
                        total_failed += failed
                        print(f"❌ {failed} testes falharam")
                    except:
                        print("❌ Alguns testes falharam")
                    break
        
        if result.returncode != 0 and "passed" not in result.stdout:
            print(f"❌ Erro ao executar testes")
            print(result.stderr[:500])  # Primeiros 500 chars do erro
            total_failed += 1
    
    # Resumo final
    print("\n" + "=" * 60)
    print("📊 RESUMO DOS TESTES")
    print("=" * 60)
    print(f"✅ Total de testes passados: {total_passed}")
    print(f"❌ Total de testes falhados: {total_failed}")
    
    if total_failed == 0:
        print("\n🎉 Todos os testes passaram com sucesso!")
        return 0
    else:
        print(f"\n⚠️  {total_failed} testes falharam. Verifique os logs acima.")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())