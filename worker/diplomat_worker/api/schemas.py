from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from diplomat_worker.schemas.subtitle import (
    SubtitleDocument,
    SubtitleStyle,
    TranslationGlossaryEntry,
)


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


class ReleaseReadinessCheckResponse(CamelModel):
    id: str
    label: str
    severity: Literal["pass", "warning", "blocker"]
    message: str
    remediation: str | None = None


class ReleaseReadinessResponse(CamelModel):
    version: str
    generated_at: str = Field(alias="generatedAt")
    ready: bool
    summary: dict[str, int]
    checks: list[ReleaseReadinessCheckResponse]


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
    action: Literal["delete", "cleanup_cache", "cleanup_exports", "clear_draft", "import"]
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


class ModelInstallationResponse(CamelModel):
    model_id: str = Field(alias="modelId")
    status: Literal[
        "not_installed",
        "queued",
        "downloading",
        "verifying",
        "installed",
        "failed",
        "canceled",
    ]
    installed_path: str | None = Field(default=None, alias="installedPath")
    downloaded_bytes: int = Field(alias="downloadedBytes", ge=0)
    total_bytes: int = Field(alias="totalBytes", ge=0)
    checksum: str
    error_message: str | None = Field(default=None, alias="errorMessage")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    installed_at: str | None = Field(default=None, alias="installedAt")


class ModelAvailabilityResponse(CamelModel):
    usable: bool
    reason: str | None = None


class ModelRuntimeProfileResponse(CamelModel):
    profile_id: str = Field(alias="profileId")
    task: Literal["asr", "translation"]
    provider: str
    device: str
    compute_type: str = Field(alias="computeType")
    batch_size: int = Field(alias="batchSize", ge=1)
    recommended: bool
    available: bool
    reason: str | None = None
    notes: str


class ModelCatalogEntryResponse(CamelModel):
    model_id: str = Field(alias="modelId")
    name: str
    task: Literal["asr", "translation"]
    tier: Literal["light", "high_quality"]
    runtime: Literal["faster-whisper", "vibevoice-asr", "ct2-marian", "local-llm"]
    provider: str
    version: str
    languages: list[str]
    language_pairs: list[tuple[str, str]] = Field(alias="languagePairs")
    model_size_bytes: int = Field(alias="modelSizeBytes", ge=0)
    download_size_bytes: int = Field(alias="downloadSizeBytes", ge=0)
    disk_requirement_bytes: int = Field(alias="diskRequirementBytes", ge=0)
    recommended_hardware: str = Field(alias="recommendedHardware")
    license_name: str = Field(alias="licenseName")
    license_url: str = Field(alias="licenseUrl")
    source_url: str = Field(alias="sourceUrl")
    checksum_algorithm: Literal["sha256"] = Field(alias="checksumAlgorithm")
    checksum: str
    terms_summary: str = Field(alias="termsSummary")
    installation: ModelInstallationResponse
    availability: ModelAvailabilityResponse
    runtime_profiles: list[ModelRuntimeProfileResponse] = Field(alias="runtimeProfiles")


class ModelCatalogResponse(CamelModel):
    models: list[ModelCatalogEntryResponse]


class ModelDownloadResponse(CamelModel):
    model_id: str = Field(alias="modelId")
    status: Literal["queued", "downloading", "verifying", "installed", "failed", "canceled"]
    downloaded_bytes: int = Field(alias="downloadedBytes", ge=0)
    total_bytes: int = Field(alias="totalBytes", ge=0)
    message: str


class ModelDeleteResponse(CamelModel):
    model_id: str = Field(alias="modelId")
    files_deleted: int = Field(alias="filesDeleted", ge=0)
    bytes_deleted: int = Field(alias="bytesDeleted", ge=0)
    message: str


class AnalysisJobRequest(CamelModel):
    provider: Literal["fake", "faster-whisper"] = "fake"
    model_id: str | None = Field(default=None, alias="modelId")
    model_name_or_path: str | None = Field(default=None, alias="modelNameOrPath")
    device: str = "cpu"
    compute_type: str = Field(default="int8", alias="computeType")
    source_language: str | None = Field(default=None, alias="sourceLanguage", min_length=2, max_length=12)
    initial_prompt: str | None = Field(default=None, alias="initialPrompt")


class TranslationSettingsRequest(CamelModel):
    provider: Literal["fake", "libretranslate", "ct2-marian", "local-llm"] = "fake"
    model_id: str | None = Field(default=None, alias="modelId")
    model_name_or_path: str | None = Field(default=None, alias="modelNameOrPath")
    source_language: str = Field(alias="sourceLanguage", min_length=2, max_length=12)
    target_language: str = Field(alias="targetLanguage", min_length=2, max_length=12)
    mode: Literal["missing_only", "overwrite_all"] = "missing_only"
    device: str = "cpu"
    compute_type: str = Field(default="int8", alias="computeType")
    batch_size: int = Field(default=8, alias="batchSize", ge=1)
    endpoint: str | None = None
    api_key_env: str | None = Field(default=None, alias="apiKeyEnv")
    glossary: list[TranslationGlossaryEntry] = Field(default_factory=list)


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


SnapshotReason = Literal[
    "manual",
    "analysis_overwrite",
    "translation_overwrite",
    "batch_timing",
    "burn_in_export_preparation",
    "restore",
]


class SubtitleDraftResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    updated_at: str = Field(alias="updatedAt")
    line_count: int = Field(alias="lineCount", ge=0)
    document: SubtitleDocument


class SubtitleSnapshotCreateRequest(CamelModel):
    reason: SnapshotReason = "manual"
    label: str | None = None
    document: SubtitleDocument | None = None


class SubtitleSnapshotSummaryResponse(CamelModel):
    snapshot_id: str = Field(alias="snapshotId")
    project_id: str = Field(alias="projectId")
    reason: SnapshotReason
    label: str | None = None
    created_at: str = Field(alias="createdAt")
    line_count: int = Field(alias="lineCount", ge=0)


class SubtitleSnapshotResponse(SubtitleSnapshotSummaryResponse):
    document: SubtitleDocument


class SubtitleSnapshotListResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    snapshots: list[SubtitleSnapshotSummaryResponse]


class StylePresetResponse(CamelModel):
    id: str
    name: str
    style: SubtitleStyle
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class StylePresetListResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    active_preset_id: str | None = Field(default=None, alias="activePresetId")
    presets: list[StylePresetResponse]


class StylePresetCreateRequest(CamelModel):
    name: str = Field(min_length=1)
    style: SubtitleStyle


class StylePresetUpdateRequest(CamelModel):
    name: str | None = Field(default=None, min_length=1)
    style: SubtitleStyle | None = None


class StylePresetApplyResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    active_preset_id: str = Field(alias="activePresetId")
    style: SubtitleStyle


class WaveformPeakResponse(CamelModel):
    index: int = Field(ge=0)
    start_ms: int = Field(alias="startMs", ge=0)
    end_ms: int = Field(alias="endMs", ge=0)
    min: float = Field(ge=-1, le=1)
    max: float = Field(ge=-1, le=1)


class WaveformResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    duration_ms: int = Field(alias="durationMs", ge=0)
    sample_rate: int = Field(alias="sampleRate", gt=0)
    peak_count: int = Field(alias="peakCount", ge=0)
    peaks: list[WaveformPeakResponse]


ExportFormat = Literal["srt", "vtt", "ass"]
ExportMode = Literal["source", "target", "bilingual"]
ExportValidationCode = Literal[
    "negative_time",
    "end_before_start",
    "too_short",
    "overlap_previous",
    "overlap_next",
    "overlong_text",
]


class ExportValidationIssueResponse(CamelModel):
    line_id: str = Field(alias="lineId")
    code: ExportValidationCode
    severity: Literal["warning", "error"]
    message: str


class SubtitleExportRequest(CamelModel):
    format: ExportFormat = "srt"
    mode: ExportMode = "bilingual"
    style_preset_id: str | None = Field(default=None, alias="stylePresetId")
    style: SubtitleStyle | None = None


BurnInPreset = Literal["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow"]


class BurnInExportRequest(CamelModel):
    mode: ExportMode = "bilingual"
    style_preset_id: str | None = Field(default=None, alias="stylePresetId")
    style: SubtitleStyle | None = None
    output_path: Path | None = Field(default=None, alias="outputPath")
    video_codec: Literal["libx264"] = Field(default="libx264", alias="videoCodec")
    crf: int = Field(default=18, ge=0, le=51)
    preset: BurnInPreset = "medium"


class SubtitleExportResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    export_path: str = Field(alias="exportPath")
    format: ExportFormat
    mode: ExportMode
    warnings: list[ExportValidationIssueResponse] = Field(default_factory=list)


class SrtExportRequest(CamelModel):
    mode: ExportMode = "bilingual"


class SrtExportResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    export_path: str = Field(alias="exportPath")
    mode: ExportMode
