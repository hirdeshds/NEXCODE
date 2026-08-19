import json
import uuid
import logging
import asyncio
from contextlib import suppress
from fastapi import FastAPI, HTTPException, Request, Header
from typing import Optional
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.llm import get_cohere_response, get_cohere_stream_response
from app.schemas import AIRequest, BaseInput, CodeRequest, PromptRequest, PipelineRequest, MCPHealthRequest, DeployRequest
from app.pipeline.agent import run_pipeline
from app.pipeline.job_store import PipelineJobStore
from app.pipeline.mcp_connect import check_mcp_health
from app.config import get_nexcode_config, get_settings
from app.independent_api import independent_api

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NexCode Backend",
    description="Backend API for NexCode, providing AI-powered code analysis and generation.",
    version="1.0.0"
)

settings = get_settings()
pipeline_job_store = PipelineJobStore(settings.pipeline_db_path)
pipeline_workers: list[asyncio.Task] = []


def has_active_pipeline_worker() -> bool:
    current_loop = asyncio.get_running_loop()
    return any(
        not worker.done()
        and worker.get_loop() is current_loop
        and worker.get_loop().is_running()
        for worker in pipeline_workers
    )


async def stream_as_sse(chunks):
    async for chunk in chunks:
        yield f"data: {json.dumps({'text': chunk})}\n\n"
    yield "data: [DONE]\n\n"


async def process_next_pipeline_job() -> bool:
    job = pipeline_job_store.claim_next()
    if job is None:
        return False

    job_id, request = job
    try:
        result = await run_pipeline(
            code=request["code"],
            language=request["language"],
            repo=request.get("repo", ""),
            base_branch=request.get("base_branch", ""),
            github_token=request.get("github_token", ""),
            banned_keywords=request.get("banned_keywords", []),
            max_function_lines=request.get("max_function_lines"),
        )
        pipeline_job_store.complete(job_id, result)
    except Exception as exc:
        logger.error("Pipeline job %s failed: %s", job_id, exc, exc_info=True)
        pipeline_job_store.fail(job_id, str(exc))
    return True


async def pipeline_worker(worker_id: int) -> None:
    logger.info("Started pipeline worker %s", worker_id)
    while True:
        processed = await process_next_pipeline_job()
        if not processed:
            await asyncio.sleep(settings.pipeline_worker_poll_seconds)


@app.on_event("startup")
async def start_pipeline_workers() -> None:
    worker_count = max(1, settings.pipeline_worker_count)
    pipeline_workers.extend(
        asyncio.create_task(pipeline_worker(worker_id))
        for worker_id in range(worker_count)
    )


@app.on_event("shutdown")
async def stop_pipeline_workers() -> None:
    for worker in pipeline_workers:
        worker.cancel()
    for worker in pipeline_workers:
        with suppress(asyncio.CancelledError):
            await worker
    pipeline_workers.clear()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


@app.get("/", tags=["Health"])
async def root():
    return {"message": "NexCode backend is running"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}


@app.post("/explain", tags=["AI Features"])
async def explain_code(request: BaseInput):
    logger.info("Explaining code")
    try:
        explanation = await get_cohere_response(
            request.get_input(),
            feature_type="explain"
        )
        return {"explanation": explanation}
    except Exception as e:
        logger.error(f"Error in explain: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate", tags=["AI Features"])
async def generate_code(request: BaseInput):
    logger.info("Generating code")
    try:
        code = await get_cohere_response(
            request.get_input(),
            feature_type="generate"
        )
        return {"code": code}
    except Exception as e:
        logger.error(f"Error in generate: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/fix", tags=["AI Features"])
async def fix_code(request: BaseInput):
    logger.info("Fixing code")
    try:
        fixed_code = await get_cohere_response(
            request.get_input(),
            feature_type="fix"
        )
        return {"fixed_code": fixed_code}
    except Exception as e:
        logger.error(f"Error in fix: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/review", tags=["AI Features"])
async def review_code(request: BaseInput):
    logger.info("Reviewing code")
    try:
        review = await get_cohere_response(
            request.get_input(),
            feature_type="review"
        )
        return {"review": review}
    except Exception as e:
        logger.error(f"Error in review: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/complete", tags=["AI Features"])
async def complete_code(request: BaseInput):
    logger.info("Completing code")
    try:
        code = await get_cohere_response(
            request.get_input(),
            feature_type="complete"
        )
        return {"code": code}
    except Exception as e:
        logger.error(f"Error in complete: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/test-complete", tags=["AI Features"])
async def test_complete_code(request: BaseInput):
    """Faster endpoint that generates stubs instead of full files."""
    logger.info("Test-completing code")
    try:
        code = await get_cohere_response(
            request.get_input(),
            feature_type="test-complete"
        )
        return {"code": code}
    except Exception as e:
        logger.error(f"Error in test-complete: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/stream/complete", tags=["AI Features"])
async def stream_complete_code(request: BaseInput):
    """Streaming version of /complete that returns code chunk by chunk."""
    logger.info("Streaming complete code")
    return StreamingResponse(
        stream_as_sse(get_cohere_stream_response(request.get_input(), feature_type="complete")),
        media_type="text/event-stream"
    )


@app.post("/ai", tags=["AI Features"])
async def ai_router(request: AIRequest):
    logger.info(f"AI router feature={request.feature}")
    try:
        feature = request.feature.lower()
        if feature not in {"explain", "generate", "fix", "review", "complete", "test-complete"}:
            raise HTTPException(status_code=400, detail="Invalid feature")

        response_text = await get_cohere_response(request.get_input(), feature_type=feature)

        if feature == "explain":
            return {"explanation": response_text}
        if feature == "review":
            return {"review": response_text}
        return {"code": response_text}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in ai router: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Independent API (pluggable providers, local fallback) ───────────────────


@app.post("/independent/explain", tags=["Independent API"])
async def independent_explain(request: BaseInput):
    logger.info("Independent explain")
    try:
        explanation = await independent_api.respond(request.get_input(), feature_type="explain")
        return {"explanation": explanation}
    except Exception as e:
        logger.error(f"Independent explain error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/independent/generate", tags=["Independent API"])
async def independent_generate(request: BaseInput):
    logger.info("Independent generate")
    try:
        code = await independent_api.respond(request.get_input(), feature_type="generate")
        return {"code": code}
    except Exception as e:
        logger.error(f"Independent generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/independent/fix", tags=["Independent API"])
async def independent_fix(request: BaseInput):
    logger.info("Independent fix")
    try:
        fixed = await independent_api.respond(request.get_input(), feature_type="fix")
        return {"fixed_code": fixed}
    except Exception as e:
        logger.error(f"Independent fix error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/independent/complete", tags=["Independent API"])
async def independent_complete(request: BaseInput):
    logger.info("Independent complete")
    try:
        code = await independent_api.respond(request.get_input(), feature_type="complete")
        return {"code": code}
    except Exception as e:
        logger.error(f"Independent complete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/independent/stream/complete", tags=["Independent API"])
async def independent_stream_complete(request: BaseInput):
    logger.info("Independent stream complete")
    return StreamingResponse(
        stream_as_sse(independent_api.stream_response(request.get_input(), feature_type="complete")),
        media_type="text/event-stream"
    )


# ── Pipeline Routes ──────────────────────────────────────────


@app.post("/pipeline/scan", tags=["Pipeline"])
async def pipeline_scan(
    request: PipelineRequest,
    x_github_token: Optional[str] = Header(None, alias="X-GitHub-Token"),
    x_github_repo: Optional[str] = Header(None, alias="X-GitHub-Repo"),
):
    """Run 3-stage AI scan on code. Returns job_id to check status."""
    
    req_data = request.model_dump()
    project_config = get_nexcode_config()
    github = project_config.get("github", {})
    
    github_token = x_github_token or request.github_token or github.get("token", "")
    repo = x_github_repo or request.repo or github.get("repo", "")
    
    req_data["github_token"] = github_token
    req_data["repo"] = repo
    if not req_data["base_branch"]:
        req_data["base_branch"] = request.base_branch or github.get("base_branch", "main")
        
    job_id = uuid.uuid4().hex[:12]
    pipeline_job_store.create(job_id, req_data)
    if not has_active_pipeline_worker():
        await process_next_pipeline_job()
    return {"job_id": job_id, "status": "processing"}


@app.get("/pipeline/status/{job_id}", tags=["Pipeline"])
async def pipeline_status(job_id: str):
    """Check pipeline job status by job_id."""

    result = pipeline_job_store.get(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return {"job_id": job_id, "result": result}


@app.post("/pipeline/pr", tags=["Pipeline"])
async def pipeline_pr(
    request: PipelineRequest,
    x_github_token: Optional[str] = Header(None, alias="X-GitHub-Token"),
    x_github_repo: Optional[str] = Header(None, alias="X-GitHub-Repo"),
):
    """Run scan + create PR in one call. Requires repo and github_token."""

    project_config = get_nexcode_config()
    github = project_config.get("github", {})
    repo = x_github_repo or request.repo or github.get("repo", "")
    github_token = x_github_token or request.github_token or github.get("token", "")
    if not repo or not github_token:
        raise HTTPException(status_code=400, detail="repo and github_token are required")

    logger.info("Running pipeline PR")
    try:
        standards = project_config.get("standards", {})
        deployment = project_config.get("deployment", {})
        # Since this creates a PR synchronously in one go, we can just run it.
        # Alternatively, it could be pushed to BackgroundTasks as well if it takes too long.
        result = await run_pipeline(
            code=request.code,
            language=request.language,
            repo=repo,
            base_branch=request.base_branch or github.get("base_branch", "main"),
            github_token=github_token,
            banned_keywords=request.banned_keywords or standards.get("banned_keywords", []),
            max_function_lines=request.max_function_lines or standards.get("max_function_lines", 50),
        )
        return {"result": result}
    except Exception as e:
        logger.error(f"Error in pipeline_pr: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/mcp/health")
async def pipeline_mcp_health(request: MCPHealthRequest):
    """Check if an MCP endpoint is reachable."""
    result = await check_mcp_health(mcp_url=request.mcp_url)
    if not result.get("reachable"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "MCP server is unreachable")
        )
    return result


@app.post("/pipeline/mcp/run")
async def pipeline_mcp_run(
    request: PipelineRequest,
    x_github_token: Optional[str] = Header(None, alias="X-GitHub-Token"),
    x_github_repo: Optional[str] = Header(None, alias="X-GitHub-Repo"),
):
    """Run code scan with MCP checks enforced."""
    project_config = get_nexcode_config()
    github = project_config.get("github", {})
    repo = x_github_repo or request.repo or github.get("repo", "")
    github_token = x_github_token or request.github_token or github.get("token", "")

    mcp_config = project_config.get("mcp")
    if not mcp_config or not mcp_config.get("base_url"):
        raise HTTPException(
            status_code=400,
            detail="MCP server is not configured in nexcode.config.json"
        )

    try:
        standards = project_config.get("standards", {})
        result = await run_pipeline(
            code=request.code,
            language=request.language,
            repo=repo,
            base_branch=request.base_branch or github.get("base_branch", "main"),
            github_token=github_token,
            banned_keywords=request.banned_keywords or standards.get("banned_keywords", []),
            max_function_lines=request.max_function_lines or standards.get("max_function_lines", 50),
        )
        return {"result": result}
    except RuntimeError as e:
        if "MCP" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error in pipeline_mcp_run: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/deploy", tags=["Pipeline"])
async def pipeline_deploy(
    request: DeployRequest,
    x_vercel_token: Optional[str] = Header(None, alias="X-Vercel-Token"),
    x_vercel_project_id: Optional[str] = Header(None, alias="X-Vercel-Project-Id"),
    x_vercel_team_id: Optional[str] = Header(None, alias="X-Vercel-Team-Id"),
):
    """Trigger Vercel deployment of the configured repository."""
    import httpx
    
    project_config = get_nexcode_config()
    deployment_config = project_config.get("deployment", {})
    
    provider = deployment_config.get("provider", "vercel")
    if provider != "vercel":
        raise HTTPException(status_code=400, detail="Deployment provider is not set to vercel")
        
    token = x_vercel_token or deployment_config.get("token")
    project_id = x_vercel_project_id or deployment_config.get("project_id")
    team_id = x_vercel_team_id or deployment_config.get("team_id")
    is_production = deployment_config.get("production", False)
    
    if not token or token == "YOUR_VERCEL_TOKEN":
        raise HTTPException(status_code=400, detail="Vercel token is not configured")
        raise HTTPException(status_code=400, detail="Vercel token is not configured")
    if not project_id or project_id == "YOUR_PROJECT_ID":
        raise HTTPException(status_code=400, detail="Vercel project_id is not configured")
        
    # Scoping URL by Team ID
    url = "https://api.vercel.com/v13/deployments"
    if team_id and team_id != "YOUR_TEAM_ID":
        url += f"?teamId={team_id}"
        
    github_config = project_config.get("github", {})
    repo_slug = request.repo or github_config.get("repo")
    ref_branch = request.branch or github_config.get("base_branch", "main")
    
    if not repo_slug or repo_slug == "YOUR_GITHUB_OWNER/YOUR_REPOSITORY":
        raise HTTPException(status_code=400, detail="Repository slug is not configured")
        
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    body = {
        "projectId": project_id,
        "gitSource": {
            "type": "github",
            "repo": repo_slug,
            "ref": ref_branch
        }
    }
    if is_production:
        body["target"] = "production"
        
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, json=body, headers=headers)
            
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", response.text)
                except Exception:
                    error_msg = response.text
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Vercel API error: {error_msg}"
                )
                
            data = response.json()
            return {
                "deployment_url": f"https://{data.get('url')}" if data.get("url") else None,
                "deployment_id": data.get("id"),
                "status": data.get("status")
            }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"HTTP request to Vercel failed: {str(e)}")
