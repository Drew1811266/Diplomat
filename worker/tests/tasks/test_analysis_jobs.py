from pathlib import Path

import pytest

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.analysis import AnalysisJobManager


def make_runtime(tmp_path: Path, check: FfmpegCheck | None = None) -> WorkerRuntime:
    return WorkerRuntime(
        store=ProjectStore(tmp_path / "diplomat.db"),
        transcriber=FakeTranscriber(language="zh"),
        probe_video_fn=lambda source: VideoProbe(
            duration_ms=10_000,
            has_audio=True,
            audio_codec="aac",
            video_codec="h264",
        ),
        extract_audio_fn=lambda source, target: target.write_bytes(b"audio") or target,
        ffmpeg_check_fn=lambda source, ffmpeg, ffprobe: check
        or FfmpegCheck(True, None, "FFmpeg preflight passed"),
    )


def create_project(runtime: WorkerRuntime, tmp_path: Path) -> str:
    return runtime.store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=10_000,
        source_language="zh",
        target_language="en",
    ).project_id


def test_analysis_job_completes_with_fake_asr(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    assert completed.status == "completed"
    assert completed.progress == 1
    assert completed.error_code is None
    assert runtime.store.load_subtitle_document(project_id).lines


def test_cancel_queued_analysis_job(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    canceled = manager.cancel_task(task.task_id)

    assert canceled.status == "canceled"
    assert canceled.completed_at is not None


def test_analysis_job_fails_with_missing_ffmpeg(tmp_path: Path) -> None:
    runtime = make_runtime(
        tmp_path,
        check=FfmpegCheck(False, "FFMPEG_NOT_FOUND", "FFmpeg executable not found: ffmpeg"),
    )
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    failed = runtime.store.get_task(task.task_id)
    assert failed.status == "failed"
    assert failed.error_code == "FFMPEG_NOT_FOUND"
    assert failed.error_message == "FFmpeg executable not found: ffmpeg"
    assert failed.diagnostic_log_path is not None
    assert Path(failed.diagnostic_log_path).exists()


def test_retry_failed_analysis_job_creates_new_task(tmp_path: Path) -> None:
    runtime = make_runtime(
        tmp_path,
        check=FfmpegCheck(False, "FFMPEG_NOT_FOUND", "FFmpeg executable not found: ffmpeg"),
    )
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)
    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    retry = manager.retry_task(task.task_id)

    assert retry.task_id != task.task_id
    assert retry.project_id == project_id
    assert retry.status == "queued"
    assert retry.request_payload == {"provider": "fake"}


def test_retry_failed_analysis_job_can_replace_request_payload(tmp_path: Path) -> None:
    runtime = make_runtime(
        tmp_path,
        check=FfmpegCheck(False, "FFMPEG_NOT_FOUND", "FFmpeg executable not found: ffmpeg"),
    )
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)
    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    retry = manager.retry_task(
        task.task_id,
        AsrModelConfig(
            provider="faster-whisper",
            model_name_or_path="tiny",
            device="cpu",
            compute_type="int8",
            source_language="en",
        ),
    )

    assert retry.task_id != task.task_id
    assert retry.request_payload == {
        "provider": "faster-whisper",
        "modelNameOrPath": "tiny",
        "device": "cpu",
        "computeType": "int8",
        "sourceLanguage": "en",
    }


def test_retry_running_analysis_job_is_rejected(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    task = runtime.store.create_task(
        project_id=project_id,
        task_type="analysis",
        message="Running",
        request_payload={"provider": "fake"},
    )
    runtime.store.update_task(task.task_id, status="running", progress=0.2, started=True)
    manager = AnalysisJobManager(runtime, auto_start=False)

    with pytest.raises(ValueError, match="Only failed or canceled tasks can be retried"):
        manager.retry_task(task.task_id)
