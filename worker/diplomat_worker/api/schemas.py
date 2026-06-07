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
