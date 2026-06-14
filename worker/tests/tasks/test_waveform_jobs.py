from pathlib import Path

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe
from diplomat_worker.media.waveform import WaveformData, build_waveform_peaks, read_waveform_cache
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.waveform import WaveformJobManager


def fixture_waveform(project_id: str, duration_ms: int = 1000) -> WaveformData:
    return WaveformData(
        project_id=project_id,
        duration_ms=duration_ms,
        sample_rate=8000,
        peaks=build_waveform_peaks([0.0, 0.5, -0.5, 0.25], duration_ms, 2, 8000),
    )


def make_runtime(
    tmp_path: Path,
    check: FfmpegCheck | None = None,
    generator=None,
) -> WorkerRuntime:
    return WorkerRuntime(
        store=ProjectStore(tmp_path / "diplomat.db"),
        transcriber=None,
        probe_video_fn=lambda source: VideoProbe(
            duration_ms=1000,
            has_audio=True,
            audio_codec="aac",
            video_codec="h264",
        ),
        ffmpeg_check_fn=lambda source, ffmpeg, ffprobe: check
        or FfmpegCheck(True, None, "FFmpeg preflight passed"),
        waveform_generator=generator
        or (lambda project_id, source_video, duration_ms, ffmpeg_path: fixture_waveform(project_id, duration_ms)),
    )


def create_project(runtime: WorkerRuntime, tmp_path: Path) -> str:
    source = tmp_path / "demo.mp4"
    source.write_bytes(b"fake video")
    return runtime.store.create_project(
        name="Demo",
        source_video_path=source,
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    ).project_id


def test_waveform_job_completes_and_writes_cache(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    manager = WaveformJobManager(runtime, auto_start=False)

    task = manager.create_waveform_job(project_id)
    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    project = runtime.store.get_project(project_id)
    cache_path = project.project_dir / "cache" / "waveform.json"
    cached = read_waveform_cache(cache_path)
    assert completed.type == "waveform"
    assert completed.status == "completed"
    assert completed.progress == 1
    assert completed.error_code is None
    assert cached.project_id == project_id
    assert len(cached.peaks) == 2


def test_cancel_queued_waveform_job(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    manager = WaveformJobManager(runtime, auto_start=False)

    task = manager.create_waveform_job(project_id)
    canceled = manager.cancel_task(task.task_id)
    manager.run_pending_once()

    assert canceled.status == "canceled"
    assert runtime.store.get_task(task.task_id).status == "canceled"


def test_waveform_job_fails_with_missing_ffmpeg(tmp_path: Path) -> None:
    runtime = make_runtime(
        tmp_path,
        check=FfmpegCheck(False, "FFMPEG_NOT_FOUND", "FFmpeg executable not found: ffmpeg"),
    )
    project_id = create_project(runtime, tmp_path)
    manager = WaveformJobManager(runtime, auto_start=False)

    task = manager.create_waveform_job(project_id)
    manager.run_pending_once()

    failed = runtime.store.get_task(task.task_id)
    assert failed.status == "failed"
    assert failed.error_code == "FFMPEG_NOT_FOUND"
    assert failed.error_message == "FFmpeg executable not found: ffmpeg"
    assert failed.diagnostic_log_path is not None
    assert Path(failed.diagnostic_log_path).exists()


def test_retry_canceled_waveform_job_creates_new_task(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    manager = WaveformJobManager(runtime, auto_start=False)

    task = manager.create_waveform_job(project_id)
    manager.cancel_task(task.task_id)
    retry = manager.retry_task(task.task_id)

    assert retry.task_id != task.task_id
    assert retry.type == "waveform"
    assert retry.status == "queued"
