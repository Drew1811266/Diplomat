from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TaskStatus = Literal["queued", "running", "canceling", "canceled", "failed", "completed"]
TaskType = Literal["analysis", "translation", "waveform", "export"]

TaskEventStatus = Literal["queued", "running", "paused", "failed", "completed", "canceled"]
TaskEventType = Literal[
    "preflight",
    "extract_audio",
    "chunk_audio",
    "transcribe_chunks",
    "diarize",
    "translate",
    "build_subtitle_draft",
    "export",
]


class TaskEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId", min_length=1)
    type: TaskEventType
    status: TaskEventStatus
    progress: float = Field(ge=0, le=1)
    message: str
    error_code: str | None = Field(default=None, alias="errorCode")
    diagnostic_log_path: str | None = Field(default=None, alias="diagnosticLogPath")


class TaskResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId", min_length=1)
    project_id: str = Field(alias="projectId", min_length=1)
    type: TaskType
    status: TaskStatus
    progress: float = Field(ge=0, le=1)
    message: str
    started_at: str | None = Field(default=None, alias="startedAt")
    updated_at: str = Field(alias="updatedAt")
    completed_at: str | None = Field(default=None, alias="completedAt")
    error_code: str | None = Field(default=None, alias="errorCode")
    error_message: str | None = Field(default=None, alias="errorMessage")
    diagnostic_log_path: str | None = Field(default=None, alias="diagnosticLogPath")
