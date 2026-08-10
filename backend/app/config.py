import json
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    llm_provider: str = ""
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    cohere_api_key: str = ""
    cohere_model: str = "command-r-08-2024"
    independent_api_provider: str = ""
    cors_origins: str = "*"
    pipeline_db_path: str = "data/pipeline_jobs.sqlite3"
    pipeline_worker_count: int = 2
    pipeline_worker_poll_seconds: float = 0.5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache()
def get_settings() -> Settings:
    return Settings()


@lru_cache()
def get_nexcode_config() -> dict:
    """Load optional repository configuration from nexcode.config.json."""
    config_path = Path(__file__).resolve().parents[2] / "nexcode.config.json"
    if not config_path.exists() or not config_path.read_text(encoding="utf-8").strip():
        return {}

    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid nexcode.config.json: {exc}") from exc

    if not isinstance(config, dict):
        raise RuntimeError("nexcode.config.json must contain a JSON object")

    for section in ("standards", "github", "deployment", "llm"):
        if section in config and not isinstance(config[section], dict):
            raise RuntimeError(f"nexcode.config.json section '{section}' must be an object")
    return config
