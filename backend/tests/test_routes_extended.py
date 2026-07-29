from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import asyncio

from app.main import app
from app.pipeline.stage1_bugs import run_stage1

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


def test_pipeline_stage1_awaits_llm_response():
    llm_response = "STATUS: PASS\nBUGS: 0\nDETAILS: No bugs detected."

    with patch("app.pipeline.stage1_bugs.get_cohere_response", new=AsyncMock(return_value=llm_response)):
        result = asyncio.run(run_stage1("print('hello')", "python"))

    assert result["status"] == "pass"
    assert result["bugs_found"] == 0
    assert result["analysis"] == llm_response


def test_pipeline_scan_and_status_routes():
    pipeline_result = {
        "stage1": {"status": "pass"},
        "stage2": {"status": "pass"},
        "stage3": {"status": "pass"},
        "pr": {"status": "success", "pr_url": "https://example.com/pr/1"},
        "overall_status": "passed",
    }

    with patch("app.main.run_pipeline", new=AsyncMock(return_value=pipeline_result)):
        scan_response = client.post(
            "/pipeline/scan",
            json={
                "code": "print('hello')",
                "language": "python",
                "repo": "owner/repo",
                "github_token": "token",
            },
        )

    assert scan_response.status_code == 200
    scan_body = scan_response.json()
    assert scan_body["status"] == "processing"
    assert scan_body["job_id"]

    status_response = client.get(f"/pipeline/status/{scan_body['job_id']}")

    assert status_response.status_code == 200
    assert status_response.json()["result"] == pipeline_result


def test_pipeline_pr_route_awaits_pipeline():
    pipeline_result = {
        "stage1": {"status": "pass"},
        "stage2": {"status": "pass"},
        "stage3": {"status": "pass"},
        "pr": {"status": "success", "pr_url": "https://example.com/pr/1"},
        "overall_status": "passed",
    }

    with patch("app.main.run_pipeline", new=AsyncMock(return_value=pipeline_result)) as mocked_pipeline:
        response = client.post(
            "/pipeline/pr",
            json={
                "code": "print('hello')",
                "language": "python",
                "repo": "owner/repo",
                "github_token": "token",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"result": pipeline_result}
    mocked_pipeline.assert_awaited_once()
