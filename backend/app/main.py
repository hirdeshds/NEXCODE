import uuid
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from app.llm import get_cohere_response, get_cohere_stream_response
from app.schemas import CodeRequest, PromptRequest, PipelineRequest
from app.pipeline.agent import run_pipeline

app = FastAPI()

# Simple in-memory store for pipeline job results
pipeline_jobs = {}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "NexCode backend is running"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/explain")
async def explain_code(request: CodeRequest):
    explanation = get_cohere_response(
        request.code,
        feature_type="explain"
    )
    return {"explanation": explanation}


@app.post("/generate")
async def generate_code(request: PromptRequest):
    code = get_cohere_response(
        request.prompt,
        feature_type="generate"
    )
    return {"code": code}


@app.post("/fix")
async def fix_code(request: CodeRequest):
    fixed_code = get_cohere_response(
        request.code,
        feature_type="fix"
    )
    return {"fixed_code": fixed_code}


@app.post("/complete")
async def complete_code(request: CodeRequest):
    code = get_cohere_response(
        request.code,
        feature_type="complete"
    )
    return {"code": code}


@app.post("/test-complete")
async def test_complete_code(request: CodeRequest):
    """Faster endpoint that generates stubs instead of full files."""
    code = get_cohere_response(
        request.code,
        feature_type="test-complete"
    )
    return {"code": code}


@app.post("/stream/complete")
async def stream_complete_code(request: CodeRequest):
    """Streaming version of /complete that returns code chunk by chunk."""
    return StreamingResponse(
        get_cohere_stream_response(request.code, feature_type="complete"),
        media_type="text/event-stream"
    )


# ── Pipeline Routes ──────────────────────────────────────────


@app.post("/pipeline/scan")
async def pipeline_scan(request: PipelineRequest):
    """Run 3-stage AI scan on code. Returns job_id to check status."""

    job_id = uuid.uuid4().hex[:12]

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
    return {"job_id": job_id, "result": result}


@app.get("/pipeline/status/{job_id}")
async def pipeline_status(job_id: str):
    """Check pipeline job status by job_id."""

    if job_id not in pipeline_jobs:
        return {"error": "Job not found", "job_id": job_id}

    return {"job_id": job_id, "result": pipeline_jobs[job_id]}


@app.post("/pipeline/pr")
async def pipeline_pr(request: PipelineRequest):
    """Run scan + create PR in one call. Requires repo and github_token."""

    if not request.repo or not request.github_token:
        return {"error": "repo and github_token are required"}

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

