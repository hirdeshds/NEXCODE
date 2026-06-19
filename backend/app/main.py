from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from app.llm import get_cohere_response
from app.pipeline.agent import review_code_pipeline
from app.schemas import CodeRequest, PromptRequest
from app.streaming import stream_ai_response

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


@app.post("/review")
async def review_code(request: CodeRequest):
    return review_code_pipeline(request.code)


@app.post("/stream/{feature_type}")
async def stream_response(feature_type: str, request: CodeRequest):
    return StreamingResponse(
        stream_ai_response(request.code, feature_type),
        media_type="text/event-stream",
    )
