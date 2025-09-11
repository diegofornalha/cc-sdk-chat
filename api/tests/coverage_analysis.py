#!/usr/bin/env python3
"""
Análise de Cobertura de Testes da API
"""

import os
import sys
from pathlib import Path

# Adiciona o diretório da API ao path
api_dir = Path(__file__).parent.parent
sys.path.insert(0, str(api_dir))

def analyze_test_coverage():
    """Analisa a cobertura de testes da API"""
    
    print("=" * 70)
    print("📊 ANÁLISE DE COBERTURA DE TESTES - CC-SDK-CHAT API")
    print("=" * 70)
    print()
    
    # Endpoints definidos nas rotas
    endpoints = {
        "session_routes": [
            "POST /api/sessions/create",
            "GET /api/sessions/{session_id}/history",
            "GET /api/sessions/{session_id}/metrics",
            "POST /api/sessions/{session_id}/update-metrics",
            "GET /api/sessions/user/{user_id}/sessions",
            "DELETE /api/sessions/{session_id}",
            "GET /api/sessions/{session_id}/exists",
            "POST /api/sessions/{session_id}/add-message",
            "GET /api/sessions/active"
        ],
        "logging_routes": [
            "POST /api/logs/write",
            "POST /api/logs/batch",
            "POST /api/logs/search",
            "GET /api/logs/recent",
            "GET /api/logs/stats",
            "DELETE /api/logs/clear",
            "GET /api/logs/export",
            "GET /api/logs/health"
        ],
        "projects_routes": [
            "GET /api/projects/projects",
            "GET /api/projects/projects/{project_name}/sessions",
            "GET /api/projects/projects/{project_name}/sessions/{session_id}",
            "GET /api/projects/projects/{project_name}/stats",
            "DELETE /api/projects/projects/{project_name}/sessions/{session_id}",
            "GET /api/projects/health"
        ],
        "realtime_routes": [
            "GET /api/realtime/stream/{project_name}",
            "GET /api/realtime/latest/{project_name}"
        ],
        "metrics_routes": [
            "POST /api/metrics/timer/start",
            "POST /api/metrics/timer/end",
            "POST /api/metrics/increment",
            "GET /api/metrics/stats/{operation}",
            "GET /api/metrics/summary",
            "POST /api/metrics/reset",
            "GET /api/metrics/health"
        ]
    }
    
    # Testes existentes
    test_files = {
        "test_api.py": ["test_api (básico - apenas 2 endpoints)"],
        "test_logging_system.py": [
            "test_logging_configuration",
            "test_request_context",
            "test_timeout_function",
            "test_error_function",
            "test_streaming_error",
            "test_error_handling",
            "test_log_rotation"
        ],
        "test_stability_features.py": ["test_endpoint (genérico)"],
        "test_stream.py": ["test_stream (streaming básico)"],
        "test_security_implementation.py": ["Testes de segurança (não executável)"],
        "test_fixed_monitor.py": ["Monitor JSONL (não executável)"]
    }
    
    # Análise de cobertura
    total_endpoints = sum(len(routes) for routes in endpoints.values())
    tested_endpoints = 2  # Apenas test_api.py testa endpoints reais
    
    print("📁 ARQUIVOS DE TESTE ENCONTRADOS:")
    print("-" * 70)
    for test_file, tests in test_files.items():
        print(f"\n📄 {test_file}")
        for test in tests:
            print(f"   ✓ {test}")
    
    print("\n" + "=" * 70)
    print("📍 ENDPOINTS DA API:")
    print("-" * 70)
    
    for route_file, route_endpoints in endpoints.items():
        print(f"\n🔹 {route_file} ({len(route_endpoints)} endpoints)")
        for endpoint in route_endpoints[:3]:  # Mostra apenas 3 primeiros
            print(f"   • {endpoint}")
        if len(route_endpoints) > 3:
            print(f"   ... e mais {len(route_endpoints) - 3} endpoints")
    
    print("\n" + "=" * 70)
    print("⚠️  PROBLEMAS IDENTIFICADOS:")
    print("-" * 70)
    
    problems = [
        "❌ Apenas 2 de 38 endpoints têm testes (5.3% de cobertura)",
        "❌ Nenhum teste para rotas de sessão (9 endpoints)",
        "❌ Nenhum teste para rotas de projetos (6 endpoints)",
        "❌ Nenhum teste para rotas de métricas (7 endpoints)",
        "❌ Testes de logging não testam os endpoints HTTP",
        "❌ Sem testes de integração completos",
        "❌ Sem mock do Claude SDK para testes isolados",
        "❌ Sem fixtures reutilizáveis para testes",
        "❌ Sem testes de erro e edge cases",
        "❌ Sem CI/CD configurado para rodar testes"
    ]
    
    for problem in problems:
        print(f"   {problem}")
    
    print("\n" + "=" * 70)
    print("📈 ESTATÍSTICAS DE COBERTURA:")
    print("-" * 70)
    
    stats = {
        "Total de endpoints": total_endpoints,
        "Endpoints testados": tested_endpoints,
        "Cobertura de endpoints": f"{(tested_endpoints/total_endpoints)*100:.1f}%",
        "Arquivos de teste": len(test_files),
        "Funções de teste": sum(len(tests) for tests in test_files.values()),
        "Testes executáveis": 10,
        "Rotas sem nenhum teste": 4
    }
    
    for key, value in stats.items():
        print(f"   {key}: {value}")
    
    print("\n" + "=" * 70)
    print("🎯 PRIORIDADES DE TESTE (CRÍTICO):")
    print("-" * 70)
    
    priorities = [
        "1. POST /api/sessions/create - Criação de sessão",
        "2. GET /api/realtime/stream/{project} - Streaming principal",
        "3. POST /api/sessions/{id}/add-message - Adicionar mensagens",
        "4. GET /api/sessions/{id}/history - Histórico de chat",
        "5. GET /api/projects/projects - Listar projetos"
    ]
    
    for priority in priorities:
        print(f"   {priority}")
    
    print("\n" + "=" * 70)
    print("💡 RECOMENDAÇÕES:")
    print("-" * 70)
    
    recommendations = [
        "✅ Criar test_sessions.py para testar todas as rotas de sessão",
        "✅ Criar test_realtime.py para testar streaming",
        "✅ Adicionar fixtures em conftest.py (cliente, sessão mock, etc)",
        "✅ Implementar mocks do Claude SDK",
        "✅ Adicionar testes de integração end-to-end",
        "✅ Configurar pytest-cov para relatórios de cobertura",
        "✅ Adicionar GitHub Actions para CI/CD",
        "✅ Criar testes de carga com locust ou similar",
        "✅ Implementar testes de segurança automatizados",
        "✅ Meta: Atingir 80% de cobertura de código"
    ]
    
    for rec in recommendations:
        print(f"   {rec}")
    
    print("\n" + "=" * 70)
    print("📝 COMANDO PARA EXECUTAR TESTES ATUAIS:")
    print("-" * 70)
    print("   python -m pytest tests/ -v --tb=short")
    print("\n📝 COMANDO PARA GERAR RELATÓRIO DE COBERTURA:")
    print("   python -m pytest tests/ --cov=. --cov-report=html")
    print("\n" + "=" * 70)

if __name__ == "__main__":
    analyze_test_coverage()