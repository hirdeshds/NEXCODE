from app.pipeline.stage1_bugs import find_bugs
from app.pipeline.stage2_syntax import check_syntax
from app.pipeline.stage3_run import predict_runtime


def review_code_pipeline(code: str) -> dict:
    """
    Run the code through three simple review stages.

    The result is easy for the frontend to display and easy for a reviewer to read.
    """
    bugs = find_bugs(code)
    syntax = check_syntax(code)
    runtime = predict_runtime(code)

    return {
        "bugs": bugs,
        "syntax": syntax,
        "runtime": runtime,
        "summary": "Code review pipeline completed.",
    }
