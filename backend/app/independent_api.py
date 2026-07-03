import asyncio
from typing import AsyncGenerator
from app.config import get_settings


class LocalProvider:
    """A minimal local provider for prototyping independent API behavior.
    This is intentionally simple and deterministic so it works without external keys.
    """

    async def chat(self, prompt: str, feature_type: str) -> str:
        # lightweight heuristics for prototype responses
        if feature_type == "explain":
            snippet = prompt.strip().replace('\n', ' ')[:400]
            return f"Explanation (local): This code appears to do the following: {snippet}"
        if feature_type == "generate":
            return f"# Generated (local)\n# Prompt: {prompt[:120]}\n\nprint('Hello from local generator')\n"
        if feature_type == "fix":
            return f"# Fixed (local)\n{prompt}"
        if feature_type == "complete" or feature_type == "test-complete":
            return f"# Completion (local)\n{prompt}\n# ...completed"
        return f"(local) Unsupported feature_type: {feature_type}"

    async def stream(self, prompt: str, feature_type: str) -> AsyncGenerator[str, None]:
        # simple streaming: yield the response in chunks with slight delays
        full = await self.chat(prompt, feature_type)
        chunk_size = 80
        for i in range(0, len(full), chunk_size):
            await asyncio.sleep(0.02)
            yield full[i:i+chunk_size]


class IndependentAPI:
    def __init__(self):
        settings = get_settings()
        provider = settings.independent_api_provider or "local"
        if provider == "local":
            self._provider = LocalProvider()
        else:
            # For now default to local; provider hooks can be added here
            self._provider = LocalProvider()

    async def respond(self, prompt: str, feature_type: str) -> str:
        return await self._provider.chat(prompt, feature_type)

    def stream_response(self, prompt: str, feature_type: str) -> AsyncGenerator[str, None]:
        return self._provider.stream(prompt, feature_type)


# module-level instance for easy imports
independent_api = IndependentAPI()
