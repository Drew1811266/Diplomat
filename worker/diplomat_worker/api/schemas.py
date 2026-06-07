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


class ProjectListResponse(CamelModel):
    projects: list[ProjectResponse]


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
