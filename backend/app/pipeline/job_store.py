"""Durable SQLite storage for pipeline jobs and a small worker queue."""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class PipelineJobStore:
    def __init__(self, database_path: str):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS pipeline_jobs (
                    job_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    request_json TEXT NOT NULL,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "UPDATE pipeline_jobs SET status = 'queued', updated_at = ? WHERE status = 'running'",
                (self._now(),),
            )

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def create(self, job_id: str, request: dict[str, Any]) -> None:
        timestamp = self._now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO pipeline_jobs
                    (job_id, status, request_json, created_at, updated_at)
                VALUES (?, 'queued', ?, ?, ?)
                """,
                (job_id, json.dumps(request), timestamp, timestamp),
            )

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT status, result_json, error FROM pipeline_jobs WHERE job_id = ?",
                (job_id,),
            ).fetchone()

        if row is None:
            return None
        if row["status"] in {"queued", "running"}:
            return {"overall_status": "processing"}
        if row["result_json"]:
            return json.loads(row["result_json"])
        return {"overall_status": "failed_internal", "error": row["error"] or "Pipeline failed"}

    def claim_next(self) -> tuple[str, dict[str, Any]] | None:
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT job_id, request_json FROM pipeline_jobs WHERE status = 'queued' "
                "ORDER BY created_at LIMIT 1"
            ).fetchone()
            if row is None:
                connection.commit()
                return None

            connection.execute(
                "UPDATE pipeline_jobs SET status = 'running', updated_at = ? WHERE job_id = ?",
                (self._now(), row["job_id"]),
            )
            connection.commit()
            return row["job_id"], json.loads(row["request_json"])

    def complete(self, job_id: str, result: dict[str, Any]) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE pipeline_jobs SET status = 'completed', result_json = ?, updated_at = ? WHERE job_id = ?",
                (json.dumps(result), self._now(), job_id),
            )

    def fail(self, job_id: str, error: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE pipeline_jobs SET status = 'failed', error = ?, updated_at = ? WHERE job_id = ?",
                (error, self._now(), job_id),
            )
