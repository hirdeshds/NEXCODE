import subprocess
import sys
import tempfile
from pathlib import Path


def run_python_code(code: str, timeout_seconds: int = 5) -> dict:
    """
    Run Python code in a temporary file and return stdout, stderr, and exit code.

    This is a basic local runner. For production, use Docker or another real sandbox.
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = Path(temp_dir) / "main.py"
        file_path.write_text(code, encoding="utf-8")

        result = subprocess.run(
            [sys.executable, str(file_path)],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )

    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.returncode,
    }
