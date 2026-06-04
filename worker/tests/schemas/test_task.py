import pytest
from pydantic import ValidationError

from diplomat_worker.schemas.task import TaskEvent


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
