import pytest
from pydantic import ValidationError

from diplomat_worker.schemas.task import TaskEvent, TaskListResponse, TaskResponse


def make_task_event() -> TaskEvent:
    return TaskEvent(
        task_id="task-1",
        type="transcribe_chunks",
        status="running",
        progress=0.5,
        message="Working",
        error_code=None,
        diagnostic_log_path=None,
    )


def test_task_event_serializes_with_camel_case_aliases() -> None:
    payload = make_task_event().model_dump(by_alias=True)

    assert payload["taskId"] == "task-1"
    assert payload["errorCode"] is None
    assert payload["diagnosticLogPath"] is None


def test_task_event_rejects_progress_greater_than_one() -> None:
    with pytest.raises(ValidationError):
        TaskEvent(
            task_id="task-1",
            type="transcribe_chunks",
            status="running",
            progress=1.1,
            message="Working",
            error_code=None,
            diagnostic_log_path=None,
        )


def test_task_event_rejects_empty_task_id() -> None:
    with pytest.raises(ValidationError):
        TaskEvent(
            task_id="",
            type="transcribe_chunks",
            status="running",
            progress=0.5,
            message="Working",
            error_code=None,
            diagnostic_log_path=None,
        )


def test_task_response_serializes_m3_fields() -> None:
    task = TaskResponse(
        task_id="task-1",
        project_id="project-1",
        type="analysis",
        status="running",
        progress=0.4,
        message="Transcribing audio",
        started_at="2026-06-07T00:00:00+00:00",
        updated_at="2026-06-07T00:00:01+00:00",
        completed_at=None,
        error_code=None,
        error_message=None,
        diagnostic_log_path="D:/logs/task-1.log",
    )

    payload = task.model_dump(by_alias=True)

    assert payload["taskId"] == "task-1"
    assert payload["projectId"] == "project-1"
    assert payload["diagnosticLogPath"] == "D:/logs/task-1.log"
    assert payload["errorMessage"] is None


def test_task_list_response_serializes_task_queue() -> None:
    queue = TaskListResponse(
        tasks=[
            TaskResponse(
                task_id="task-1",
                project_id="project-1",
                type="analysis",
                status="running",
                progress=0.4,
                message="Transcribing audio",
                started_at="2026-06-07T00:00:00+00:00",
                updated_at="2026-06-07T00:00:01+00:00",
                completed_at=None,
                error_code=None,
                error_message=None,
                diagnostic_log_path=None,
            )
        ]
    )

    payload = queue.model_dump(by_alias=True)

    assert payload["tasks"][0]["taskId"] == "task-1"
