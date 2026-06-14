from pathlib import Path

import pytest

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.export import BurnInExportJobManager
from worker.tests.export.test_text_subtitles import make_document


def make_runtime(
    tmp_path: Path,
    check: FfmpegCheck | None = None,
    runner=None,
) -> tuple[WorkerRuntime, str]:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "demo.mp4"
    source.write_bytes(b"video")
    project = store.create_project(
        name="Demo",
        source_video_path=source,
        duration_ms=10_000,
        source_language="zh",
        target_language="en",
    )
    store.save_subtitle_document(
        project.project_id,
        make_document().model_copy(update={"project_id": project.project_id}),
    )
    runtime = WorkerRuntime(
        store=store,
        transcriber=None,
        probe_video_fn=lambda source_video: VideoProbe(
            duration_ms=10_000,
            has_audio=True,
            audio_codec="aac",
            video_codec="h264",
        ),
        ffmpeg_check_fn=lambda source_video, ffmpeg, ffprobe: check
        or FfmpegCheck(True, None, "FFmpeg preflight passed"),
    )
    return runtime, project.project_id


def fake_runner(**kwargs) -> Path:
    kwargs["output_path"].parent.mkdir(parents=True, exist_ok=True)
    kwargs["output_path"].write_bytes(b"video")
    kwargs["progress_callback"](0.5, "Rendering video")
    return kwargs["output_path"]


def test_create_export_job_queues_export_task(tmp_path: Path) -> None:
    runtime, project_id = make_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False, runner=fake_runner)

    task = manager.create_export_job(project_id, {"mode": "bilingual"})

    assert task.type == "export"
    assert task.status == "queued"
    assert task.request_payload["mode"] == "bilingual"
    assert task.request_payload["videoCodec"] == "libx264"


def test_run_pending_export_task_completes_with_fake_runner(tmp_path: Path) -> None:
    runtime, project_id = make_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False, runner=fake_runner)

    task = manager.create_export_job(project_id, {"mode": "bilingual"})
    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    snapshots = runtime.store.list_subtitle_snapshots(project_id)
    project = runtime.store.get_project(project_id)
    assert completed.status == "completed"
    assert completed.progress == 1
    assert completed.error_code is None
    assert "Burn-in export completed" in completed.message
    assert (project.project_dir / "exports" / f"burn-in-bilingual-{task.task_id}.mp4").is_file()
    assert snapshots[0].reason == "burn_in_export_preparation"


def test_cancel_queued_export_task_marks_canceled(tmp_path: Path) -> None:
    runtime, project_id = make_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False, runner=fake_runner)
    task = manager.create_export_job(project_id, {"mode": "bilingual"})

    canceled = manager.cancel_task(task.task_id)
    manager.run_pending_once()

    assert canceled.status == "canceled"
    assert runtime.store.get_task(task.task_id).status == "canceled"


def test_retry_export_task_creates_fresh_task_from_payload(tmp_path: Path) -> None:
    runtime, project_id = make_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False, runner=fake_runner)
    task = manager.create_export_job(project_id, {"mode": "target"})
    manager.cancel_task(task.task_id)

    retry = manager.retry_task(task.task_id)

    assert retry.task_id != task.task_id
    assert retry.type == "export"
    assert retry.status == "queued"
    assert retry.request_payload["mode"] == "target"


def test_retry_running_export_task_is_rejected(tmp_path: Path) -> None:
    runtime, project_id = make_runtime(tmp_path)
    task = runtime.store.create_task(
        project_id=project_id,
        task_type="export",
        message="Running",
        request_payload={"mode": "bilingual"},
    )
    runtime.store.update_task(task.task_id, status="running", progress=0.2, started=True)
    manager = BurnInExportJobManager(runtime, auto_start=False, runner=fake_runner)

    with pytest.raises(ValueError, match="Only failed or canceled tasks can be retried"):
        manager.retry_task(task.task_id)


def test_export_job_fails_with_missing_ffmpeg(tmp_path: Path) -> None:
    runtime, project_id = make_runtime(
        tmp_path,
        check=FfmpegCheck(False, "FFMPEG_NOT_FOUND", "FFmpeg executable not found: ffmpeg"),
    )
    manager = BurnInExportJobManager(runtime, auto_start=False, runner=fake_runner)

    task = manager.create_export_job(project_id, {"mode": "bilingual"})
    manager.run_pending_once()

    failed = runtime.store.get_task(task.task_id)
    assert failed.status == "failed"
    assert failed.error_code == "FFMPEG_NOT_FOUND"
    assert failed.error_message == "FFmpeg executable not found: ffmpeg"
    assert failed.diagnostic_log_path is not None
    assert Path(failed.diagnostic_log_path).exists()


def test_export_job_rejects_unsafe_output_path(tmp_path: Path) -> None:
    runtime, project_id = make_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False, runner=fake_runner)

    task = manager.create_export_job(project_id, {"mode": "bilingual", "outputPath": str(tmp_path / "outside.mp4")})
    manager.run_pending_once()

    failed = runtime.store.get_task(task.task_id)
    assert failed.status == "failed"
    assert failed.error_code == "OUTPUT_PATH_UNSAFE"
