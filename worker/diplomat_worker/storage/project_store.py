import json
import shutil
import sqlite3
import uuid
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from diplomat_worker.schemas.subtitle import SubtitleDocument, SubtitleStyle

SCHEMA_VERSION = 6
SUBTITLE_SNAPSHOT_SCHEMA_VERSION = "diplomat.subtitle-snapshot.v1"
STYLE_PRESET_SCHEMA_VERSION = "diplomat.style-presets.v1"
SUBTITLE_SNAPSHOT_REASONS = {
    "manual",
    "analysis_overwrite",
    "translation_overwrite",
    "batch_timing",
    "burn_in_export_preparation",
    "restore",
}


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


@dataclass(frozen=True)
class TaskRecord:
    task_id: str
    project_id: str
    type: str
    status: str
    progress: float
    message: str
    started_at: str | None
    updated_at: str
    completed_at: str | None
    error_code: str | None
    error_message: str | None
    diagnostic_log_path: str | None
    request_payload: dict


@dataclass(frozen=True)
class TranslationSettingsRecord:
    project_id: str
    provider: str
    model_id: str | None
    model_name_or_path: str | None
    source_language: str
    target_language: str
    mode: str
    device: str
    compute_type: str
    endpoint: str | None
    api_key_env: str | None
    updated_at: str


@dataclass(frozen=True)
class ProjectWarning:
    code: str
    message: str


@dataclass(frozen=True)
class ProjectDiagnostics:
    status: str
    warnings: list[ProjectWarning]
    source_video_exists: bool
    project_dir_exists: bool
    disk_usage_bytes: int
    cache_usage_bytes: int
    export_usage_bytes: int
    export_count: int
    subtitle_line_count: int
    translated_line_count: int
    active_task_count: int
    failed_task_count: int
    latest_task_status: str | None
    exports_dir: Path
    cache_dir: Path
    logs_dir: Path
    backups_dir: Path


@dataclass(frozen=True)
class ProjectMaintenanceResult:
    project_id: str
    action: str
    files_affected: int
    bytes_affected: int
    message: str


@dataclass(frozen=True)
class ProjectBackupResult:
    project_id: str
    package_path: Path
    bytes_written: int
    message: str


@dataclass(frozen=True)
class SubtitleDraftRecord:
    project_id: str
    updated_at: str
    line_count: int
    document: SubtitleDocument


@dataclass(frozen=True)
class SubtitleSnapshotRecord:
    snapshot_id: str
    project_id: str
    reason: str
    label: str | None
    created_at: str
    line_count: int
    document: SubtitleDocument


@dataclass(frozen=True)
class StylePresetRecord:
    id: str
    name: str
    style: SubtitleStyle
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class StylePresetListRecord:
    project_id: str
    active_preset_id: str | None
    presets: list[StylePresetRecord]


@dataclass(frozen=True)
class ModelInstallationRecord:
    model_id: str
    status: str
    installed_path: Path | None
    downloaded_bytes: int
    total_bytes: int
    checksum: str
    error_message: str | None
    created_at: str
    updated_at: str
    installed_at: str | None


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
            self._ensure_tasks_table(connection)
            self._ensure_translation_settings_table(connection)
            self._ensure_translation_settings_columns(connection)
            self._ensure_model_installations_table(connection)
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

    def _translation_settings_columns(self, connection: sqlite3.Connection) -> set[str]:
        return {
            row["name"]
            for row in connection.execute("PRAGMA table_info(translation_settings)").fetchall()
        }

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

    def _ensure_tasks_table(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                progress REAL NOT NULL,
                message TEXT NOT NULL,
                started_at TEXT,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                error_code TEXT,
                error_message TEXT,
                diagnostic_log_path TEXT,
                request_json TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(project_id)
            )
            """
        )

    def _ensure_translation_settings_table(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS translation_settings (
                project_id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                model_id TEXT,
                model_name_or_path TEXT,
                source_language TEXT NOT NULL,
                target_language TEXT NOT NULL,
                mode TEXT NOT NULL,
                device TEXT NOT NULL DEFAULT 'cpu',
                compute_type TEXT NOT NULL DEFAULT 'int8',
                endpoint TEXT,
                api_key_env TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(project_id)
            )
            """
        )

    def _ensure_translation_settings_columns(self, connection: sqlite3.Connection) -> None:
        columns = self._translation_settings_columns(connection)
        migrations = {
            "model_id": "ALTER TABLE translation_settings ADD COLUMN model_id TEXT",
            "model_name_or_path": "ALTER TABLE translation_settings ADD COLUMN model_name_or_path TEXT",
            "device": "ALTER TABLE translation_settings ADD COLUMN device TEXT NOT NULL DEFAULT 'cpu'",
            "compute_type": (
                "ALTER TABLE translation_settings ADD COLUMN compute_type TEXT NOT NULL DEFAULT 'int8'"
            ),
        }
        for column, statement in migrations.items():
            if column not in columns:
                connection.execute(statement)

    def _ensure_model_installations_table(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS model_installations (
                model_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                installed_path TEXT,
                downloaded_bytes INTEGER NOT NULL,
                total_bytes INTEGER NOT NULL,
                checksum TEXT NOT NULL,
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                installed_at TEXT
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

    def project_child_dir(self, project: ProjectRecord, name: str) -> Path:
        if name not in {"cache", "exports", "logs", "backups"}:
            raise ValueError(f"Unsupported project directory: {name}")
        return project.project_dir / name

    def project_diagnostics(self, project: ProjectRecord) -> ProjectDiagnostics:
        exports_dir = self.project_child_dir(project, "exports")
        cache_dir = self.project_child_dir(project, "cache")
        logs_dir = self.project_child_dir(project, "logs")
        backups_dir = self.project_child_dir(project, "backups")
        warnings: list[ProjectWarning] = []
        source_video_exists = project.source_video_path.is_file()
        project_dir_exists = project.project_dir.is_dir()

        if not source_video_exists:
            warnings.append(
                ProjectWarning(
                    code="source_missing",
                    message=f"Source video does not exist: {project.source_video_path}",
                )
            )
        if not project_dir_exists:
            warnings.append(
                ProjectWarning(
                    code="project_dir_missing",
                    message=f"Project directory does not exist: {project.project_dir}",
                )
            )

        subtitle_line_count = 0
        translated_line_count = 0
        subtitle_corrupted = False
        subtitle_path = project.project_dir / "subtitle.diplomat.json"
        if subtitle_path.is_file():
            try:
                document = self.load_subtitle_document(project.project_id)
                subtitle_line_count = len(document.lines)
                translated_line_count = sum(
                    1
                    for line in document.lines
                    if line.translated_text.strip()
                    or line.translation_status in {"translated", "edited"}
                )
            except Exception as exc:
                subtitle_corrupted = True
                warnings.append(
                    ProjectWarning(
                        code="subtitle_corrupted",
                        message=f"Subtitle document is corrupted: {exc}",
                    )
                )

        tasks = self.list_tasks_for_project(project.project_id)
        active_task_count = sum(1 for task in tasks if task.status in {"queued", "running", "canceling"})
        failed_task_count = sum(1 for task in tasks if task.status == "failed")
        latest_task_status = tasks[0].status if tasks else None
        export_count = self._directory_file_count(exports_dir)

        if subtitle_corrupted:
            status = "corrupted"
        elif failed_task_count > 0:
            status = "failed"
        elif (project.project_dir / "draft.diplomat.json").is_file():
            status = "dirty_draft"
        elif export_count > 0:
            status = "exported"
        elif translated_line_count > 0:
            status = "translated"
        elif subtitle_line_count > 0:
            status = "transcribed"
        else:
            status = "not_transcribed"

        return ProjectDiagnostics(
            status=status,
            warnings=warnings,
            source_video_exists=source_video_exists,
            project_dir_exists=project_dir_exists,
            disk_usage_bytes=self._directory_size(project.project_dir),
            cache_usage_bytes=self._directory_size(cache_dir),
            export_usage_bytes=self._directory_size(exports_dir),
            export_count=export_count,
            subtitle_line_count=subtitle_line_count,
            translated_line_count=translated_line_count,
            active_task_count=active_task_count,
            failed_task_count=failed_task_count,
            latest_task_status=latest_task_status,
            exports_dir=exports_dir,
            cache_dir=cache_dir,
            logs_dir=logs_dir,
            backups_dir=backups_dir,
        )

    def cleanup_project_cache(self, project_id: str) -> ProjectMaintenanceResult:
        project = self.get_project(project_id)
        return self._cleanup_project_child_dir(project, "cache", "cleanup_cache")

    def cleanup_project_exports(self, project_id: str) -> ProjectMaintenanceResult:
        project = self.get_project(project_id)
        return self._cleanup_project_child_dir(project, "exports", "cleanup_exports")

    def delete_project(self, project_id: str, delete_files: bool = True) -> ProjectMaintenanceResult:
        project = self.get_project(project_id)
        files_affected = 0
        bytes_affected = 0
        if delete_files and project.project_dir.exists():
            self._assert_safe_project_directory(project.project_dir)
            files_affected, bytes_affected = self._directory_file_stats(project.project_dir)

        with self._connect() as connection:
            connection.execute("DELETE FROM translation_settings WHERE project_id = ?", (project_id,))
            connection.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
            cursor = connection.execute("DELETE FROM projects WHERE project_id = ?", (project_id,))
            connection.commit()
        if cursor.rowcount == 0:
            raise KeyError(f"Project not found: {project_id}")

        if delete_files and project.project_dir.exists():
            shutil.rmtree(project.project_dir)

        return ProjectMaintenanceResult(
            project_id=project_id,
            action="delete",
            files_affected=files_affected,
            bytes_affected=bytes_affected,
            message="Project deleted.",
        )

    def backup_project(self, project_id: str) -> ProjectBackupResult:
        project = self.get_project(project_id)
        backups_dir = self.project_child_dir(project, "backups")
        backups_dir.mkdir(parents=True, exist_ok=True)
        package_path = backups_dir / f"{self._safe_filename(project.name)}-{project.project_id}.diplomat-project.zip"
        manifest = {
            "schemaVersion": "diplomat.project-backup.v1",
            "project": {
                "name": project.name,
                "sourceVideoPath": str(project.source_video_path),
                "durationMs": project.duration_ms,
                "sourceLanguage": project.source_language,
                "targetLanguage": project.target_language,
            },
        }

        with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            subtitle_path = project.project_dir / "subtitle.diplomat.json"
            if subtitle_path.is_file():
                archive.write(subtitle_path, "subtitle.diplomat.json")
            draft_path = project.project_dir / "draft.diplomat.json"
            if draft_path.is_file():
                archive.write(draft_path, "draft.diplomat.json")
            snapshots_dir = project.project_dir / "snapshots"
            if snapshots_dir.is_dir():
                for item in snapshots_dir.rglob("*.diplomat-snapshot.json"):
                    if item.is_file():
                        archive.write(item, Path("snapshots") / item.relative_to(snapshots_dir))
            style_presets_path = project.project_dir / "style-presets.diplomat.json"
            if style_presets_path.is_file():
                archive.write(style_presets_path, "style-presets.diplomat.json")
            settings = self.get_translation_settings(project.project_id)
            archive.writestr(
                "translation-settings.json",
                json.dumps(
                    {
                        "provider": settings.provider,
                        "modelId": settings.model_id,
                        "modelNameOrPath": settings.model_name_or_path,
                        "sourceLanguage": settings.source_language,
                        "targetLanguage": settings.target_language,
                        "mode": settings.mode,
                        "device": settings.device,
                        "computeType": settings.compute_type,
                        "endpoint": settings.endpoint,
                        "apiKeyEnv": settings.api_key_env,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            )
            exports_dir = self.project_child_dir(project, "exports")
            if exports_dir.is_dir():
                for item in exports_dir.rglob("*"):
                    if item.is_file():
                        archive.write(item, Path("exports") / item.relative_to(exports_dir))

        return ProjectBackupResult(
            project_id=project_id,
            package_path=package_path,
            bytes_written=package_path.stat().st_size,
            message="Project backup created.",
        )

    def import_project_backup(self, package_path: Path, restore_name: str | None = None) -> ProjectRecord:
        package_path = Path(package_path)
        if not package_path.is_file():
            raise ValueError(f"Project backup does not exist: {package_path}")

        with zipfile.ZipFile(package_path, "r") as archive:
            manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
            if manifest.get("schemaVersion") != "diplomat.project-backup.v1":
                raise ValueError("Unsupported project backup schema version")
            project_payload = manifest.get("project")
            if not isinstance(project_payload, dict):
                raise ValueError("Project backup manifest is missing project metadata")

            project = self.create_project(
                name=restore_name or str(project_payload["name"]),
                source_video_path=Path(str(project_payload["sourceVideoPath"])),
                duration_ms=int(project_payload["durationMs"]),
                source_language=str(project_payload["sourceLanguage"]),
                target_language=project_payload.get("targetLanguage"),
            )

            if "subtitle.diplomat.json" in archive.namelist():
                subtitle_payload = json.loads(archive.read("subtitle.diplomat.json").decode("utf-8"))
                subtitle_payload["projectId"] = project.project_id
                document = SubtitleDocument.model_validate(subtitle_payload)
                self.save_subtitle_document(project.project_id, document)

            if "draft.diplomat.json" in archive.namelist():
                draft_payload = json.loads(archive.read("draft.diplomat.json").decode("utf-8"))
                draft_payload["projectId"] = project.project_id
                document = SubtitleDocument.model_validate(draft_payload)
                self.save_subtitle_draft(project.project_id, document)

            snapshots_dir = project.project_dir / "snapshots"
            for name in archive.namelist():
                if not name.startswith("snapshots/") or name.endswith("/"):
                    continue
                target = snapshots_dir / Path(name).relative_to("snapshots")
                self._assert_safe_child_path(snapshots_dir, target)
                payload = json.loads(archive.read(name).decode("utf-8"))
                payload["projectId"] = project.project_id
                payload["document"]["projectId"] = project.project_id
                record = self._subtitle_snapshot_record_from_payload(payload)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(
                    json.dumps(self._subtitle_snapshot_payload(record), ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )

            if "style-presets.diplomat.json" in archive.namelist():
                style_preset_payload = json.loads(archive.read("style-presets.diplomat.json").decode("utf-8"))
                style_preset_payload["projectId"] = project.project_id
                style_presets = self._style_preset_list_from_payload(style_preset_payload)
                self._write_style_preset_list(project, style_presets)

            if "translation-settings.json" in archive.namelist():
                settings = json.loads(archive.read("translation-settings.json").decode("utf-8"))
                self.save_translation_settings(
                    project.project_id,
                    provider=settings["provider"],
                    model_id=settings.get("modelId"),
                    model_name_or_path=settings.get("modelNameOrPath"),
                    source_language=settings["sourceLanguage"],
                    target_language=settings["targetLanguage"],
                    mode=settings["mode"],
                    device=settings.get("device", "cpu"),
                    compute_type=settings.get("computeType", "int8"),
                    endpoint=settings.get("endpoint"),
                    api_key_env=settings.get("apiKeyEnv"),
                )

            exports_dir = self.project_child_dir(project, "exports")
            for name in archive.namelist():
                if not name.startswith("exports/") or name.endswith("/"):
                    continue
                target = exports_dir / Path(name).relative_to("exports")
                self._assert_safe_child_path(exports_dir, target)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(name))

        return self.get_project(project.project_id)

    def models_root(self) -> Path:
        root = self.root_dir / "models"
        root.mkdir(parents=True, exist_ok=True)
        return root

    def safe_model_dir(self, model_id: str) -> Path:
        if not model_id.strip():
            raise ValueError("model_id is required")
        return self.models_root() / self._safe_filename(model_id)

    def get_model_installation(
        self,
        model_id: str,
        checksum: str,
        total_bytes: int,
    ) -> ModelInstallationRecord:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    model_id,
                    status,
                    installed_path,
                    downloaded_bytes,
                    total_bytes,
                    checksum,
                    error_message,
                    created_at,
                    updated_at,
                    installed_at
                FROM model_installations
                WHERE model_id = ?
                """,
                (model_id,),
            ).fetchone()
        if row is not None:
            return self._model_installation_from_row(row)
        now = self._utc_now()
        return ModelInstallationRecord(
            model_id=model_id,
            status="not_installed",
            installed_path=None,
            downloaded_bytes=0,
            total_bytes=total_bytes,
            checksum=checksum,
            error_message=None,
            created_at=now,
            updated_at=now,
            installed_at=None,
        )

    def list_model_installations(self) -> list[ModelInstallationRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    model_id,
                    status,
                    installed_path,
                    downloaded_bytes,
                    total_bytes,
                    checksum,
                    error_message,
                    created_at,
                    updated_at,
                    installed_at
                FROM model_installations
                ORDER BY updated_at DESC, model_id ASC
                """
            ).fetchall()
        return [self._model_installation_from_row(row) for row in rows]

    def upsert_model_installation(
        self,
        model_id: str,
        status: str,
        installed_path: Path | None,
        downloaded_bytes: int,
        total_bytes: int,
        checksum: str,
        error_message: str | None = None,
        installed: bool = False,
    ) -> ModelInstallationRecord:
        if downloaded_bytes < 0 or total_bytes < 0:
            raise ValueError("model byte counts must be nonnegative")
        if installed_path is not None:
            self._assert_safe_model_path(installed_path)
        now = self._utc_now()
        existing = self.get_model_installation(model_id, checksum=checksum, total_bytes=total_bytes)
        installed_at = now if installed else (existing.installed_at if status == "installed" else None)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO model_installations (
                    model_id,
                    status,
                    installed_path,
                    downloaded_bytes,
                    total_bytes,
                    checksum,
                    error_message,
                    created_at,
                    updated_at,
                    installed_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(model_id) DO UPDATE SET
                    status = excluded.status,
                    installed_path = excluded.installed_path,
                    downloaded_bytes = excluded.downloaded_bytes,
                    total_bytes = excluded.total_bytes,
                    checksum = excluded.checksum,
                    error_message = excluded.error_message,
                    updated_at = excluded.updated_at,
                    installed_at = excluded.installed_at
                """,
                (
                    model_id,
                    status,
                    str(installed_path) if installed_path is not None else None,
                    downloaded_bytes,
                    total_bytes,
                    checksum,
                    error_message,
                    existing.created_at,
                    now,
                    installed_at,
                ),
            )
            connection.commit()
        return self.get_model_installation(model_id, checksum=checksum, total_bytes=total_bytes)

    def delete_model_installation(self, model_id: str) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM model_installations WHERE model_id = ?", (model_id,))
            connection.commit()

    def delete_model_files(self, model_id: str, checksum: str, total_bytes: int) -> tuple[int, int]:
        installation = self.get_model_installation(model_id, checksum=checksum, total_bytes=total_bytes)
        path = installation.installed_path or self.safe_model_dir(model_id)
        if not path.exists():
            return 0, 0
        self._assert_safe_model_path(path)
        if path.resolve() == self.models_root().resolve():
            raise ValueError(f"Refusing unsafe model directory deletion: {path}")
        files_affected, bytes_affected = self._directory_file_stats(path)
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        return files_affected, bytes_affected

    def _subtitle_snapshot_path(self, project: ProjectRecord, snapshot_id: str) -> Path:
        if not snapshot_id.startswith("snapshot-"):
            raise ValueError("snapshot_id must start with snapshot-")
        if self._safe_filename(snapshot_id) != snapshot_id:
            raise ValueError(f"Unsupported subtitle snapshot id: {snapshot_id}")
        return project.project_dir / "snapshots" / f"{snapshot_id}.diplomat-snapshot.json"

    def _subtitle_snapshot_payload(self, record: SubtitleSnapshotRecord) -> dict:
        return {
            "schemaVersion": SUBTITLE_SNAPSHOT_SCHEMA_VERSION,
            "snapshotId": record.snapshot_id,
            "projectId": record.project_id,
            "reason": record.reason,
            "label": record.label,
            "createdAt": record.created_at,
            "lineCount": record.line_count,
            "document": record.document.model_dump(by_alias=True),
        }

    def _subtitle_snapshot_record_from_path(self, path: Path) -> SubtitleSnapshotRecord:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return self._subtitle_snapshot_record_from_payload(payload)

    def _subtitle_snapshot_record_from_payload(self, payload: dict) -> SubtitleSnapshotRecord:
        if payload.get("schemaVersion") != SUBTITLE_SNAPSHOT_SCHEMA_VERSION:
            raise ValueError("Unsupported subtitle snapshot schema version")
        reason = str(payload["reason"])
        if reason not in SUBTITLE_SNAPSHOT_REASONS:
            raise ValueError(f"Unsupported subtitle snapshot reason: {reason}")
        document = SubtitleDocument.model_validate(payload["document"])
        snapshot_id = str(payload["snapshotId"])
        project_id = str(payload["projectId"])
        if document.project_id != project_id:
            raise ValueError("snapshot document project_id must match snapshot project_id")
        return SubtitleSnapshotRecord(
            snapshot_id=snapshot_id,
            project_id=project_id,
            reason=reason,
            label=payload.get("label"),
            created_at=str(payload["createdAt"]),
            line_count=int(payload.get("lineCount", len(document.lines))),
            document=document,
        )

    def _style_preset_path(self, project: ProjectRecord) -> Path:
        return project.project_dir / "style-presets.diplomat.json"

    def _style_preset_payload(self, record: StylePresetRecord) -> dict:
        return {
            "id": record.id,
            "name": record.name,
            "style": record.style.model_dump(by_alias=True),
            "createdAt": record.created_at,
            "updatedAt": record.updated_at,
        }

    def _style_preset_list_payload(self, record: StylePresetListRecord) -> dict:
        return {
            "schemaVersion": STYLE_PRESET_SCHEMA_VERSION,
            "projectId": record.project_id,
            "activePresetId": record.active_preset_id,
            "presets": [self._style_preset_payload(preset) for preset in record.presets],
        }

    def _style_preset_from_payload(self, payload: dict) -> StylePresetRecord:
        style = SubtitleStyle.model_validate(payload["style"])
        return StylePresetRecord(
            id=str(payload["id"]),
            name=str(payload["name"]),
            style=style,
            created_at=str(payload["createdAt"]),
            updated_at=str(payload["updatedAt"]),
        )

    def _style_preset_list_from_payload(self, payload: dict) -> StylePresetListRecord:
        if payload.get("schemaVersion") != STYLE_PRESET_SCHEMA_VERSION:
            raise ValueError("Unsupported style preset schema version")
        project_id = str(payload["projectId"])
        presets = [self._style_preset_from_payload(item) for item in payload.get("presets", [])]
        active_preset_id = payload.get("activePresetId")
        if active_preset_id is not None and not any(preset.id == active_preset_id for preset in presets):
            active_preset_id = presets[0].id if presets else None
        return StylePresetListRecord(
            project_id=project_id,
            active_preset_id=active_preset_id,
            presets=presets,
        )

    def _read_style_preset_list(self, project: ProjectRecord) -> StylePresetListRecord:
        path = self._style_preset_path(project)
        if not path.is_file():
            return self._default_style_preset_list(project)
        payload = json.loads(path.read_text(encoding="utf-8"))
        record = self._style_preset_list_from_payload(payload)
        if record.project_id != project.project_id:
            raise ValueError("style preset project_id must match project_id")
        if not record.presets:
            return self._default_style_preset_list(project)
        return record

    def _write_style_preset_list(self, project: ProjectRecord, record: StylePresetListRecord) -> None:
        if record.project_id != project.project_id:
            raise ValueError("style preset project_id must match project_id")
        path = self._style_preset_path(project)
        path.write_text(
            json.dumps(self._style_preset_list_payload(record), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self.touch_project(project.project_id)

    def _default_style_preset_list(self, project: ProjectRecord) -> StylePresetListRecord:
        now = project.updated_at or self._utc_now()
        style = self._project_default_style(project)
        preset = StylePresetRecord(
            id="preset-default",
            name=style.name or "Default",
            style=style.model_copy(update={"id": style.id or "default", "name": style.name or "Default"}),
            created_at=now,
            updated_at=now,
        )
        return StylePresetListRecord(
            project_id=project.project_id,
            active_preset_id=preset.id,
            presets=[preset],
        )

    def _project_default_style(self, project: ProjectRecord) -> SubtitleStyle:
        subtitle_path = project.project_dir / "subtitle.diplomat.json"
        if subtitle_path.is_file():
            try:
                document = self.load_subtitle_document(project.project_id)
                if document.styles:
                    return document.styles[0]
            except Exception:
                pass
        return self._fallback_subtitle_style()

    def _fallback_subtitle_style(self) -> SubtitleStyle:
        return SubtitleStyle(
            id="default",
            name="Default",
            font_family="Arial",
            font_size=36,
            primary_color="#FFFFFF",
            secondary_color="#14B8A6",
            stroke_width=3,
            shadow=1,
            position="bottom-center",
            margin_v=48,
            alignment="center",
            bilingual_layout="source-above-target",
            line_spacing=1.15,
        )

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
        draft_path = project.project_dir / "draft.diplomat.json"
        if draft_path.exists():
            draft_path.unlink()
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

    def save_subtitle_draft(
        self,
        project_id: str,
        document: SubtitleDocument,
    ) -> SubtitleDraftRecord:
        if document.project_id != project_id:
            raise ValueError("document.project_id must match project_id")
        project = self.get_project(project_id)
        path = project.project_dir / "draft.diplomat.json"
        path.write_text(
            json.dumps(document.model_dump(by_alias=True), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self.touch_project(project_id)
        updated_at = self.get_project(project_id).updated_at
        return SubtitleDraftRecord(
            project_id=project_id,
            updated_at=updated_at,
            line_count=len(document.lines),
            document=document,
        )

    def load_subtitle_draft(self, project_id: str) -> SubtitleDocument:
        project = self.get_project(project_id)
        path = project.project_dir / "draft.diplomat.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        return SubtitleDocument.model_validate(payload)

    def get_subtitle_draft_record(self, project_id: str) -> SubtitleDraftRecord:
        document = self.load_subtitle_draft(project_id)
        project = self.get_project(project_id)
        path = project.project_dir / "draft.diplomat.json"
        updated_at = datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat()
        return SubtitleDraftRecord(
            project_id=project_id,
            updated_at=updated_at,
            line_count=len(document.lines),
            document=document,
        )

    def delete_subtitle_draft(self, project_id: str) -> None:
        project = self.get_project(project_id)
        path = project.project_dir / "draft.diplomat.json"
        if not path.exists():
            raise FileNotFoundError(path)
        path.unlink()
        self.touch_project(project_id)

    def create_subtitle_snapshot(
        self,
        project_id: str,
        reason: str = "manual",
        label: str | None = None,
        document: SubtitleDocument | None = None,
    ) -> SubtitleSnapshotRecord:
        if reason not in SUBTITLE_SNAPSHOT_REASONS:
            raise ValueError(f"Unsupported subtitle snapshot reason: {reason}")
        project = self.get_project(project_id)
        snapshot_document = document if document is not None else self.load_subtitle_document(project_id)
        if snapshot_document.project_id != project_id:
            raise ValueError("document.project_id must match project_id")
        created_at = self._utc_now()
        snapshot_id = f"snapshot-{datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')}-{uuid.uuid4().hex[:8]}"
        record = SubtitleSnapshotRecord(
            snapshot_id=snapshot_id,
            project_id=project_id,
            reason=reason,
            label=label.strip() if label and label.strip() else None,
            created_at=created_at,
            line_count=len(snapshot_document.lines),
            document=snapshot_document,
        )
        path = self._subtitle_snapshot_path(project, snapshot_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(self._subtitle_snapshot_payload(record), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self.touch_project(project_id)
        return record

    def list_subtitle_snapshots(self, project_id: str) -> list[SubtitleSnapshotRecord]:
        project = self.get_project(project_id)
        snapshots_dir = project.project_dir / "snapshots"
        if not snapshots_dir.is_dir():
            return []
        records = [
            self._subtitle_snapshot_record_from_path(path)
            for path in snapshots_dir.glob("*.diplomat-snapshot.json")
            if path.is_file()
        ]
        return sorted(records, key=lambda record: record.created_at, reverse=True)

    def load_subtitle_snapshot(
        self,
        project_id: str,
        snapshot_id: str,
    ) -> SubtitleSnapshotRecord:
        project = self.get_project(project_id)
        path = self._subtitle_snapshot_path(project, snapshot_id)
        if not path.is_file():
            raise FileNotFoundError(path)
        record = self._subtitle_snapshot_record_from_path(path)
        if record.project_id != project_id:
            raise ValueError("snapshot project_id must match project_id")
        return record

    def restore_subtitle_snapshot(
        self,
        project_id: str,
        snapshot_id: str,
    ) -> SubtitleDocument:
        record = self.load_subtitle_snapshot(project_id, snapshot_id)
        self.save_subtitle_document(project_id, record.document)
        return record.document

    def list_style_presets(self, project_id: str) -> StylePresetListRecord:
        project = self.get_project(project_id)
        return self._read_style_preset_list(project)

    def get_style_preset(self, project_id: str, preset_id: str) -> StylePresetRecord:
        presets = self.list_style_presets(project_id)
        for preset in presets.presets:
            if preset.id == preset_id:
                return preset
        raise FileNotFoundError(f"Style preset not found: {preset_id}")

    def create_style_preset(
        self,
        project_id: str,
        name: str,
        style: SubtitleStyle,
    ) -> StylePresetRecord:
        project = self.get_project(project_id)
        normalized_name = name.strip()
        if not normalized_name:
            raise ValueError("style preset name must not be empty")
        presets = self._read_style_preset_list(project)
        now = self._utc_now()
        record = StylePresetRecord(
            id=f"preset-{uuid.uuid4().hex}",
            name=normalized_name,
            style=style.model_copy(update={"name": normalized_name}),
            created_at=now,
            updated_at=now,
        )
        self._write_style_preset_list(
            project,
            StylePresetListRecord(
                project_id=project_id,
                active_preset_id=presets.active_preset_id,
                presets=[*presets.presets, record],
            ),
        )
        return record

    def update_style_preset(
        self,
        project_id: str,
        preset_id: str,
        *,
        name: str | None = None,
        style: SubtitleStyle | None = None,
    ) -> StylePresetRecord:
        project = self.get_project(project_id)
        presets = self._read_style_preset_list(project)
        normalized_name = name.strip() if name is not None else None
        if normalized_name == "":
            raise ValueError("style preset name must not be empty")
        now = self._utc_now()
        updated_record: StylePresetRecord | None = None
        updated_presets: list[StylePresetRecord] = []
        for preset in presets.presets:
            if preset.id != preset_id:
                updated_presets.append(preset)
                continue
            next_name = normalized_name or preset.name
            next_style = style or preset.style
            next_style = next_style.model_copy(update={"name": next_name})
            updated_record = StylePresetRecord(
                id=preset.id,
                name=next_name,
                style=next_style,
                created_at=preset.created_at,
                updated_at=now,
            )
            updated_presets.append(updated_record)
        if updated_record is None:
            raise FileNotFoundError(f"Style preset not found: {preset_id}")
        self._write_style_preset_list(
            project,
            StylePresetListRecord(
                project_id=project_id,
                active_preset_id=presets.active_preset_id,
                presets=updated_presets,
            ),
        )
        return updated_record

    def delete_style_preset(self, project_id: str, preset_id: str) -> StylePresetListRecord:
        project = self.get_project(project_id)
        presets = self._read_style_preset_list(project)
        next_presets = [preset for preset in presets.presets if preset.id != preset_id]
        if len(next_presets) == len(presets.presets):
            raise FileNotFoundError(f"Style preset not found: {preset_id}")
        if not next_presets:
            next_presets = self._default_style_preset_list(project).presets
        active_preset_id = presets.active_preset_id
        if active_preset_id == preset_id or not any(preset.id == active_preset_id for preset in next_presets):
            active_preset_id = next_presets[0].id
        record = StylePresetListRecord(
            project_id=project_id,
            active_preset_id=active_preset_id,
            presets=next_presets,
        )
        self._write_style_preset_list(project, record)
        return record

    def apply_style_preset(self, project_id: str, preset_id: str) -> StylePresetListRecord:
        project = self.get_project(project_id)
        presets = self._read_style_preset_list(project)
        selected = None
        for preset in presets.presets:
            if preset.id == preset_id:
                selected = preset
                break
        if selected is None:
            raise FileNotFoundError(f"Style preset not found: {preset_id}")

        document = self.load_subtitle_document(project_id)
        style = selected.style.model_copy(update={"name": selected.name})
        next_styles = [style, *document.styles[1:]] if document.styles else [style]
        self.save_subtitle_document(project_id, document.model_copy(update={"styles": next_styles}))
        record = StylePresetListRecord(
            project_id=project_id,
            active_preset_id=selected.id,
            presets=presets.presets,
        )
        self._write_style_preset_list(project, record)
        return record

    def get_translation_settings(self, project_id: str) -> TranslationSettingsRecord:
        project = self.get_project(project_id)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    project_id,
                    provider,
                    model_id,
                    model_name_or_path,
                    source_language,
                    target_language,
                    mode,
                    device,
                    compute_type,
                    endpoint,
                    api_key_env,
                    updated_at
                FROM translation_settings
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()
        if row is not None:
            return self._translation_settings_from_row(row)
        return TranslationSettingsRecord(
            project_id=project.project_id,
            provider="fake",
            model_id=None,
            model_name_or_path=None,
            source_language=project.source_language,
            target_language=project.target_language or "en",
            mode="missing_only",
            device="cpu",
            compute_type="int8",
            endpoint=None,
            api_key_env=None,
            updated_at=project.updated_at,
        )

    def save_translation_settings(
        self,
        project_id: str,
        provider: str,
        source_language: str,
        target_language: str,
        mode: str,
        model_id: str | None = None,
        model_name_or_path: str | None = None,
        device: str = "cpu",
        compute_type: str = "int8",
        endpoint: str | None = None,
        api_key_env: str | None = None,
    ) -> TranslationSettingsRecord:
        self.get_project(project_id)
        if len(source_language) < 2:
            raise ValueError("source_language must be at least 2 characters")
        if len(target_language) < 2:
            raise ValueError("target_language must be at least 2 characters")
        if mode not in {"missing_only", "overwrite_all"}:
            raise ValueError("Unsupported translation mode")
        if not device.strip():
            raise ValueError("device must not be empty")
        if not compute_type.strip():
            raise ValueError("compute_type must not be empty")
        now = self._utc_now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO translation_settings (
                    project_id,
                    provider,
                    model_id,
                    model_name_or_path,
                    source_language,
                    target_language,
                    mode,
                    device,
                    compute_type,
                    endpoint,
                    api_key_env,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id) DO UPDATE SET
                    provider = excluded.provider,
                    model_id = excluded.model_id,
                    model_name_or_path = excluded.model_name_or_path,
                    source_language = excluded.source_language,
                    target_language = excluded.target_language,
                    mode = excluded.mode,
                    device = excluded.device,
                    compute_type = excluded.compute_type,
                    endpoint = excluded.endpoint,
                    api_key_env = excluded.api_key_env,
                    updated_at = excluded.updated_at
                """,
                (
                    project_id,
                    provider,
                    model_id,
                    model_name_or_path,
                    source_language,
                    target_language,
                    mode,
                    device,
                    compute_type,
                    endpoint,
                    api_key_env,
                    now,
                ),
            )
            connection.commit()
        return self.get_translation_settings(project_id)

    def _translation_settings_from_row(self, row: sqlite3.Row) -> TranslationSettingsRecord:
        return TranslationSettingsRecord(
            project_id=row["project_id"],
            provider=row["provider"],
            model_id=row["model_id"],
            model_name_or_path=row["model_name_or_path"],
            source_language=row["source_language"],
            target_language=row["target_language"],
            mode=row["mode"],
            device=row["device"],
            compute_type=row["compute_type"],
            endpoint=row["endpoint"],
            api_key_env=row["api_key_env"],
            updated_at=row["updated_at"],
        )

    def _model_installation_from_row(self, row: sqlite3.Row) -> ModelInstallationRecord:
        installed_path = row["installed_path"]
        return ModelInstallationRecord(
            model_id=row["model_id"],
            status=row["status"],
            installed_path=Path(installed_path) if installed_path else None,
            downloaded_bytes=row["downloaded_bytes"],
            total_bytes=row["total_bytes"],
            checksum=row["checksum"],
            error_message=row["error_message"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            installed_at=row["installed_at"],
        )

    def touch_project(self, project_id: str) -> None:
        with self._connect() as connection:
            cursor = connection.execute(
                "UPDATE projects SET updated_at = ? WHERE project_id = ?",
                (self._utc_now(), project_id),
            )
            connection.commit()
        if cursor.rowcount == 0:
            raise KeyError(f"Project not found: {project_id}")

    def create_task(
        self,
        project_id: str,
        task_type: str,
        message: str,
        request_payload: dict,
    ) -> TaskRecord:
        self.get_project(project_id)
        task_id = f"task-{uuid.uuid4().hex}"
        now = self._utc_now()
        request_json = json.dumps(request_payload, ensure_ascii=False, sort_keys=True)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO tasks (
                    task_id,
                    project_id,
                    type,
                    status,
                    progress,
                    message,
                    started_at,
                    updated_at,
                    completed_at,
                    error_code,
                    error_message,
                    diagnostic_log_path,
                    request_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    project_id,
                    task_type,
                    "queued",
                    0,
                    message,
                    None,
                    now,
                    None,
                    None,
                    None,
                    None,
                    request_json,
                ),
            )
            connection.commit()
        return self.get_task(task_id)

    def get_task(self, task_id: str) -> TaskRecord:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    task_id,
                    project_id,
                    type,
                    status,
                    progress,
                    message,
                    started_at,
                    updated_at,
                    completed_at,
                    error_code,
                    error_message,
                    diagnostic_log_path,
                    request_json
                FROM tasks
                WHERE task_id = ?
                """,
                (task_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Task not found: {task_id}")
        return self._task_from_row(row)

    def list_tasks_for_project(self, project_id: str) -> list[TaskRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    task_id,
                    project_id,
                    type,
                    status,
                    progress,
                    message,
                    started_at,
                    updated_at,
                    completed_at,
                    error_code,
                    error_message,
                    diagnostic_log_path,
                    request_json
                FROM tasks
                WHERE project_id = ?
                ORDER BY updated_at DESC, rowid DESC
                """,
                (project_id,),
            ).fetchall()
        return [self._task_from_row(row) for row in rows]

    def update_task(
        self,
        task_id: str,
        status: str | None = None,
        progress: float | None = None,
        message: str | None = None,
        started: bool = False,
        completed: bool = False,
        error_code: str | None = None,
        error_message: str | None = None,
        diagnostic_log_path: str | None = None,
    ) -> TaskRecord:
        current = self.get_task(task_id)
        now = self._utc_now()
        next_started_at = current.started_at
        next_completed_at = current.completed_at
        if started and next_started_at is None:
            next_started_at = now
        if completed and next_completed_at is None:
            next_completed_at = now

        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE tasks
                SET
                    status = ?,
                    progress = ?,
                    message = ?,
                    started_at = ?,
                    updated_at = ?,
                    completed_at = ?,
                    error_code = ?,
                    error_message = ?,
                    diagnostic_log_path = ?
                WHERE task_id = ?
                """,
                (
                    status if status is not None else current.status,
                    progress if progress is not None else current.progress,
                    message if message is not None else current.message,
                    next_started_at,
                    now,
                    next_completed_at,
                    error_code if error_code is not None else current.error_code,
                    error_message if error_message is not None else current.error_message,
                    diagnostic_log_path if diagnostic_log_path is not None else current.diagnostic_log_path,
                    task_id,
                ),
            )
            connection.commit()
        if cursor.rowcount == 0:
            raise KeyError(f"Task not found: {task_id}")
        return self.get_task(task_id)

    def _task_from_row(self, row: sqlite3.Row) -> TaskRecord:
        return TaskRecord(
            task_id=row["task_id"],
            project_id=row["project_id"],
            type=row["type"],
            status=row["status"],
            progress=row["progress"],
            message=row["message"],
            started_at=row["started_at"],
            updated_at=row["updated_at"],
            completed_at=row["completed_at"],
            error_code=row["error_code"],
            error_message=row["error_message"],
            diagnostic_log_path=row["diagnostic_log_path"],
            request_payload=json.loads(row["request_json"]),
        )

    def _cleanup_project_child_dir(
        self,
        project: ProjectRecord,
        directory_name: str,
        action: str,
    ) -> ProjectMaintenanceResult:
        path = self.project_child_dir(project, directory_name)
        self._assert_safe_child_path(project.project_dir, path)
        files_affected, bytes_affected = self._remove_directory_contents(path)
        return ProjectMaintenanceResult(
            project_id=project.project_id,
            action=action,
            files_affected=files_affected,
            bytes_affected=bytes_affected,
            message=f"Project {directory_name} cleaned.",
        )

    def _remove_directory_contents(self, path: Path) -> tuple[int, int]:
        path.mkdir(parents=True, exist_ok=True)
        files_affected, bytes_affected = self._directory_file_stats(path)
        for child in list(path.iterdir()):
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        path.mkdir(parents=True, exist_ok=True)
        return files_affected, bytes_affected

    def _assert_safe_project_directory(self, path: Path) -> None:
        resolved = path.resolve()
        root = self.root_dir.resolve()
        projects_root = (self.root_dir / "projects").resolve()
        if not (self._is_relative_to(resolved, projects_root) or self._is_relative_to(resolved, root)):
            raise ValueError(f"Refusing unsafe project directory deletion: {path}")
        if resolved == root or resolved == projects_root:
            raise ValueError(f"Refusing unsafe project directory deletion: {path}")

    def _assert_safe_child_path(self, root: Path, path: Path) -> None:
        resolved_root = root.resolve()
        resolved_path = path.resolve()
        if not self._is_relative_to(resolved_path, resolved_root):
            raise ValueError(f"Refusing unsafe project child path: {path}")

    def _assert_safe_model_path(self, path: Path) -> None:
        resolved_root = self.models_root().resolve()
        resolved_path = path.resolve()
        if not self._is_relative_to(resolved_path, resolved_root):
            raise ValueError(f"Refusing unsafe model path: {path}")
        if resolved_path == resolved_root:
            raise ValueError(f"Refusing unsafe model path: {path}")

    def _is_relative_to(self, path: Path, root: Path) -> bool:
        try:
            path.relative_to(root)
            return True
        except ValueError:
            return False

    def _directory_file_stats(self, path: Path) -> tuple[int, int]:
        if not path.exists():
            return 0, 0
        files = [item for item in path.rglob("*") if item.is_file()]
        return len(files), sum(item.stat().st_size for item in files)

    def _directory_size(self, path: Path) -> int:
        return self._directory_file_stats(path)[1]

    def _directory_file_count(self, path: Path) -> int:
        return self._directory_file_stats(path)[0]

    def _safe_filename(self, value: str) -> str:
        normalized = "".join(
            character if character.isalnum() or character in {"-", "_"} else "-"
            for character in value.strip().lower()
        ).strip("-")
        return normalized or "project"

    def _utc_now(self) -> str:
        return datetime.now(UTC).isoformat()
