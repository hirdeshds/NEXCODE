from app.llm import get_cohere_response


def check_syntax(code: str) -> str:
    """Stage 2: ask AI to check syntax and formatting issues."""
    return get_cohere_response(code, feature_type="syntax")
