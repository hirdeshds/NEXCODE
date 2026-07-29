from app.llm import get_cohere_response


STAGE2_PROMPT = """You are a syntax checker. Check this {language} code for:
1. Syntax errors
2. Deprecated API usage
3. Banned keywords: {banned_keywords}
4. Functions longer than {max_lines} lines

Rules:
- Any banned keyword found = FAIL
- Any syntax error = FAIL

Reply in this exact format:
STATUS: PASS or FAIL
ISSUES: <number>
DETAILS:
- Line <N>: [SYNTAX|BANNED|DEPRECATED|LENGTH] <what is wrong>

If no issues, reply:
STATUS: PASS
ISSUES: 0
DETAILS: Code is clean.

Code:
```
{code}
```"""


async def run_stage2(code: str, language: str, banned_keywords: list = None, max_function_lines: int = 50) -> dict:
    """Run syntax and keywords check. Returns dict with status, analysis, issues_found."""

    keywords_str = ", ".join(banned_keywords) if banned_keywords else "none"

    prompt = STAGE2_PROMPT.format(
        language=language,
        code=code,
        banned_keywords=keywords_str,
        max_lines=max_function_lines,
    )
    analysis = await get_cohere_response(prompt, feature_type="explain")

    # Check if LLM said FAIL
    status = "pass"
    if "STATUS: FAIL" in analysis.upper():
        status = "fail"

    # Count issues
    issues_found = 0
    for line in analysis.split("\n"):
        if line.strip().upper().startswith("ISSUES:"):
            try:
                issues_found = int(line.split(":")[1].strip())
            except ValueError:
                pass

    return {
        "stage": 2,
        "name": "Syntax & Keywords",
        "status": status,
        "analysis": analysis,
        "issues_found": issues_found,
    }
