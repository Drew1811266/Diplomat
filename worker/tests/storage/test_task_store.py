from pathlib import Path

from diplomat_worker.storage.project_store import ProjectStore


def create_project(store: ProjectStore, tmp_path: Path) -> str:
    return store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=10_000,
        source_language="zh",
        target_language="en",
    ).project_id


def test_task_store_creates_and_updates_analysis_task(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project_id = create_project(store, tmp_path)

    task = store.create_task(
        project_id=project_id,
        task_type="analysis",
        message="Queued analysis",
        request_payload={"provider": "fake"},
    )

    assert task.status == "queued"
    assert task.progress == 0
    assert task.request_payload == {"provider": "fake"}

    updated = store.update_task(
        task.task_id,
        status="running",
        progress=0.25,
        message="Extracting audio",
        started=True,
    )

    assert updated.status == "running"
    assert updated.started_at is not None
    assert store.get_task(task.task_id).progress == 0.25


def test_task_store_marks_completed_tasks(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project_id = create_project(store, tmp_path)
    task = store.create_task(
        project_id=project_id,
        task_type="analysis",
        message="Queued analysis",
        request_payload={"provider": "fake"},
    )

    completed = store.update_task(
        task.task_id,
        status="completed",
        progress=1,
        message="Analysis completed",
        completed=True,
    )

    assert completed.status == "completed"
    assert completed.completed_at is not None


def test_task_store_persists_failure_diagnostics(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project_id = create_project(store, tmp_path)
    task = store.create_task(
        project_id=project_id,
        task_type="analysis",
        message="Queued analysis",
        request_payload={"provider": "fake"},
    )

    failed = store.update_task(
        task.task_id,
        status="failed",
        progress=0.1,
        message="FFmpeg missing",
        completed=True,
        error_code="FFMPEG_NOT_FOUND",
        error_message="FFmpeg executable not found: ffmpeg",
        diagnostic_log_path=str(tmp_path / "task.log"),
    )

    assert failed.error_code == "FFMPEG_NOT_FOUND"
    assert failed.error_message == "FFmpeg executable not found: ffmpeg"
    assert failed.diagnostic_log_path == str(tmp_path / "task.log")


def test_task_table_is_created_for_existing_m2b_database(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
    store = ProjectStore(database_path)
    project_id = create_project(store, tmp_path)

    reopened = ProjectStore(database_path)
    task = reopened.create_task(
        project_id=project_id,
        task_type="analysis",
        message="Queued analysis",
        request_payload={"provider": "fake"},
    )

    assert reopened.get_task(task.task_id).project_id == project_id
