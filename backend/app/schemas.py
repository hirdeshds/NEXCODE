from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, List


class BaseInput(BaseModel):
    code: Optional[str] = Field(None, max_length=50000, description="The source code or input text")
    prompt: Optional[str] = Field(None, max_length=50000, description="The prompt or natural language instruction")
    text: Optional[str] = Field(None, max_length=50000, description="Alternative input field for request bodies")

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    def validate_input(cls, values):
        code = values.get("code")
        prompt = values.get("prompt")
        text = values.get("text")
        if not any([code and str(code).strip(), prompt and str(prompt).strip(), text and str(text).strip()]):
            raise ValueError("One of code, prompt, or text must be provided")
        return values

    def get_input(self) -> str:
        return (self.code or self.prompt or self.text or "").strip()


class CodeRequest(BaseInput):
    pass


class PromptRequest(BaseInput):
    pass


class AIRequest(BaseInput):
    feature: str = Field(..., description="Feature to invoke: explain, generate, fix, review, complete, or test-complete")


class CompleteRequest(BaseModel):
    code: Optional[str] = Field(None, max_length=50000, description="Code context or prompt text")
    prompt: Optional[str] = Field(None, max_length=50000, description="Natural language prompt or request")
    text: Optional[str] = Field(None, max_length=50000, description="Alternative input field for completion requests")

    def get_input(self) -> str:
        value = self.prompt or self.code or self.text or ""
        if not value.strip():
            raise ValueError("One of code, prompt, or text must be provided")
        return value.strip()


class PipelineRequest(BaseModel):
    code: str = Field(..., max_length=100000, description="The source code to scan")
    language: str = Field(default="python", description="Programming language of the code")
    repo: str = Field(default="", description="GitHub repository in format owner/repo")
    base_branch: str = Field(default="", description="Target branch for PR")
    github_token: str = Field(default="", description="GitHub personal access token")
    banned_keywords: List[str] = Field(default_factory=list, description="List of keywords to ban")
    max_function_lines: Optional[int] = Field(default=None, ge=1, le=500, description="Maximum allowed lines per function")


class PipelineResponse(BaseModel):
    bugs: str
    syntax: str
    runtime: str
    summary: str
