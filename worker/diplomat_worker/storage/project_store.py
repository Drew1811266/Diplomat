import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from diplomat_worker.schemas.subtitle import SubtitleDocument


@dataclass(frozen=True)
class ProjectRecord:
    project_id: str
    name: str
    source_video_path: Path
    project_dir: Path
    duration_ms: int
    source_language: str
    target_language: str | None


class ProjectStore:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self.root_dir = database_path.parent
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    project_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    source_video_path TEXT NOT NULL,
                    project_dir TEXT NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    source_language TEXT NOT NULL,
                    target_language TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def create_project(
        self,
        name: str,
        source_video_path: Path,
        duration_ms: int,
        source_language: str,
        target_language: str | None,
    ) -> ProjectRecord:
        if duration_ms < 0:
            raise ValueError("duration_ms must be greater than or equal to 0")
        if len(source_language) < 2:
            raise ValueError("source_language must be at least 2 characters")
        if target_language is not None and len(target_language) < 2:
            raise ValueError("target_language must be at least 2 characters")

        project_id = f"project-{uuid.uuid4().hex}"
        project_dir = self.root_dir / "projects" / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        record = ProjectRecord(
            project_id=project_id,
            name=name,
            source_video_path=source_video_path,
            project_dir=project_dir,
            duration_ms=duration_ms,
            source_language=source_language,
            target_language=target_language,
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO projects (
                    project_id,
                    name,
                    source_video_path,
                    project_dir,
                    duration_ms,
                    source_language,
                    target_language,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.project_id,
                    record.name,
                    str(record.source_video_path),
                    str(record.project_dir),
                    record.duration_ms,
                    record.source_language,
                    record.target_language,
                    datetime.now(UTC).isoformat(),
                ),
            )
            connection.commit()
        return record

    def get_project(self, project_id: str) -> ProjectRecord:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    project_id,
                    name,
                    source_video_path,
                    project_dir,
                    duration_ms,
                    source_language,
                    target_language
                FROM projects
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Project not found: {project_id}")
        return ProjectRecord(
            project_id=row["project_id"],
            name=row["name"],
            source_video_path=Path(row["source_video_path"]),
            project_dir=Path(row["project_dir"]),
            duration_ms=row["duration_ms"],
            source_language=row["source_language"],
            target_language=row["target_language"],
        )

    def save_subtitle_document(self, project_id: str, document: SubtitleDocument) -> Path:
        if document.project_id != project_id:
            raise ValueError("document.project_id must match project_id")
        project = self.get_project(project_id)
        path = project.project_dir / "subtitle.diplomat.json"
        payload = document.model_dump(by_alias=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def load_subtitle_document(self, project_id: str) -> SubtitleDocument:
        project = self.get_project(project_id)
        path = project.project_dir / "subtitle.diplomat.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        return SubtitleDocument.model_validate(payload)
