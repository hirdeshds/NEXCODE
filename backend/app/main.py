from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from app.llm import get_cohere_response, get_cohere_stream_response
from app.schemas import CodeRequest, PromptRequest

app = FastAPI()


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
