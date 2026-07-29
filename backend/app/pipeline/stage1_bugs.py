from app.llm import get_cohere_response


STAGE1_PROMPT = """You are a bug detector. Check this {language} code for obvious bugs:
- Null/undefined references
- Undefined variables
- Type mismatches
- Unreachable code
- Missing error handling

Reply in this exact format:
STATUS: PASS or FAIL
BUGS: <number>
DETAILS:
- Line <N>: <what is wrong>

If no bugs found, reply:
STATUS: PASS
BUGS: 0
DETAILS: No bugs detected.

Code:
```
{code}
```"""


async def run_stage1(code: str, language: str) -> dict:
    """Run basic bug check. Returns dict with status, analysis, bugs_found."""

    prompt = STAGE1_PROMPT.format(language=language, code=code)
    analysis = await get_cohere_response(prompt, feature_type="explain")

    # Check if LLM said FAIL
    status = "pass"
    if "STATUS: FAIL" in analysis.upper():
        status = "fail"

    # Count bugs
    bugs_found = 0
    for line in analysis.split("\n"):
        if line.strip().upper().startswith("BUGS:"):
            try:
                bugs_found = int(line.split(":")[1].strip())
            except ValueError:
                pass

    return {
        "stage": 1,
        "name": "Basic Bug Check",
        "status": status,
        "analysis": analysis,
        "bugs_found": bugs_found,
    }
