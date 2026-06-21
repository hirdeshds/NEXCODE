from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.llm import get_cohere_response
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
