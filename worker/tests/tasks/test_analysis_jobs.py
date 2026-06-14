import shutil
from pathlib import Path

import pytest

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.asr.base import AsrResult, AsrSegment
from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.asr.resolver import AsrConfigurationError
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe
from diplomat_worker.models.registry import ModelRegistryEntry
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.analysis import AnalysisJobManager


class RecordingTranscriber:
    def __init__(self, model: str, language: str) -> None:
        self.model = model
        self.language = language

    def transcribe(self, audio_path, chunks, progress_callback=None, cancel_token=None) -> AsrResult:
        if progress_callback is not None:
            progress_callback(1.0, "Recorded ASR completed")
        return AsrResult(
            engine="faster-whisper",
            model=self.model,
            language=self.language,
            segments=[
                AsrSegment(
                    id="segment-1",
                    start_ms=0,
                    end_ms=1000,
                    text="Recorded transcript",
                    words=[],
                )
            ],
        )


def make_entry(model_id: str = "asr.fixture.small") -> ModelRegistryEntry:
    return ModelRegistryEntry(
        model_id=model_id,
        name="Fixture ASR",
        task="asr",
        tier="light",
        runtime="faster-whisper",
        provider="faster-whisper",
        version="test",
        languages=["zh", "en"],
        language_pairs=[],
        model_size_bytes=12,
        download_size_bytes=12,
        disk_requirement_bytes=12,
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url="https://example.invalid/model.bin",
        checksum_algorithm="sha256",
        checksum="b" * 64,
        terms_summary="Test fixture model.",
    )


def install_entry(store: ProjectStore, entry: ModelRegistryEntry) -> Path:
    installed_path = store.safe_model_dir(entry.model_id)
    installed_path.mkdir(parents=True, exist_ok=True)
    (installed_path / "model.bin").write_bytes(b"fixture")
    store.upsert_model_installation(
        model_id=entry.model_id,
        status="installed",
        installed_path=installed_path,
        downloaded_bytes=entry.download_size_bytes,
        total_bytes=entry.download_size_bytes,
        checksum=entry.checksum,
        installed=True,
    )
    return installed_path


def make_runtime(
    tmp_path: Path,
    check: FfmpegCheck | None = None,
    model_registry: list[ModelRegistryEntry] | None = None,
    transcriber_factory=None,
) -> WorkerRuntime:
    kwargs = {}
    if transcriber_factory is not None:
        kwargs["transcriber_factory"] = transcriber_factory
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
        model_registry=model_registry,
        **kwargs,
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


def test_analysis_job_snapshots_existing_stable_subtitle_before_overwrite(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)
    first_task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    second_task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    snapshots = runtime.store.list_subtitle_snapshots(project_id)

    assert first_task.task_id != second_task.task_id
    assert len(snapshots) == 1
    assert snapshots[0].reason == "analysis_overwrite"
    assert snapshots[0].label == "Before analysis overwrite"
    assert snapshots[0].document.lines


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
    entry = make_entry()
    captured_configs: list[AsrModelConfig] = []

    def factory(config: AsrModelConfig, fallback_language: str) -> RecordingTranscriber:
        captured_configs.append(config)
        return RecordingTranscriber(model=config.model_id or "missing-model", language=fallback_language)

    runtime = make_runtime(
        tmp_path,
        check=FfmpegCheck(False, "FFMPEG_NOT_FOUND", "FFmpeg executable not found: ffmpeg"),
        model_registry=[entry],
        transcriber_factory=factory,
    )
    install_entry(runtime.store, entry)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)
    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    retry = manager.retry_task(
        task.task_id,
        AsrModelConfig(
            provider="faster-whisper",
            model_id=entry.model_id,
            device="cpu",
            compute_type="int8",
            source_language="en",
        ),
    )

    assert retry.task_id != task.task_id
    assert retry.request_payload == {
        "provider": "faster-whisper",
        "modelId": entry.model_id,
        "device": "cpu",
        "computeType": "int8",
        "sourceLanguage": "en",
    }
    assert captured_configs == []


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


def test_analysis_job_completes_with_installed_curated_asr_model(tmp_path: Path) -> None:
    entry = make_entry()
    captured_configs: list[AsrModelConfig] = []

    def factory(config: AsrModelConfig, fallback_language: str) -> RecordingTranscriber:
        captured_configs.append(config)
        return RecordingTranscriber(
            model=config.model_id or "missing-model",
            language=config.source_language or fallback_language,
        )

    runtime = make_runtime(tmp_path, model_registry=[entry], transcriber_factory=factory)
    installed_path = install_entry(runtime.store, entry)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    task = manager.create_analysis_job(
        project_id,
        AsrModelConfig(provider="faster-whisper", model_id=entry.model_id),
    )
    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    document = runtime.store.load_subtitle_document(project_id)
    assert completed.status == "completed"
    assert task.request_payload == {
        "provider": "faster-whisper",
        "modelId": entry.model_id,
        "device": "cpu",
        "computeType": "int8",
    }
    assert captured_configs[0].model_name_or_path == str(installed_path)
    assert captured_configs[0].model_id == entry.model_id
    assert document.lines[0].source_text == "Recorded transcript"
    assert document.lines[0].ai_origin.model == entry.model_id


def test_analysis_job_rejects_uninstalled_curated_asr_model(tmp_path: Path) -> None:
    entry = make_entry()
    runtime = make_runtime(tmp_path, model_registry=[entry])
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    with pytest.raises(AsrConfigurationError) as exc_info:
        manager.create_analysis_job(
            project_id,
            AsrModelConfig(provider="faster-whisper", model_id=entry.model_id),
        )

    assert exc_info.value.code == "ASR_MODEL_NOT_INSTALLED"


def test_analysis_job_fails_if_installed_model_files_disappear_before_run(tmp_path: Path) -> None:
    entry = make_entry()
    runtime = make_runtime(tmp_path, model_registry=[entry])
    installed_path = install_entry(runtime.store, entry)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    task = manager.create_analysis_job(
        project_id,
        AsrModelConfig(provider="faster-whisper", model_id=entry.model_id),
    )
    shutil.rmtree(installed_path)
    manager.run_pending_once()

    failed = runtime.store.get_task(task.task_id)
    assert failed.status == "failed"
    assert failed.error_code == "ASR_MODEL_FILES_MISSING"
    assert failed.diagnostic_log_path is not None
    assert Path(failed.diagnostic_log_path).exists()
