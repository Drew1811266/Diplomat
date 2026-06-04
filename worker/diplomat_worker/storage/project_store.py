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
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def create_project(self, name: str, source_video_path: Path) -> ProjectRecord:
        project_id = f"project-{uuid.uuid4().hex}"
        project_dir = self.root_dir / "projects" / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        record = ProjectRecord(
            project_id=project_id,
            name=name,
            source_video_path=source_video_path,
            project_dir=project_dir,
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO projects (project_id, name, source_video_path, project_dir, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record.project_id,
                    record.name,
                    str(record.source_video_path),
                    str(record.project_dir),
                    datetime.now(UTC).isoformat(),
                ),
            )
            connection.commit()
        return record

    def get_project(self, project_id: str) -> ProjectRecord:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT project_id, name, source_video_path, project_dir FROM projects WHERE project_id = ?",
                (project_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Project not found: {project_id}")
        return ProjectRecord(
            project_id=row["project_id"],
            name=row["name"],
            source_video_path=Path(row["source_video_path"]),
            project_dir=Path(row["project_dir"]),
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
