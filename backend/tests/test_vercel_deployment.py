import asyncio
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import pytest
import httpx
from app.main import app
from app import config as config_module

client = TestClient(app)


def test_deploy_not_vercel_provider(monkeypatch):
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: {
        "deployment": {
            "provider": "render"
        }
    })
    response = client.post("/pipeline/deploy", json={})
    assert response.status_code == 400
    assert "not set to vercel" in response.json()["detail"]


def test_deploy_missing_token_or_project(monkeypatch):
    # Test placeholder token validation
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: {
        "deployment": {
            "provider": "vercel",
            "token": "YOUR_VERCEL_TOKEN",
            "project_id": "test-project"
        }
    })
    response = client.post("/pipeline/deploy", json={})
    assert response.status_code == 400
    assert "token is not configured" in response.json()["detail"]

    # Test missing project ID validation
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: {
        "deployment": {
            "provider": "vercel",
            "token": "valid-token"
        }
    })
    response = client.post("/pipeline/deploy", json={})
    assert response.status_code == 400
    assert "project_id is not configured" in response.json()["detail"]


def test_deploy_missing_repo(monkeypatch):
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: {
        "deployment": {
            "provider": "vercel",
            "token": "test-token",
            "project_id": "test-project"
        },
        "github": {}
    })
    response = client.post("/pipeline/deploy", json={})
    assert response.status_code == 400
    assert "Repository slug is not configured" in response.json()["detail"]


def test_deploy_vercel_api_success(monkeypatch):
    # Mock configuration
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: {
        "deployment": {
            "provider": "vercel",
            "token": "test-token",
            "project_id": "test-project",
            "production": True
        },
        "github": {
            "repo": "owner/repo",
            "base_branch": "main"
        }
    })

    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json = lambda: {
        "url": "my-project-abc.vercel.app",
        "id": "dpl_123456",
        "status": "QUEUED"
    }

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)) as mock_post:
        response = client.post("/pipeline/deploy", json={
            "repo": "custom/repo",
            "branch": "custom-branch"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["deployment_url"] == "https://my-project-abc.vercel.app"
        assert data["deployment_id"] == "dpl_123456"
        assert data["status"] == "QUEUED"

        # Check mock post arguments
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://api.vercel.com/v13/deployments"
        assert kwargs["headers"]["Authorization"] == "Bearer test-token"
        assert kwargs["json"]["projectId"] == "test-project"
        assert kwargs["json"]["target"] == "production"
        assert kwargs["json"]["gitSource"]["repo"] == "custom/repo"
        assert kwargs["json"]["gitSource"]["ref"] == "custom-branch"


def test_deploy_vercel_api_error_forwarding(monkeypatch):
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: {
        "deployment": {
            "provider": "vercel",
            "token": "test-token",
            "project_id": "test-project"
        },
        "github": {
            "repo": "owner/repo"
        }
    })

    mock_response = AsyncMock()
    mock_response.status_code = 403
    mock_response.json = lambda: {
        "error": {
            "code": "forbidden",
            "message": "You don't have access to this project."
        }
    }

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)):
        response = client.post("/pipeline/deploy", json={})
        assert response.status_code == 403
        assert "You don't have access to this project" in response.json()["detail"]


def test_deploy_vercel_connection_failure(monkeypatch):
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: {
        "deployment": {
            "provider": "vercel",
            "token": "test-token",
            "project_id": "test-project"
        },
        "github": {
            "repo": "owner/repo"
        }
    })

    with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=httpx.ConnectError("Network down"))):
        response = client.post("/pipeline/deploy", json={})
        assert response.status_code == 500
        assert "Network down" in response.json()["detail"]
