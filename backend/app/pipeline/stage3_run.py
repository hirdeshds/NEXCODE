import docker
from app.llm import get_cohere_response


STAGE3_PROMPT = """You are a senior code reviewer doing a FINAL check on this {language} code.

Check for:
1. Security issues (SQL injection, XSS, hardcoded secrets)
2. Performance problems (bad algorithms, memory leaks)
3. Edge cases (division by zero, empty inputs)
4. Error handling gaps

Reply in this exact format:
STATUS: PASS or FAIL
ISSUES: <number>
DETAILS:
- Line <N>: [CRITICAL|WARNING] <what is wrong>

If code is clean:
STATUS: PASS
ISSUES: 0
DETAILS: Code passed full review.

Code:
```
{code}
```"""


def run_code_in_docker(code: str, timeout: int = 10) -> dict:
    """Run Python code inside a Docker container and capture output."""

    try:
        client = docker.from_env()

        result = client.containers.run(
            image="python:3.12-slim",
            command=["python", "-c", code],
            remove=True,
            network_disabled=True,
            mem_limit="128m",
            timeout=timeout,
            stderr=True,
        )

        return {
            "stdout": result.decode("utf-8") if result else "",
            "stderr": "",
            "exit_code": 0,
        }

    except docker.errors.ContainerError as e:
        return {
            "stdout": "",
            "stderr": e.stderr.decode("utf-8") if e.stderr else str(e),
            "exit_code": e.exit_status,
        }

    except Exception as e:
        return {
            "stdout": "",
            "stderr": f"Docker error: {str(e)}",
            "exit_code": -1,
        }


def run_stage3(code: str, language: str) -> dict:
    """Run full AI scan + Docker sandbox. Returns dict with status, analysis, sandbox_result."""

    # Part 1: AI full scan
    prompt = STAGE3_PROMPT.format(language=language, code=code)
    analysis = get_cohere_response(prompt, feature_type="explain")

    ai_status = "pass"
    if "STATUS: FAIL" in analysis.upper():
        ai_status = "fail"

    # Part 2: Run in Docker (Python only for now)
    sandbox_result = {"stdout": "", "stderr": "", "exit_code": 0}

    if language.lower() == "python":
        sandbox_result = run_code_in_docker(code)

    # Overall: fail if AI scan failed OR code crashed
    overall_status = "pass"
    if ai_status == "fail" or sandbox_result["exit_code"] != 0:
        overall_status = "fail"

    return {
        "stage": 3,
        "name": "Full Scan + Run",
        "status": overall_status,
        "analysis": analysis,
        "sandbox_result": sandbox_result,
    }
