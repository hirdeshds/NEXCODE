from pydantic import BaseModel


class CodeRequest(BaseModel):
    code: str


class PromptRequest(BaseModel):
    prompt: str


class PipelineResponse(BaseModel):
    bugs: str
    syntax: str
    runtime: str
    summary: str
