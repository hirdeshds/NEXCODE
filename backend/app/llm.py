import cohere
from app.prompts import get_system_prompt
from app.config import get_settings


def get_cohere_client() -> cohere.AsyncClientV2:
    """Create the Cohere Async client."""
    settings = get_settings()
    if not settings.cohere_api_key:
        raise RuntimeError("COHERE_API_KEY is missing. Add it to backend/.env")
    return cohere.AsyncClientV2(api_key=settings.cohere_api_key)


async def get_cohere_response(prompt: str, feature_type: str) -> str:
    """
    Unified function for all NexCode features using Cohere.
    """
    settings = get_settings()
    co = get_cohere_client()
    res = await co.chat(
        model=settings.cohere_model,
        messages=[
            {"role": "system", "content": get_system_prompt(feature_type)},
            {"role": "user", "content": prompt}
        ]
    )
    return res.message.content[0].text

async def get_cohere_stream_response(prompt: str, feature_type: str):
    """
    Unified function for streaming responses from Cohere.
    """
    settings = get_settings()
    co = get_cohere_client()
    res = co.chat_stream(
        model=settings.cohere_model,
        messages=[
            {"role": "system", "content": get_system_prompt(feature_type)},
            {"role": "user", "content": prompt}
        ]
    )
    async for event in res:
        if event and event.type == "content-delta":
            yield event.delta.message.content.text

