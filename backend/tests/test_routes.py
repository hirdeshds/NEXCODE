from fastapi.testclient import TestClient

from app import config as config_module
from app.main import app


client = TestClient(app)


def test_health_check():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"message": "NexCode backend is running"}


def test_nexcode_config_uses_environment_values(monkeypatch):
    monkeypatch.setenv("GITHUB_REPO", "acme/demo")
    monkeypatch.setenv("GITHUB_TOKEN", "test-token")
    monkeypatch.setenv("GITHUB_BASE_BRANCH", "develop")
    config_module.get_nexcode_config.cache_clear()
    config_module.get_settings.cache_clear()

    config = config_module.get_nexcode_config()

    assert config["github"]["repo"] == "acme/demo"
    assert config["github"]["token"] == "test-token"
    assert config["github"]["base_branch"] == "develop"
