import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from diplomat_worker.schemas.subtitle import SubtitleDocument

SCHEMA_VERSION = 2


class StorageMigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProjectRecord:
    project_id: str
    name: str
    source_video_path: Path
    project_dir: Path
    duration_ms: int
    source_language: str
    target_language: str | None
    created_at: str
    updated_at: str


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
            self._ensure_metadata_table(connection)
            if self._table_exists(connection, "projects"):
                self._migrate_projects_table(connection)
            else:
                self._create_projects_table(connection)
            self._set_schema_version(connection)
            connection.commit()

    def _ensure_metadata_table(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS app_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )

    def _set_schema_version(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            INSERT INTO app_metadata (key, value)
            VALUES ('schema_version', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (str(SCHEMA_VERSION),),
        )

    def _table_exists(self, connection: sqlite3.Connection, table_name: str) -> bool:
        row = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table_name,),
        ).fetchone()
        return row is not None

    def _project_columns(self, connection: sqlite3.Connection) -> set[str]:
        return {row["name"] for row in connection.execute("PRAGMA table_info(projects)").fetchall()}

    def _create_projects_table(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            CREATE TABLE projects (
                project_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_video_path TEXT NOT NULL,
                project_dir TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                source_language TEXT NOT NULL,
                target_language TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

    def _migrate_projects_table(self, connection: sqlite3.Connection) -> None:
        columns = self._project_columns(connection)
        if "project_id" not in columns:
            raise StorageMigrationError("projects table is missing required project_id column")
        if "name" not in columns:
            raise StorageMigrationError("projects table is missing required name column")

        self._add_column_if_missing(
            connection,
            columns,
            "source_video_path",
            "ALTER TABLE projects ADD COLUMN source_video_path TEXT NOT NULL DEFAULT ''",
        )
        self._add_column_if_missing(
            connection,
            columns,
            "project_dir",
            "ALTER TABLE projects ADD COLUMN project_dir TEXT",
        )
        self._add_column_if_missing(
            connection,
            columns,
            "duration_ms",
            "ALTER TABLE projects ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0",
        )
        self._add_column_if_missing(
            connection,
            columns,
            "source_language",
            "ALTER TABLE projects ADD COLUMN source_language TEXT NOT NULL DEFAULT 'und'",
        )
        self._add_column_if_missing(
            connection,
            columns,
            "target_language",
            "ALTER TABLE projects ADD COLUMN target_language TEXT",
        )
        self._add_column_if_missing(
            connection,
            columns,
            "created_at",
            "ALTER TABLE projects ADD COLUMN created_at TEXT",
        )
        self._add_column_if_missing(
            connection,
            columns,
            "updated_at",
            "ALTER TABLE projects ADD COLUMN updated_at TEXT",
        )
        self._backfill_project_rows(connection)

    def _add_column_if_missing(
        self,
        connection: sqlite3.Connection,
        columns: set[str],
        column_name: str,
        statement: str,
    ) -> None:
        if column_name not in columns:
            connection.execute(statement)
            columns.add(column_name)

    def _backfill_project_rows(self, connection: sqlite3.Connection) -> None:
        now = self._utc_now()
        connection.execute(
            "UPDATE projects SET created_at = ? WHERE created_at IS NULL OR TRIM(created_at) = ''",
            (now,),
        )
        connection.execute(
            """
            UPDATE projects
            SET updated_at = created_at
            WHERE updated_at IS NULL OR TRIM(updated_at) = ''
            """
        )
        rows = connection.execute(
            """
            SELECT project_id
            FROM projects
            WHERE project_dir IS NULL OR TRIM(project_dir) = ''
            """
        ).fetchall()
        for row in rows:
            connection.execute(
                "UPDATE projects SET project_dir = ? WHERE project_id = ?",
                (str(self.root_dir / "projects" / row["project_id"]), row["project_id"]),
            )

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
        now = self._utc_now()

        record = ProjectRecord(
            project_id=project_id,
            name=name,
            source_video_path=source_video_path,
            project_dir=project_dir,
            duration_ms=duration_ms,
            source_language=source_language,
            target_language=target_language,
            created_at=now,
            updated_at=now,
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
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.project_id,
                    record.name,
                    str(record.source_video_path),
                    str(record.project_dir),
                    record.duration_ms,
                    record.source_language,
                    record.target_language,
                    record.created_at,
                    record.updated_at,
                ),
            )
            connection.commit()
        return record

    def list_projects(self) -> list[ProjectRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    project_id,
                    name,
                    source_video_path,
                    project_dir,
                    duration_ms,
                    source_language,
                    target_language,
                    created_at,
                    updated_at
                FROM projects
                ORDER BY updated_at DESC, created_at DESC, rowid DESC
                """
            ).fetchall()
        return [self._record_from_row(row) for row in rows]

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
                    target_language,
                    created_at,
                    updated_at
                FROM projects
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Project not found: {project_id}")
        return self._record_from_row(row)

    def _record_from_row(self, row: sqlite3.Row) -> ProjectRecord:
        return ProjectRecord(
            project_id=row["project_id"],
            name=row["name"],
            source_video_path=Path(row["source_video_path"]),
            project_dir=Path(row["project_dir"]),
            duration_ms=row["duration_ms"],
            source_language=row["source_language"],
            target_language=row["target_language"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def save_subtitle_document(self, project_id: str, document: SubtitleDocument) -> Path:
        if document.project_id != project_id:
            raise ValueError("document.project_id must match project_id")
        project = self.get_project(project_id)
        path = project.project_dir / "subtitle.diplomat.json"
        payload = document.model_dump(by_alias=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self.touch_project(project_id)
        return path

    def load_subtitle_document(self, project_id: str) -> SubtitleDocument:
        project = self.get_project(project_id)
        path = project.project_dir / "subtitle.diplomat.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        return SubtitleDocument.model_validate(payload)

    def has_subtitle_document(self, project_id: str) -> bool:
        project = self.get_project(project_id)
        return (project.project_dir / "subtitle.diplomat.json").is_file()

    def touch_project(self, project_id: str) -> None:
        with self._connect() as connection:
            cursor = connection.execute(
                "UPDATE projects SET updated_at = ? WHERE project_id = ?",
                (self._utc_now(), project_id),
            )
            connection.commit()
        if cursor.rowcount == 0:
            raise KeyError(f"Project not found: {project_id}")

    def _utc_now(self) -> str:
        return datetime.now(UTC).isoformat()
