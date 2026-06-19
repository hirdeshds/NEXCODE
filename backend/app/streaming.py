import json
from typing import AsyncGenerator

from app.llm import get_cohere_response


def format_sse(data: dict) -> str:
    """Convert a dictionary into one server-sent event message."""
    return f"data: {json.dumps(data)}\n\n"


async def stream_ai_response(prompt: str, feature_type: str) -> AsyncGenerator[str, None]:
    """
    Stream an AI response to the client.

    Cohere is called once, then the generated text is sent line by line as SSE.
    This keeps the frontend streaming-friendly even if the provider call is simple.
    """
    try:
        text = get_cohere_response(prompt, feature_type)
        for line in text.splitlines() or [text]:
            yield format_sse({"chunk": line})
        yield format_sse({"done": True})
    except Exception as exc:
        yield format_sse({"error": str(exc), "done": True})
