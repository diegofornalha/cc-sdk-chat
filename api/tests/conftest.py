"""
Configuração global de testes para a API CC-SDK-CHAT
Fornece fixtures, mocks e utilitários para todos os testes
"""

import pytest
import asyncio
from typing import Generator, AsyncGenerator, Dict, Any
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime
import uuid
import json
from pathlib import Path

# Importar aplicação principal
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from server import app

# ================== CONFIGURAÇÕES GLOBAIS ==================

@pytest.fixture(scope="session")
def event_loop():
    """Cria um event loop para testes assíncronos"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def test_config():
    """Configurações de teste"""
    return {
        "test_mode": True,
        "api_url": "http://testserver",
        "timeout": 5,
        "max_retries": 1,
        "mock_claude": True,
        "test_session_id": "00000000-0000-0000-0000-000000000001",
        "test_user_id": "test_user_001",
        "test_project": "test-project"
    }

# ================== CLIENTE DE TESTE ==================

@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Cliente de teste FastAPI"""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
async def async_client():
    """Cliente assíncrono para testes async"""
    from httpx import AsyncClient
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

# ================== MOCKS DO CLAUDE SDK ==================

@pytest.fixture
def mock_claude_sdk():
    """Mock do Claude SDK"""
    with patch('claude_code_sdk.query') as mock_query:
        # Configurar resposta padrão
        mock_query.return_value = {
            "content": "Resposta mockada do Claude",
            "tokens": {
                "input": 100,
                "output": 50,
                "total": 150
            },
            "cost": 0.0015,
            "model": "claude-3-opus-20240229",
            "cache_hit": False
        }
        yield mock_query

@pytest.fixture
def mock_claude_streaming():
    """Mock para streaming do Claude"""
    async def mock_stream():
        responses = [
            {"type": "text_chunk", "content": "Esta "},
            {"type": "text_chunk", "content": "é "},
            {"type": "text_chunk", "content": "uma "},
            {"type": "text_chunk", "content": "resposta "},
            {"type": "text_chunk", "content": "em streaming."},
            {"type": "done", "tokens": 150, "cost": 0.0015}
        ]
        for response in responses:
            yield json.dumps(response)
            await asyncio.sleep(0.01)
    
    return mock_stream

# ================== FIXTURES DE DADOS ==================

@pytest.fixture
def sample_session():
    """Sessão de exemplo para testes"""
    session_id = str(uuid.uuid4())
    return {
        "session_id": session_id,
        "user_id": "test_user_001",
        "project_path": "/test/project",
        "created_at": datetime.utcnow().isoformat(),
        "last_activity": datetime.utcnow().isoformat(),
        "messages": [],
        "metrics": {
            "total_tokens_input": 0,
            "total_tokens_output": 0,
            "total_cost_usd": 0.0,
            "message_count": 0
        },
        "metadata": {
            "source": "test",
            "version": "1.0.0"
        }
    }

@pytest.fixture
def sample_message():
    """Mensagem de exemplo para testes"""
    return {
        "role": "user",
        "content": "Olá, esta é uma mensagem de teste",
        "timestamp": datetime.utcnow().isoformat(),
        "tokens": 15,
        "cost": 0.00015,
        "metadata": {}
    }

@pytest.fixture
def sample_messages():
    """Lista de mensagens para testes"""
    return [
        {
            "role": "user",
            "content": "Qual é a capital do Brasil?",
            "timestamp": datetime.utcnow().isoformat(),
            "tokens": 10
        },
        {
            "role": "assistant",
            "content": "A capital do Brasil é Brasília.",
            "timestamp": datetime.utcnow().isoformat(),
            "tokens": 12
        },
        {
            "role": "user",
            "content": "E qual é a população?",
            "timestamp": datetime.utcnow().isoformat(),
            "tokens": 8
        },
        {
            "role": "assistant",
            "content": "Brasília tem aproximadamente 3 milhões de habitantes.",
            "timestamp": datetime.utcnow().isoformat(),
            "tokens": 15
        }
    ]

@pytest.fixture
def sample_project():
    """Projeto de exemplo para testes"""
    return {
        "name": "test-project",
        "path": "/Users/test/projects/test-project",
        "sessions": [],
        "created_at": datetime.utcnow().isoformat(),
        "total_messages": 0,
        "total_tokens": 0,
        "total_cost": 0.0
    }

# ================== MOCKS DE SISTEMA ==================

@pytest.fixture
def mock_file_system(tmp_path):
    """Mock do sistema de arquivos"""
    # Criar estrutura de diretórios de teste
    project_dir = tmp_path / "test-project"
    project_dir.mkdir()
    
    sessions_dir = project_dir / ".claude" / "sessions"
    sessions_dir.mkdir(parents=True)
    
    # Criar arquivo JSONL de teste
    test_jsonl = sessions_dir / "test-session.jsonl"
    test_jsonl.write_text('{"role": "user", "content": "test"}\n')
    
    return {
        "root": tmp_path,
        "project_dir": project_dir,
        "sessions_dir": sessions_dir,
        "test_jsonl": test_jsonl
    }

@pytest.fixture
def mock_redis():
    """Mock do Redis para cache"""
    cache = {}
    
    mock = MagicMock()
    mock.get = lambda key: cache.get(key)
    mock.set = lambda key, value, ex=None: cache.update({key: value})
    mock.delete = lambda key: cache.pop(key, None)
    mock.exists = lambda key: key in cache
    mock.keys = lambda pattern="*": list(cache.keys())
    mock.flushall = lambda: cache.clear()
    
    return mock

# ================== FIXTURES DE RESPOSTA ==================

@pytest.fixture
def success_response():
    """Resposta de sucesso padrão"""
    return {
        "status": "success",
        "message": "Operação realizada com sucesso",
        "data": {}
    }

@pytest.fixture
def error_response():
    """Resposta de erro padrão"""
    return {
        "status": "error",
        "message": "Erro ao processar requisição",
        "error": "Internal Server Error",
        "code": 500
    }

# ================== UTILITÁRIOS DE TESTE ==================

@pytest.fixture
def assert_response():
    """Utilitário para validar respostas HTTP"""
    def _assert(response, status_code=200, has_fields=None):
        assert response.status_code == status_code
        
        if has_fields:
            data = response.json()
            for field in has_fields:
                assert field in data, f"Campo '{field}' não encontrado na resposta"
        
        return response.json() if response.content else None
    
    return _assert

@pytest.fixture
def create_test_session(client):
    """Factory para criar sessões de teste"""
    created_sessions = []
    
    def _create(user_id="test_user", project_path="/test"):
        response = client.post("/api/sessions/create", json={
            "user_id": user_id,
            "project_path": project_path,
            "metadata": {"test": True}
        })
        assert response.status_code == 200
        session = response.json()
        created_sessions.append(session["session_id"])
        return session
    
    yield _create
    
    # Cleanup: deletar sessões criadas
    for session_id in created_sessions:
        try:
            client.delete(f"/api/sessions/{session_id}")
        except:
            pass

# ================== FIXTURES DE AUTENTICAÇÃO ==================

@pytest.fixture
def auth_headers():
    """Headers de autenticação para testes"""
    return {
        "Authorization": "Bearer test_token_12345",
        "X-API-Key": "test_api_key",
        "X-User-ID": "test_user_001"
    }

@pytest.fixture
def admin_headers():
    """Headers de admin para testes"""
    return {
        "Authorization": "Bearer admin_token_12345",
        "X-API-Key": "admin_api_key",
        "X-User-ID": "admin_user",
        "X-Admin": "true"
    }

# ================== FIXTURES DE PERFORMANCE ==================

@pytest.fixture
def measure_time():
    """Mede tempo de execução"""
    import time
    
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            
        def start(self):
            self.start_time = time.time()
            
        def stop(self):
            self.end_time = time.time()
            return self.elapsed
            
        @property
        def elapsed(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
    
    return Timer()

# ================== FIXTURES DE LIMPEZA ==================

@pytest.fixture(autouse=True)
def cleanup_cache():
    """Limpa cache entre testes"""
    yield
    # Limpar caches globais após cada teste
    from routes.session_routes import sessions_cache, user_sessions
    sessions_cache.clear()
    user_sessions.clear()

@pytest.fixture(autouse=True)
def reset_metrics():
    """Reseta métricas entre testes"""
    yield
    # Resetar contadores de métricas se existir
    try:
        from routes.metrics_routes import metrics_store
        if hasattr(metrics_store, 'clear'):
            metrics_store.clear()
    except ImportError:
        pass  # Módulo pode não ter metrics_store

# ================== CONFIGURAÇÕES DE PYTEST ==================

def pytest_configure(config):
    """Configuração global do pytest"""
    config.addinivalue_line(
        "markers", "slow: marca testes lentos"
    )
    config.addinivalue_line(
        "markers", "integration: marca testes de integração"
    )
    config.addinivalue_line(
        "markers", "unit: marca testes unitários"
    )
    config.addinivalue_line(
        "markers", "streaming: marca testes de streaming"
    )

# ================== HOOKS DE TESTE ==================

def pytest_runtest_setup(item):
    """Setup executado antes de cada teste"""
    # Configurar variáveis de ambiente de teste
    import os
    os.environ["TESTING"] = "true"
    os.environ["LOG_LEVEL"] = "DEBUG"

def pytest_runtest_teardown(item):
    """Teardown executado após cada teste"""
    # Limpar variáveis de ambiente
    import os
    os.environ.pop("TESTING", None)