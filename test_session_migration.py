#!/usr/bin/env python3
"""
Script de teste para verificar migração de sessão temporária para real
"""

import requests
import time
import json
from datetime import datetime

def test_session_migration():
    """Testa o fluxo completo de migração de sessão"""
    
    print("╔════════════════════════════════════════╗")
    print("║   🧪 TESTE DE MIGRAÇÃO DE SESSÃO       ║")
    print("╚════════════════════════════════════════╝")
    
    base_url = "http://localhost:8990"
    
    # 1. Verificar se API está disponível
    print("\n1️⃣ Verificando API...")
    try:
        response = requests.get(f"{base_url}/")
        if response.json()["status"] == "ok":
            print("   ✅ API está funcionando")
        else:
            print("   ❌ API não está respondendo corretamente")
            return
    except Exception as e:
        print(f"   ❌ Erro ao conectar na API: {e}")
        return
    
    # 2. Criar nova sessão
    print("\n2️⃣ Criando nova sessão...")
    try:
        response = requests.post(f"{base_url}/api/new-session")
        session_data = response.json()
        session_id = session_data.get("session_id")
        print(f"   ✅ Sessão criada: {session_id}")
    except Exception as e:
        print(f"   ❌ Erro ao criar sessão: {e}")
        return
    
    # 3. Enviar mensagem de teste
    print("\n3️⃣ Enviando mensagem de teste...")
    test_message = "Olá! Este é um teste de migração de sessão."
    
    try:
        # Enviar mensagem via POST
        response = requests.post(
            f"{base_url}/api/chat",
            json={
                "message": test_message,
                "session_id": session_id
            },
            stream=True
        )
        
        print(f"   📤 Mensagem enviada: '{test_message}'")
        print("   📥 Processando resposta em streaming...")
        
        real_session_id = None
        content_received = []
        
        # Processar resposta SSE
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    try:
                        data = json.loads(line_str[6:])
                        
                        if data['type'] == 'assistant_text':
                            content_received.append(data.get('content', ''))
                        elif data['type'] == 'result':
                            real_session_id = data.get('session_id')
                            print(f"\n   🎯 SDK retornou session_id real: {real_session_id}")
                            
                    except json.JSONDecodeError:
                        pass
        
        print(f"   ✅ Resposta recebida ({len(''.join(content_received))} caracteres)")
        
    except Exception as e:
        print(f"   ❌ Erro ao enviar mensagem: {e}")
        return
    
    # 4. Verificar sessão real
    print("\n4️⃣ Verificando migração...")
    
    if real_session_id and real_session_id != session_id:
        print(f"   ✅ MIGRAÇÃO DETECTADA!")
        print(f"      ├─ Sessão inicial: {session_id}")
        print(f"      └─ Sessão real: {real_session_id}")
        
        # Validar sessão real
        try:
            response = requests.get(f"{base_url}/api/validate-session/{real_session_id}")
            validation = response.json()
            
            if validation.get("valid"):
                print(f"   ✅ Sessão real validada com sucesso!")
            else:
                print(f"   ⚠️ Sessão real não validada: {validation.get('error')}")
                
        except Exception as e:
            print(f"   ❌ Erro ao validar sessão: {e}")
            
    else:
        print(f"   ⚠️ Nenhuma migração detectada")
        print(f"      Session ID permanece: {session_id}")
    
    # 5. Listar sessões reais no sistema
    print("\n5️⃣ Listando sessões reais no sistema...")
    try:
        response = requests.get(f"{base_url}/api/real-sessions")
        sessions_data = response.json()
        sessions = sessions_data.get("sessions", [])
        
        print(f"   📋 Total de sessões reais: {len(sessions)}")
        for idx, sid in enumerate(sessions[:3], 1):
            print(f"      {idx}. {sid}")
            
    except Exception as e:
        print(f"   ❌ Erro ao listar sessões: {e}")
    
    print("\n╚════════════════════════════════════════╝")
    print("✅ TESTE CONCLUÍDO!")
    
    # Retornar resultado
    return {
        "initial_session": session_id,
        "real_session": real_session_id,
        "migration_successful": real_session_id and real_session_id != session_id
    }

if __name__ == "__main__":
    result = test_session_migration()
    
    if result and result["migration_successful"]:
        print("\n🎉 SUCESSO: Migração funcionou corretamente!")
        print(f"   Interface deve mostrar: {result['real_session'][-8:]}")
    else:
        print("\n⚠️ ATENÇÃO: Migração não ocorreu como esperado!")
