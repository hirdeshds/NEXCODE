from collections import deque
from typing import Deque, Dict, Optional
from uuid import uuid4

Job = Dict[str, str]

_jobs: Deque[Job] = deque()


def add_job(code: str) -> Job:
    """Add a code review job to an in-memory queue."""
    job = {"id": str(uuid4()), "code": code, "status": "pending"}
    _jobs.append(job)
    return job


def get_next_job() -> Optional[Job]:
    """Return the next queued job, if one exists."""
    if not _jobs:
        return None
    job = _jobs.popleft()
    job["status"] = "processing"
    return job


def queue_size() -> int:
    """Return how many jobs are waiting."""
    return len(_jobs)
