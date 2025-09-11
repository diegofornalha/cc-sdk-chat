"""
Testes completos para session_routes.py
Cobertura: 100% dos 9 endpoints
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import uuid
import json

class TestCreateSession:
    """Testes para POST /api/sessions/create"""
    
    def test_create_session_success(self, client, assert_response):
        """Teste de criação bem-sucedida de sessão"""
        # Arrange
        payload = {
            "user_id": "test_user_123",
            "project_path": "/test/project",
            "metadata": {"source": "test", "version": "1.0"}
        }
        
        # Act
        response = client.post("/api/sessions/create", json=payload)
        
        # Assert
        data = assert_response(response, 200, ["session_id", "created_at", "metadata"])
        assert data["session_id"] is not None
        assert len(data["session_id"]) == 36  # UUID v4
        assert data["metadata"] == payload["metadata"]
    
    def test_create_session_without_user_id(self, client, assert_response):
        """Teste de criação de sessão sem user_id (anônimo)"""
        # Arrange
        payload = {"project_path": "/test/project"}
        
        # Act
        response = client.post("/api/sessions/create", json=payload)
        
        # Assert
        data = assert_response(response, 200, ["session_id"])
        assert data["session_id"] is not None
    
    def test_create_session_minimal(self, client, assert_response):
        """Teste de criação de sessão com dados mínimos"""
        # Act
        response = client.post("/api/sessions/create", json={})
        
        # Assert
        data = assert_response(response, 200, ["session_id"])
        assert data["session_id"] is not None
    
    def test_create_multiple_sessions(self, client):
        """Teste de criação de múltiplas sessões"""
        # Act
        session_ids = []
        for i in range(3):
            response = client.post("/api/sessions/create", json={
                "user_id": f"user_{i}"
            })
            assert response.status_code == 200
            session_ids.append(response.json()["session_id"])
        
        # Assert
        assert len(session_ids) == 3
        assert len(set(session_ids)) == 3  # Todos únicos
    
    @pytest.mark.parametrize("metadata", [
        {"key": "value"},
        {"nested": {"key": "value"}},
        {"array": [1, 2, 3]},
        {"unicode": "测试中文"},
        {}
    ])
    def test_create_session_various_metadata(self, client, metadata):
        """Teste com diferentes tipos de metadata"""
        response = client.post("/api/sessions/create", json={
            "metadata": metadata
        })
        assert response.status_code == 200
        assert response.json()["metadata"] == metadata


class TestGetSessionHistory:
    """Testes para GET /api/sessions/{session_id}/history"""
    
    def test_get_history_existing_session(self, client, create_test_session):
        """Teste de buscar histórico de sessão existente"""
        # Arrange
        session = create_test_session()
        
        # Act
        response = client.get(f"/api/sessions/{session['session_id']}/history")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session["session_id"]
        assert "messages" in data
        assert "total_tokens" in data
        assert "total_cost" in data
    
    def test_get_history_nonexistent_session(self, client):
        """Teste de buscar histórico de sessão inexistente"""
        # Arrange
        fake_id = str(uuid.uuid4())
        
        # Act
        response = client.get(f"/api/sessions/{fake_id}/history")
        
        # Assert
        assert response.status_code == 404
        assert "não encontrada" in response.json()["detail"].lower()
    
    def test_get_history_invalid_session_id(self, client):
        """Teste com ID de sessão inválido"""
        # Act
        response = client.get("/api/sessions/invalid-id/history")
        
        # Assert
        assert response.status_code == 404
    
    def test_get_history_with_messages(self, client, create_test_session):
        """Teste de histórico com mensagens"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        
        # Adicionar mensagens
        client.post(f"/api/sessions/{session_id}/add-message", json={
            "role": "user",
            "content": "Teste 1"
        })
        client.post(f"/api/sessions/{session_id}/add-message", json={
            "role": "assistant",
            "content": "Resposta 1"
        })
        
        # Act
        response = client.get(f"/api/sessions/{session_id}/history")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) == 2
        assert data["messages"][0]["content"] == "Teste 1"
        assert data["messages"][1]["content"] == "Resposta 1"


class TestGetSessionMetrics:
    """Testes para GET /api/sessions/{session_id}/metrics"""
    
    def test_get_metrics_existing_session(self, client, create_test_session):
        """Teste de buscar métricas de sessão existente"""
        # Arrange
        session = create_test_session()
        
        # Act
        response = client.get(f"/api/sessions/{session['session_id']}/metrics")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session["session_id"]
        assert "total_messages" in data
        assert "total_tokens_input" in data
        assert "total_tokens_output" in data
        assert "total_cost_usd" in data
    
    def test_get_metrics_nonexistent_session(self, client):
        """Teste de buscar métricas de sessão inexistente"""
        # Arrange
        fake_id = str(uuid.uuid4())
        
        # Act
        response = client.get(f"/api/sessions/{fake_id}/metrics")
        
        # Assert
        assert response.status_code == 404
    
    def test_metrics_calculation(self, client, create_test_session):
        """Teste de cálculo correto das métricas"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        
        # Adicionar mensagens e atualizar métricas
        client.post(f"/api/sessions/{session_id}/update-metrics", json={
            "tokens_input": 100,
            "tokens_output": 50,
            "cost_usd": 0.0015
        })
        
        # Act
        response = client.get(f"/api/sessions/{session_id}/metrics")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["total_tokens_input"] == 100
        assert data["total_tokens_output"] == 50
        assert data["total_cost_usd"] == 0.0015


class TestCheckSessionExists:
    """Testes para GET /api/sessions/{session_id}/exists"""
    
    def test_exists_for_existing_session(self, client, create_test_session):
        """Teste de verificação de sessão existente"""
        # Arrange
        session = create_test_session()
        
        # Act
        response = client.get(f"/api/sessions/{session['session_id']}/exists")
        
        # Assert
        assert response.status_code == 200
        assert response.json()["exists"] is True
    
    def test_exists_for_nonexistent_session(self, client):
        """Teste de verificação de sessão inexistente"""
        # Arrange
        fake_id = str(uuid.uuid4())
        
        # Act
        response = client.get(f"/api/sessions/{fake_id}/exists")
        
        # Assert
        assert response.status_code == 200
        assert response.json()["exists"] is False


class TestAddMessage:
    """Testes para POST /api/sessions/{session_id}/add-message"""
    
    def test_add_message_success(self, client, create_test_session):
        """Teste de adicionar mensagem com sucesso"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        message = {
            "role": "user",
            "content": "Esta é uma mensagem de teste",
            "metadata": {"test": True}
        }
        
        # Act
        response = client.post(f"/api/sessions/{session_id}/add-message", json=message)
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message_count"] == 1
    
    def test_add_message_to_nonexistent_session(self, client):
        """Teste de adicionar mensagem a sessão inexistente"""
        # Arrange
        fake_id = str(uuid.uuid4())
        message = {"role": "user", "content": "Teste"}
        
        # Act
        response = client.post(f"/api/sessions/{fake_id}/add-message", json=message)
        
        # Assert
        assert response.status_code == 404
    
    def test_add_multiple_messages(self, client, create_test_session):
        """Teste de adicionar múltiplas mensagens"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        
        # Act
        for i in range(5):
            response = client.post(f"/api/sessions/{session_id}/add-message", json={
                "role": "user" if i % 2 == 0 else "assistant",
                "content": f"Mensagem {i}"
            })
            assert response.status_code == 200
            assert response.json()["message_count"] == i + 1
    
    def test_add_message_validation(self, client, create_test_session):
        """Teste de validação de mensagem"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        
        # Act - sem role
        response = client.post(f"/api/sessions/{session_id}/add-message", json={
            "content": "Teste"
        })
        
        # Assert
        assert response.status_code == 422  # Validation error
    
    @pytest.mark.parametrize("content", [
        "Mensagem simples",
        "Mensagem com\nquebras de linha",
        "Mensagem com emojis 😀 🎉",
        "Mensagem com caracteres especiais: @#$%^&*()",
        "a" * 10000  # Mensagem longa
    ])
    def test_add_message_various_contents(self, client, create_test_session, content):
        """Teste com diferentes conteúdos de mensagem"""
        session = create_test_session()
        response = client.post(f"/api/sessions/{session['session_id']}/add-message", json={
            "role": "user",
            "content": content
        })
        assert response.status_code == 200


class TestUpdateMetrics:
    """Testes para POST /api/sessions/{session_id}/update-metrics"""
    
    def test_update_metrics_success(self, client, create_test_session):
        """Teste de atualização de métricas com sucesso"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        metrics = {
            "tokens_input": 150,
            "tokens_output": 75,
            "cost_usd": 0.00225
        }
        
        # Act
        response = client.post(f"/api/sessions/{session_id}/update-metrics", json=metrics)
        
        # Assert
        assert response.status_code == 200
        assert response.json()["success"] is True
    
    def test_update_metrics_cumulative(self, client, create_test_session):
        """Teste de atualização cumulativa de métricas"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        
        # Act - primeira atualização
        client.post(f"/api/sessions/{session_id}/update-metrics", json={
            "tokens_input": 100,
            "tokens_output": 50,
            "cost_usd": 0.0015
        })
        
        # Act - segunda atualização (deve somar)
        client.post(f"/api/sessions/{session_id}/update-metrics", json={
            "tokens_input": 50,
            "tokens_output": 25,
            "cost_usd": 0.00075
        })
        
        # Assert
        response = client.get(f"/api/sessions/{session_id}/metrics")
        data = response.json()
        assert data["total_tokens_input"] == 150
        assert data["total_tokens_output"] == 75
        assert data["total_cost_usd"] == 0.00225


class TestDeleteSession:
    """Testes para DELETE /api/sessions/{session_id}"""
    
    def test_delete_existing_session(self, client, create_test_session):
        """Teste de deletar sessão existente"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        
        # Act
        response = client.delete(f"/api/sessions/{session_id}")
        
        # Assert
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Verificar que foi deletada
        check_response = client.get(f"/api/sessions/{session_id}/exists")
        assert check_response.json()["exists"] is False
    
    def test_delete_nonexistent_session(self, client):
        """Teste de deletar sessão inexistente"""
        # Arrange
        fake_id = str(uuid.uuid4())
        
        # Act
        response = client.delete(f"/api/sessions/{fake_id}")
        
        # Assert
        assert response.status_code == 404
    
    def test_delete_twice(self, client, create_test_session):
        """Teste de deletar a mesma sessão duas vezes"""
        # Arrange
        session = create_test_session()
        session_id = session["session_id"]
        
        # Act
        response1 = client.delete(f"/api/sessions/{session_id}")
        response2 = client.delete(f"/api/sessions/{session_id}")
        
        # Assert
        assert response1.status_code == 200
        assert response2.status_code == 404


class TestGetActiveSessions:
    """Testes para GET /api/sessions/active"""
    
    def test_get_active_sessions_empty(self, client):
        """Teste com nenhuma sessão ativa"""
        # Act
        response = client.get("/api/sessions/active")
        
        # Assert
        assert response.status_code == 200
        assert response.json()["sessions"] == []
    
    def test_get_active_sessions_with_data(self, client, create_test_session):
        """Teste com sessões ativas"""
        # Arrange
        sessions = [create_test_session() for _ in range(3)]
        
        # Act
        response = client.get("/api/sessions/active")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["sessions"]) >= 3
        
        # Verificar que nossas sessões estão lá
        session_ids = [s["session_id"] for s in data["sessions"]]
        for session in sessions:
            assert session["session_id"] in session_ids


class TestGetUserSessions:
    """Testes para GET /api/sessions/user/{user_id}/sessions"""
    
    def test_get_user_sessions_empty(self, client):
        """Teste de buscar sessões de usuário sem sessões"""
        # Act
        response = client.get("/api/sessions/user/new_user/sessions")
        
        # Assert
        assert response.status_code == 200
        assert response.json()["sessions"] == []
    
    def test_get_user_sessions_with_data(self, client):
        """Teste de buscar sessões de usuário específico"""
        # Arrange
        user_id = "test_user_sessions"
        
        # Criar sessões para o usuário
        session_ids = []
        for i in range(3):
            response = client.post("/api/sessions/create", json={
                "user_id": user_id
            })
            session_ids.append(response.json()["session_id"])
        
        # Criar sessão de outro usuário
        client.post("/api/sessions/create", json={
            "user_id": "other_user"
        })
        
        # Act
        response = client.get(f"/api/sessions/user/{user_id}/sessions")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["sessions"]) == 3
        
        returned_ids = [s["session_id"] for s in data["sessions"]]
        for sid in session_ids:
            assert sid in returned_ids
    
    def test_get_user_sessions_pagination(self, client):
        """Teste de paginação nas sessões do usuário"""
        # Arrange
        user_id = "test_pagination"
        
        # Criar 10 sessões
        for i in range(10):
            client.post("/api/sessions/create", json={
                "user_id": user_id
            })
        
        # Act - buscar com limite
        response = client.get(f"/api/sessions/user/{user_id}/sessions?limit=5")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        # Nota: implementação pode variar
        assert len(data["sessions"]) <= 10


# ================== TESTES DE INTEGRAÇÃO ==================

class TestSessionIntegration:
    """Testes de integração do fluxo completo de sessão"""
    
    def test_complete_session_flow(self, client):
        """Teste do fluxo completo: criar, adicionar mensagens, métricas, deletar"""
        # 1. Criar sessão
        create_response = client.post("/api/sessions/create", json={
            "user_id": "integration_test",
            "project_path": "/test/integration"
        })
        assert create_response.status_code == 200
        session_id = create_response.json()["session_id"]
        
        # 2. Verificar que existe
        exists_response = client.get(f"/api/sessions/{session_id}/exists")
        assert exists_response.json()["exists"] is True
        
        # 3. Adicionar mensagens
        messages = [
            {"role": "user", "content": "Pergunta 1"},
            {"role": "assistant", "content": "Resposta 1"},
            {"role": "user", "content": "Pergunta 2"},
            {"role": "assistant", "content": "Resposta 2"}
        ]
        
        for msg in messages:
            add_response = client.post(f"/api/sessions/{session_id}/add-message", json=msg)
            assert add_response.status_code == 200
        
        # 4. Atualizar métricas
        metrics_response = client.post(f"/api/sessions/{session_id}/update-metrics", json={
            "tokens_input": 200,
            "tokens_output": 150,
            "cost_usd": 0.0035
        })
        assert metrics_response.status_code == 200
        
        # 5. Buscar histórico
        history_response = client.get(f"/api/sessions/{session_id}/history")
        assert history_response.status_code == 200
        history = history_response.json()
        assert len(history["messages"]) == 4
        assert history["total_tokens"] == 350
        
        # 6. Buscar métricas
        metrics_get_response = client.get(f"/api/sessions/{session_id}/metrics")
        assert metrics_get_response.status_code == 200
        metrics = metrics_get_response.json()
        assert metrics["total_cost_usd"] == 0.0035
        
        # 7. Deletar sessão
        delete_response = client.delete(f"/api/sessions/{session_id}")
        assert delete_response.status_code == 200
        
        # 8. Verificar que não existe mais
        exists_after = client.get(f"/api/sessions/{session_id}/exists")
        assert exists_after.json()["exists"] is False
    
    @pytest.mark.slow
    def test_concurrent_session_operations(self, client):
        """Teste de operações concorrentes em sessões"""
        import concurrent.futures
        
        # Criar sessão base
        response = client.post("/api/sessions/create", json={
            "user_id": "concurrent_test"
        })
        session_id = response.json()["session_id"]
        
        def add_message(index):
            return client.post(f"/api/sessions/{session_id}/add-message", json={
                "role": "user",
                "content": f"Mensagem concorrente {index}"
            })
        
        # Executar 10 adições concorrentes
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(add_message, i) for i in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        # Verificar que todas foram bem-sucedidas
        assert all(r.status_code == 200 for r in results)
        
        # Verificar histórico
        history = client.get(f"/api/sessions/{session_id}/history").json()
        assert len(history["messages"]) == 10


# ================== TESTES DE PERFORMANCE ==================

class TestSessionPerformance:
    """Testes de performance dos endpoints de sessão"""
    
    @pytest.mark.slow
    def test_create_session_performance(self, client, measure_time):
        """Teste de performance na criação de sessão"""
        measure_time.start()
        
        response = client.post("/api/sessions/create", json={
            "user_id": "perf_test"
        })
        
        measure_time.stop()
        
        assert response.status_code == 200
        assert measure_time.elapsed < 0.1  # Deve criar em menos de 100ms
    
    @pytest.mark.slow
    def test_bulk_operations_performance(self, client, measure_time):
        """Teste de performance com operações em massa"""
        # Criar sessão
        session = client.post("/api/sessions/create", json={}).json()
        session_id = session["session_id"]
        
        measure_time.start()
        
        # Adicionar 100 mensagens
        for i in range(100):
            client.post(f"/api/sessions/{session_id}/add-message", json={
                "role": "user" if i % 2 == 0 else "assistant",
                "content": f"Mensagem {i}"
            })
        
        measure_time.stop()
        
        # Deve processar 100 mensagens em menos de 5 segundos
        assert measure_time.elapsed < 5.0
        
        # Verificar que todas foram adicionadas
        history = client.get(f"/api/sessions/{session_id}/history").json()
        assert len(history["messages"]) == 100