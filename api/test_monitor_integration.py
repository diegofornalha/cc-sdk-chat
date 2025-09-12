#!/usr/bin/env python3
"""
Script de teste para verificar a integração do monitor com a API
"""

import requests
import time
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_monitor_health():
    """Testa o endpoint de health do monitor"""
    print("\n🔍 Testando Health Check do Monitor...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/monitor/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status: {data.get('status')}")
            print(f"   Uptime: {data.get('uptime', 0):.2f} segundos")
            print(f"   Arquivos monitorados: {data.get('files_monitored', 0)}")
            print(f"   Bytes processados: {data.get('bytes_processed', 0)}")
            print(f"   Restarts: {data.get('restarts', 0)}")
            
            if data.get('recommendation'):
                print(f"   ⚠️ Recomendação: {data['recommendation']}")
            
            return data.get('status') == 'healthy'
        else:
            print(f"❌ Erro: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return False

def test_monitor_stats():
    """Testa o endpoint de estatísticas"""
    print("\n📊 Testando Estatísticas do Monitor...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/monitor/stats")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Estatísticas obtidas:")
            print(f"   Caminho do projeto: {data.get('project_path', 'N/A')}")
            print(f"   Arquivo unificado: {data.get('unified_file', 'N/A')}")
            print(f"   Tamanho unificado: {data.get('unified_size', 0)} bytes")
            return True
        else:
            print(f"❌ Erro: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def test_monitor_control():
    """Testa controle do monitor (start/stop/restart)"""
    print("\n🎮 Testando Controle do Monitor...")
    
    # Testa restart
    print("   Testando restart...")
    try:
        response = requests.post(f"{BASE_URL}/api/monitor/restart")
        if response.status_code == 200:
            print("   ✅ Restart executado com sucesso")
            time.sleep(2)  # Aguarda reiniciar
            return True
        else:
            print(f"   ❌ Erro no restart: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False

def test_monitor_logs():
    """Testa obtenção de logs"""
    print("\n📝 Testando Logs do Monitor...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/monitor/logs?limit=5")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Logs obtidos:")
            print(f"   Total de erros: {data.get('total_errors', 0)}")
            print(f"   Status atual: {data.get('status', 'N/A')}")
            
            errors = data.get('errors', [])
            if errors:
                print(f"   Últimos {len(errors)} erros:")
                for error in errors[:3]:
                    print(f"      - {error.get('time', 'N/A')}: {error.get('error', 'N/A')[:50]}...")
            else:
                print("   ✨ Nenhum erro registrado")
            
            return True
        else:
            print(f"❌ Erro: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def main():
    """Executa todos os testes"""
    print("=" * 60)
    print("🚀 TESTE DE INTEGRAÇÃO DO MONITOR DE SESSÕES")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 API URL: {BASE_URL}")
    print("=" * 60)
    
    # Aguarda API iniciar se necessário
    print("\n⏳ Verificando conectividade com a API...")
    max_attempts = 5
    for i in range(max_attempts):
        try:
            response = requests.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                print("✅ API está online!")
                break
        except:
            if i < max_attempts - 1:
                print(f"   Tentativa {i+1}/{max_attempts}... aguardando 2s")
                time.sleep(2)
            else:
                print("❌ API não está respondendo. Verifique se está rodando.")
                return
    
    # Executa testes
    results = []
    
    results.append(("Health Check", test_monitor_health()))
    time.sleep(1)
    
    results.append(("Estatísticas", test_monitor_stats()))
    time.sleep(1)
    
    results.append(("Controle", test_monitor_control()))
    time.sleep(1)
    
    results.append(("Logs", test_monitor_logs()))
    
    # Resumo
    print("\n" + "=" * 60)
    print("📊 RESUMO DOS TESTES")
    print("=" * 60)
    
    total = len(results)
    passed = sum(1 for _, success in results if success)
    
    for test_name, success in results:
        status = "✅ PASSOU" if success else "❌ FALHOU"
        print(f"   {test_name}: {status}")
    
    print(f"\n🎯 Resultado: {passed}/{total} testes passaram")
    
    if passed == total:
        print("🎉 Todos os testes passaram! Monitor integrado com sucesso!")
    else:
        print("⚠️ Alguns testes falharam. Verifique os logs acima.")

if __name__ == "__main__":
    main()