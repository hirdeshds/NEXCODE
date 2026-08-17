import asyncio
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import pytest
import httpx
from app.main import app
from app import config as config_module
from app.pipeline.mcp_connect import check_mcp_health, connect_mcp

client = TestClient(app)


# Helper to run async functions
def run_async(coro):
    return asyncio.run(coro)


def test_check_mcp_health_reachable():
    mock_response = AsyncMock()
    mock_response.status_code = 200
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=mock_response)) as mock_get:
        res = run_async(check_mcp_health(mcp_url="https://mock-mcp.local"))
        assert res == {"reachable": True, "status": "ok"}


def test_check_mcp_health_unreachable():
    mock_response = AsyncMock()
    mock_response.status_code = 500
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=mock_response)) as mock_get:
        res = run_async(check_mcp_health(mcp_url="https://mock-mcp.local"))
        assert res["reachable"] is False
        assert res["status"] == "error"
        assert "500" in res["error"]


def test_check_mcp_health_timeout():
    with patch("httpx.AsyncClient.get", new=AsyncMock(side_effect=httpx.TimeoutException("Timeout"))):
        res = run_async(check_mcp_health(mcp_url="https://mock-mcp.local"))
        assert res["reachable"] is False
        assert res["status"] == "error"
        assert "timed out" in res["error"]


def test_check_mcp_health_exception():
    with patch("httpx.AsyncClient.get", new=AsyncMock(side_effect=Exception("Connection refused"))):
        res = run_async(check_mcp_health(mcp_url="https://mock-mcp.local"))
        assert res["reachable"] is False
        assert res["status"] == "error"
        assert "Connection refused" in res["error"]


def test_connect_mcp_success():
    mock_response = AsyncMock()
    mock_response.json = lambda: {"status": "accepted"}
    mock_response.raise_for_status = lambda: None
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)):
        res = run_async(connect_mcp("https://mock-mcp.local", "scan", {"foo": "bar"}))
        assert res["status"] == "success"
        assert res["data"] == {"status": "accepted"}


def test_api_mcp_health_success():
    mock_res = {"reachable": True, "status": "ok"}
    with patch("app.main.check_mcp_health", new=AsyncMock(return_value=mock_res)):
        response = client.post("/pipeline/mcp/health", json={"mcp_url": "https://mcp.company.com"})
        assert response.status_code == 200
        assert response.json() == mock_res


def test_api_mcp_health_unreachable():
    mock_res = {"reachable": False, "status": "error", "error": "Connection refused"}
    with patch("app.main.check_mcp_health", new=AsyncMock(return_value=mock_res)):
        response = client.post("/pipeline/mcp/health", json={"mcp_url": "https://mcp.company.com"})
        assert response.status_code == 400
        assert response.json()["detail"] == "Connection refused"


def test_api_mcp_run_not_configured(monkeypatch):
    # Ensure config has no mcp section in config module and main namespace
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: {})
    monkeypatch.setattr("app.config.get_nexcode_config", lambda: {})
    
    response = client.post("/pipeline/mcp/run", json={
        "code": "print('hello')",
        "language": "python"
    })
    assert response.status_code == 400
    assert "not configured" in response.json()["detail"]


def test_api_mcp_run_health_fails(monkeypatch):
    # Configure MCP mock config
    mcp_mock_config = {
        "mcp": {
            "base_url": "https://mcp.company.com",
            "timeout_seconds": 5
        }
    }
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: mcp_mock_config)
    monkeypatch.setattr("app.config.get_nexcode_config", lambda: mcp_mock_config)
    
    # Mock health check fail
    mock_health = {"reachable": False, "status": "error", "error": "MCP server offline"}
    with patch("app.pipeline.mcp_connect.check_mcp_health", new=AsyncMock(return_value=mock_health)):
        response = client.post("/pipeline/mcp/run", json={
            "code": "print('hello')",
            "language": "python"
        })
        assert response.status_code == 400
        assert "health check failed: MCP server offline" in response.json()["detail"]


def test_api_mcp_run_connect_fails(monkeypatch):
    mcp_mock_config = {
        "mcp": {
            "base_url": "https://mcp.company.com"
        }
    }
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: mcp_mock_config)
    monkeypatch.setattr("app.config.get_nexcode_config", lambda: mcp_mock_config)
    
    mock_health = {"reachable": True, "status": "ok"}
    mock_connect = {"status": "error", "error": "Auth failed"}
    with patch("app.pipeline.mcp_connect.check_mcp_health", new=AsyncMock(return_value=mock_health)), \
         patch("app.pipeline.mcp_connect.connect_mcp", new=AsyncMock(return_value=mock_connect)):
        response = client.post("/pipeline/mcp/run", json={
            "code": "print('hello')",
            "language": "python"
        })
        assert response.status_code == 400
        assert "Failed to connect to MCP server: Auth failed" in response.json()["detail"]


def test_api_mcp_run_success(monkeypatch):
    mcp_mock_config = {
        "mcp": {
            "base_url": "https://mcp.company.com"
        }
    }
    monkeypatch.setattr("app.main.get_nexcode_config", lambda: mcp_mock_config)
    monkeypatch.setattr("app.config.get_nexcode_config", lambda: mcp_mock_config)
    
    mock_health = {"reachable": True, "status": "ok"}
    mock_connect = {"status": "success", "data": {}}
    pipeline_result = {
        "stage1": {"status": "pass"},
        "stage2": {"status": "pass"},
        "stage3": {"status": "pass"},
        "pr": {"status": "success", "pr_url": "https://example.com/pr/1"},
        "overall_status": "passed",
    }
    
    with patch("app.pipeline.mcp_connect.check_mcp_health", new=AsyncMock(return_value=mock_health)), \
         patch("app.pipeline.mcp_connect.connect_mcp", new=AsyncMock(return_value=mock_connect)), \
         patch("app.main.run_pipeline", new=AsyncMock(return_value=pipeline_result)):
        response = client.post("/pipeline/mcp/run", json={
            "code": "print('hello')",
            "language": "python"
        })
        assert response.status_code == 200
        assert response.json() == {"result": pipeline_result}
