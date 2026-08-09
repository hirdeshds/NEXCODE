import uuid
from github import Github


def create_pull_request(repo: str, base_branch: str, github_token: str,
                        code: str, language: str, scan_summary: str) -> dict:
    """
    Create a new branch, commit the code, and raise a PR.

    Args:
        repo: GitHub repo in "owner/repo" format
        base_branch: Branch to merge into (e.g. "main")
        github_token: GitHub personal access token
        code: The scanned code to commit
        language: Programming language of the code
        scan_summary: AI scan results to include in PR body

    Returns:
        dict with pr_url, branch_name, status
    """

    try:
        g = Github(github_token)
        repository = g.get_repo(repo)

        # Create a unique branch name
        branch_name = f"nexcode/scan-{uuid.uuid4().hex[:8]}"

        # Get the base branch reference
        base_ref = repository.get_branch(base_branch)
        base_sha = base_ref.commit.sha

        # Create new branch
        repository.create_git_ref(
            ref=f"refs/heads/{branch_name}",
            sha=base_sha,
        )

        # Decide file extension
        extensions = {
            "python": "py", "javascript": "js", "typescript": "ts",
            "java": "java", "go": "go", "rust": "rs", "c": "c",
            "cpp": "cpp", "ruby": "rb", "php": "php",
        }
        ext = extensions.get(language.lower(), "txt")
        file_path = f"nexcode-scanned/code.{ext}"

        # Commit the code to the new branch
        repository.create_file(
            path=file_path,
            message=f"[NexCode Bot] Add scanned code ({language})",
            content=code,
            branch=branch_name,
        )

        # Create Pull Request
        pr_body = f"""##  NexCode AI — Automated Pull Request

This PR was created automatically by **NexCode Bot** after the code passed all 3 AI scanning stages.

---

{scan_summary}

---

>  All stages passed. This code is ready for human review.
"""

        pr = repository.create_pull(
            title=f"[NexCode] AI-Scanned Code ({language})",
            body=pr_body,
            head=branch_name,
            base=base_branch,
        )

        return {
            "status": "success",
            "pr_url": pr.html_url,
            "pr_number": pr.number,
            "branch_name": branch_name,
        }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "pr_url": None,
            "branch_name": None,
        }
