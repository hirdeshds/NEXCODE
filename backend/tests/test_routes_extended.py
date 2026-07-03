from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.main import app

client = TestClient(app)


def test_ai_router_explain():
    with patch("app.main.get_cohere_response", new=AsyncMock(return_value="This code prints hello.")):
        response = client.post("/ai", json={"feature": "explain", "text": "print('hello')"})

    assert response.status_code == 200
    assert response.json() == {"explanation": "This code prints hello."}


def test_ai_router_generate():
    with patch("app.main.get_cohere_response", new=AsyncMock(return_value="print('generated')")):
        response = client.post("/ai", json={"feature": "generate", "prompt": "Create a hello world script."})

    assert response.status_code == 200
    assert response.json() == {"code": "print('generated')"}


def test_explain_route_with_prompt_field():
    with patch("app.main.get_cohere_response", new=AsyncMock(return_value="Explained.")):
        response = client.post("/explain", json={"text": "print('hello')"})

    assert response.status_code == 200
    assert response.json() == {"explanation": "Explained."}


def test_generate_route_with_code_field():
    with patch("app.main.get_cohere_response", new=AsyncMock(return_value="print('generated')")):
        response = client.post("/generate", json={"code": "Create a function to add numbers."})

    assert response.status_code == 200
    assert response.json() == {"code": "print('generated')"}
