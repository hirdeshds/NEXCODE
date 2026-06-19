from app.llm import get_cohere_response


def find_bugs(code: str) -> str:
    """Stage 1: ask AI to find possible bugs and risky logic."""
    return get_cohere_response(code, feature_type="bugs")
