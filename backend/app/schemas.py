from pydantic import BaseModel
from typing import Optional


class CodeRequest(BaseModel):
    code: str


class PromptRequest(BaseModel):
    prompt: str


class PipelineRequest(BaseModel):
    code: str
    language: str = "python"
    repo: str = ""
    base_branch: str = "main"
    github_token: str = ""
    banned_keywords: list = []
    max_function_lines: int = 50


class PipelineResponse(BaseModel):
    bugs: str
    syntax: str
    runtime: str
    summary: str
