from collections.abc import AsyncGenerator
import json

import cohere
import httpx

from app.prompts import get_system_prompt
from app.config import get_settings


def get_cohere_client() -> cohere.AsyncClientV2:
    """Create the Cohere Async client."""
    settings = get_settings()
    if not settings.cohere_api_key:
        raise RuntimeError("COHERE_API_KEY is missing. Add it to backend/.env")
    return cohere.AsyncClientV2(api_key=settings.cohere_api_key)


async def _get_cohere_response(prompt: str, feature_type: str) -> str:
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

async def _get_cohere_stream_response(prompt: str, feature_type: str):
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


def _provider_name() -> str:
    settings = get_settings()
    if settings.llm_provider:
        return settings.llm_provider.lower()
    if settings.independent_api_provider:
        return settings.independent_api_provider.lower()
    return "cohere" if settings.cohere_api_key else "local"


async def get_cohere_response(prompt: str, feature_type: str) -> str:
    """Backward-compatible entry point that now uses the configured LLM."""
    return await get_llm_response(prompt, feature_type)


async def get_cohere_stream_response(prompt: str, feature_type: str):
    """Backward-compatible streaming entry point."""
    async for chunk in get_llm_stream_response(prompt, feature_type):
        yield chunk


def _openai_messages(prompt: str, feature_type: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": get_system_prompt(feature_type)},
        {"role": "user", "content": prompt},
    ]


def _openai_config() -> tuple[str, dict[str, str]]:
    settings = get_settings()
    if not settings.llm_api_key:
        raise RuntimeError("LLM_API_KEY is missing. Add it to backend/.env")

    base_url = settings.llm_base_url.rstrip("/")
    if not base_url.endswith("/chat/completions"):
        base_url += "/chat/completions"
    return base_url, {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }


def _openai_text(payload: dict) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("LLM API returned an invalid chat completion") from exc

    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part.get("text", "") for part in content if isinstance(part, dict)
        )
    raise RuntimeError("LLM API returned unsupported message content")


async def get_llm_response(prompt: str, feature_type: str) -> str:
    """Call the configured provider through one stable application interface."""
    provider = _provider_name()
    if provider == "cohere":
        return await _get_cohere_response(prompt, feature_type)
    if provider == "local":
        from app.independent_api import LocalProvider
        return await LocalProvider().chat(prompt, feature_type)
    if provider not in {"openai", "openai-compatible", "openai_compatible"}:
        raise RuntimeError(
            f"Unsupported LLM_PROVIDER '{provider}'. Use local, cohere, or openai-compatible."
        )

    settings = get_settings()
    url, headers = _openai_config()
    payload = {
        "model": settings.llm_model,
        "messages": _openai_messages(prompt, feature_type),
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
    return _openai_text(response.json())


async def get_llm_stream_response(prompt: str, feature_type: str) -> AsyncGenerator[str, None]:
    """Stream text from the configured provider."""
    provider = _provider_name()
    if provider == "cohere":
        async for chunk in _get_cohere_stream_response(prompt, feature_type):
            yield chunk
        return
    if provider == "local":
        from app.independent_api import LocalProvider
        async for chunk in LocalProvider().stream(prompt, feature_type):
            yield chunk
        return
    if provider not in {"openai", "openai-compatible", "openai_compatible"}:
        raise RuntimeError(
            f"Unsupported LLM_PROVIDER '{provider}'. Use local, cohere, or openai-compatible."
        )

    settings = get_settings()
    url, headers = _openai_config()
    payload = {
        "model": settings.llm_model,
        "messages": _openai_messages(prompt, feature_type),
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    content = data and json.loads(data)["choices"][0]["delta"].get("content")
                except (ValueError, KeyError, IndexError, TypeError):
                    continue
                if content:
                    yield content

