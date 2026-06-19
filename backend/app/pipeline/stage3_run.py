from app.llm import get_cohere_response


def predict_runtime(code: str) -> str:
    """Stage 3: ask AI to predict runtime behavior."""
    return get_cohere_response(code, feature_type="run")
