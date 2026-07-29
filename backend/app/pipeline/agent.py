"""Pipeline Agent — Runs all 3 stages sequentially, then raises a PR."""

from app.pipeline.stage1_bugs import run_stage1
from app.pipeline.stage2_syntax import run_stage2
from app.pipeline.stage3_run import run_stage3
from app.pipeline.github_pr import create_pull_request


async def run_pipeline(code: str, language: str, repo: str, base_branch: str,
                       github_token: str, banned_keywords: list = None,
                       max_function_lines: int = 50) -> dict:
    """
    Run the full 3-stage pipeline on code.

    Flow: Stage 1 → Stage 2 → Stage 3 → Create PR
    Stops early if any stage fails.

    Returns dict with results from each stage + PR URL.
    """

    result = {
        "stage1": None,
        "stage2": None,
        "stage3": None,
        "pr": None,
        "overall_status": "pending",
    }

    # Stage 1: Basic Bug Check
    stage1 = await run_stage1(code, language)
    result["stage1"] = stage1

    if stage1["status"] == "fail":
        result["overall_status"] = "failed_stage1"
        return result

    # Stage 2: Syntax & Keywords
    stage2 = await run_stage2(code, language, banned_keywords, max_function_lines)
    result["stage2"] = stage2

    if stage2["status"] == "fail":
        result["overall_status"] = "failed_stage2"
        return result

    # Stage 3: Full Scan + Docker Run
    stage3 = await run_stage3(code, language)
    result["stage3"] = stage3

    if stage3["status"] == "fail":
        result["overall_status"] = "failed_stage3"
        return result

    # All passed — Create PR
    scan_summary = (
        f"### Stage 1 — Bug Check\n{stage1['analysis']}\n\n"
        f"### Stage 2 — Syntax & Keywords\n{stage2['analysis']}\n\n"
        f"### Stage 3 — Full Scan + Run\n{stage3['analysis']}"
    )

    pr_result = create_pull_request(
        repo=repo,
        base_branch=base_branch,
        github_token=github_token,
        code=code,
        language=language,
        scan_summary=scan_summary,
    )

    result["pr"] = pr_result
    result["overall_status"] = "passed"
    return result
