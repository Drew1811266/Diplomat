from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from diplomat_worker.schemas.subtitle import SubtitleDocument


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class CreateProjectRequest(CamelModel):
    name: str = Field(min_length=1)
    source_video_path: Path = Field(alias="sourceVideoPath")
    source_language: str = Field(alias="sourceLanguage", min_length=2, max_length=12)
    target_language: str | None = Field(default=None, alias="targetLanguage", min_length=2, max_length=12)


class ProjectResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    name: str
    source_video_path: str = Field(alias="sourceVideoPath")
    project_dir: str = Field(alias="projectDir")
    duration_ms: int = Field(alias="durationMs", ge=0)
    source_language: str = Field(alias="sourceLanguage")
    target_language: str | None = Field(default=None, alias="targetLanguage")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    has_subtitle_document: bool = Field(alias="hasSubtitleDocument")
    diagnostics: "ProjectDiagnosticsResponse"


class ProjectListResponse(CamelModel):
    projects: list[ProjectResponse]


class ProjectWarningResponse(CamelModel):
    code: Literal[
        "source_missing",
        "project_dir_missing",
        "subtitle_corrupted",
        "unsafe_project_path",
        "migration_failed",
    ]
    message: str


class ProjectDiagnosticsResponse(CamelModel):
    status: Literal[
        "not_transcribed",
        "transcribed",
        "translated",
        "dirty_draft",
        "exported",
        "failed",
        "corrupted",
        "migration_failed",
    ]
    warnings: list[ProjectWarningResponse]
    source_video_exists: bool = Field(alias="sourceVideoExists")
    project_dir_exists: bool = Field(alias="projectDirExists")
    disk_usage_bytes: int = Field(alias="diskUsageBytes", ge=0)
    cache_usage_bytes: int = Field(alias="cacheUsageBytes", ge=0)
    export_usage_bytes: int = Field(alias="exportUsageBytes", ge=0)
    export_count: int = Field(alias="exportCount", ge=0)
    subtitle_line_count: int = Field(alias="subtitleLineCount", ge=0)
    translated_line_count: int = Field(alias="translatedLineCount", ge=0)
    active_task_count: int = Field(alias="activeTaskCount", ge=0)
    failed_task_count: int = Field(alias="failedTaskCount", ge=0)
    latest_task_status: str | None = Field(default=None, alias="latestTaskStatus")
    exports_dir: str = Field(alias="exportsDir")
    cache_dir: str = Field(alias="cacheDir")
    logs_dir: str = Field(alias="logsDir")
    backups_dir: str = Field(alias="backupsDir")


class ProjectMaintenanceResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    action: Literal["delete", "cleanup_cache", "cleanup_exports", "import"]
    files_affected: int = Field(alias="filesAffected", ge=0)
    bytes_affected: int = Field(alias="bytesAffected", ge=0)
    message: str


class ProjectBackupResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    package_path: str = Field(alias="packagePath")
    bytes_written: int = Field(alias="bytesWritten", ge=0)
    message: str


class ProjectImportRequest(CamelModel):
    package_path: Path = Field(alias="packagePath")
    restore_name: str | None = Field(default=None, alias="restoreName", min_length=1)


class AnalysisJobRequest(CamelModel):
    provider: Literal["fake", "faster-whisper"] = "fake"
    model_name_or_path: str | None = Field(default=None, alias="modelNameOrPath")
    device: str = "cpu"
    compute_type: str = Field(default="int8", alias="computeType")
    source_language: str | None = Field(default=None, alias="sourceLanguage", min_length=2, max_length=12)
    initial_prompt: str | None = Field(default=None, alias="initialPrompt")


class TranslationSettingsRequest(CamelModel):
    provider: Literal["fake", "libretranslate"] = "fake"
    source_language: str = Field(alias="sourceLanguage", min_length=2, max_length=12)
    target_language: str = Field(alias="targetLanguage", min_length=2, max_length=12)
    mode: Literal["missing_only", "overwrite_all"] = "missing_only"
    endpoint: str | None = None
    api_key_env: str | None = Field(default=None, alias="apiKeyEnv")


class TranslationSettingsResponse(TranslationSettingsRequest):
    project_id: str = Field(alias="projectId", min_length=1)
    updated_at: str = Field(alias="updatedAt")


class TranslationJobRequest(TranslationSettingsRequest):
    pass


class AnalyzeProjectResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    status: Literal["completed"]
    subtitle_path: str = Field(alias="subtitlePath")
    line_count: int = Field(alias="lineCount", ge=0)
    document: SubtitleDocument


class SubtitleDocumentRequest(CamelModel):
    document: SubtitleDocument


class SrtExportRequest(CamelModel):
    mode: Literal["source", "target", "bilingual"] = "bilingual"


class SrtExportResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    export_path: str = Field(alias="exportPath")
    mode: Literal["source", "target", "bilingual"]
