from pydantic import BaseModel, Field
from typing import Optional, List


class CodeRequest(BaseModel):
    code: str = Field(..., max_length=50000, description="The source code to process")


class PromptRequest(BaseModel):
    prompt: str = Field(..., max_length=5000, description="The prompt or natural language instruction")


class PipelineRequest(BaseModel):
    code: str = Field(..., max_length=100000, description="The source code to scan")
    language: str = Field(default="python", description="Programming language of the code")
    repo: str = Field(default="", description="GitHub repository in format owner/repo")
    base_branch: str = Field(default="main", description="Target branch for PR")
    github_token: str = Field(default="", description="GitHub personal access token")
    banned_keywords: List[str] = Field(default_factory=list, description="List of keywords to ban")
    max_function_lines: int = Field(default=50, ge=1, le=500, description="Maximum allowed lines per function")


class PipelineResponse(BaseModel):
    bugs: str
    syntax: str
    runtime: str
    summary: str
