from fastapi import FastAPI
from app.llm import get_cohere_response
from app.schemas import CodeRequest

app = FastAPI()

@app.post("/explain")
async def explain_code(request: CodeRequest):
    explanation = get_cohere_response(
        request.code,
        feature_type="explain"
    )
    return {"explanation": explanation}
