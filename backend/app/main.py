import uuid
import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.llm import get_cohere_response, get_cohere_stream_response
from app.schemas import AIRequest, BaseInput, CodeRequest, PromptRequest, PipelineRequest
from app.pipeline.agent import run_pipeline
from app.config import get_settings
from app.independent_api import independent_api

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NexCode Backend",
    description="Backend API for NexCode, providing AI-powered code analysis and generation.",
    version="1.0.0"
)

# Simple in-memory store for pipeline job results
pipeline_jobs = {}

settings = get_settings()

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
        get_cohere_stream_response(request.get_input(), feature_type="complete"),
        media_type="text/event-stream"
    )


@app.post("/ai", tags=["AI Features"])
async def ai_router(request: AIRequest):
    logger.info(f"AI router feature={request.feature}")
    try:
        feature = request.feature.lower()
        if feature not in {"explain", "generate", "fix", "complete", "test-complete"}:
            raise HTTPException(status_code=400, detail="Invalid feature")

        response_text = await get_cohere_response(request.get_input(), feature_type=feature)

        if feature == "explain":
            return {"explanation": response_text}
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
        independent_api.stream_response(request.get_input(), feature_type="complete"),
        media_type="text/event-stream"
    )


# ── Pipeline Routes ──────────────────────────────────────────


def run_pipeline_background(job_id: str, request: PipelineRequest):
    logger.info(f"Starting pipeline job {job_id}")
    try:
        # Note: run_pipeline is currently synchronous. We could run it in a threadpool
        # if it's heavily blocking, but BackgroundTasks will run it in a separate thread anyway.
        result = run_pipeline(
            code=request.code,
            language=request.language,
            repo=request.repo,
            base_branch=request.base_branch,
            github_token=request.github_token,
            banned_keywords=request.banned_keywords,
            max_function_lines=request.max_function_lines,
        )
        pipeline_jobs[job_id] = result
        logger.info(f"Finished pipeline job {job_id}")
    except Exception as e:
        logger.error(f"Pipeline job {job_id} failed: {e}")
        pipeline_jobs[job_id] = {"error": str(e), "overall_status": "failed_internal"}


@app.post("/pipeline/scan", tags=["Pipeline"])
async def pipeline_scan(request: PipelineRequest, background_tasks: BackgroundTasks):
    """Run 3-stage AI scan on code. Returns job_id to check status."""
    
    job_id = uuid.uuid4().hex[:12]
    pipeline_jobs[job_id] = {"overall_status": "processing"}
    
    background_tasks.add_task(run_pipeline_background, job_id, request)
    return {"job_id": job_id, "status": "processing"}


@app.get("/pipeline/status/{job_id}", tags=["Pipeline"])
async def pipeline_status(job_id: str):
    """Check pipeline job status by job_id."""

    if job_id not in pipeline_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return {"job_id": job_id, "result": pipeline_jobs[job_id]}


@app.post("/pipeline/pr", tags=["Pipeline"])
async def pipeline_pr(request: PipelineRequest):
    """Run scan + create PR in one call. Requires repo and github_token."""

    if not request.repo or not request.github_token:
        raise HTTPException(status_code=400, detail="repo and github_token are required")

    logger.info("Running pipeline PR")
    try:
        # Since this creates a PR synchronously in one go, we can just run it.
        # Alternatively, it could be pushed to BackgroundTasks as well if it takes too long.
        result = run_pipeline(
            code=request.code,
            language=request.language,
            repo=request.repo,
            base_branch=request.base_branch,
            github_token=request.github_token,
            banned_keywords=request.banned_keywords,
            max_function_lines=request.max_function_lines,
        )
        return {"result": result}
    except Exception as e:
        logger.error(f"Error in pipeline_pr: {e}")
        raise HTTPException(status_code=500, detail=str(e))

