import shutil
from pathlib import Path

import pytest

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.models.registry import ModelRegistryEntry
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.translation import TranslationJobManager
from diplomat_worker.translation.base import TranslationRequest, TranslationResult
from diplomat_worker.translation.config import TranslationProviderConfig
from diplomat_worker.translation.resolver import TranslationConfigurationError


class RecordingTranslationProvider:
    def __init__(self, provider: str, model: str) -> None:
        self.provider = provider
        self.model = model
        self.requests: list[TranslationRequest] = []

    def translate(self, request: TranslationRequest, cancel_token=None) -> TranslationResult:
        self.requests.append(request)
        return TranslationResult(
            line_id=request.line_id,
            translated_text=f"[local {request.target_language}] {request.source_text}",
            provider=self.provider,
            model=self.model,
        )


class OutOfMemoryTranslationProvider:
    def translate(self, request: TranslationRequest, cancel_token=None) -> TranslationResult:
        raise RuntimeError("CUDA out of memory while allocating")


def make_entry(model_id: str = "translation.fixture.en-zh") -> ModelRegistryEntry:
    return ModelRegistryEntry(
        model_id=model_id,
        name="Fixture Translation",
        task="translation",
        tier="light",
        runtime="ct2-marian",
        provider="ct2-marian",
        version="test",
        languages=["en", "zh"],
        language_pairs=[("en", "zh")],
        model_size_bytes=12,
        download_size_bytes=12,
        disk_requirement_bytes=12,
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url="https://example.invalid/model.bin",
        checksum_algorithm="sha256",
        checksum="c" * 64,
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
    model_registry: list[ModelRegistryEntry] | None = None,
    translation_provider_factory=None,
) -> WorkerRuntime:
    kwargs = {}
    if translation_provider_factory is not None:
        kwargs["translation_provider_factory"] = translation_provider_factory
    return WorkerRuntime(
        store=ProjectStore(tmp_path / "diplomat.db"),
        transcriber=None,
        model_registry=model_registry,
        **kwargs,
    )


def create_project_with_document(runtime: WorkerRuntime, tmp_path: Path) -> str:
    project = runtime.store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=2000,
        source_language="en",
        target_language="zh",
    )
    document = SubtitleDocument(
        project_id=project.project_id,
        media_id="media-1",
        duration_ms=2000,
        speakers=[],
        styles=[],
        lines=[
            SubtitleLine(
                id="line-1",
                start_ms=0,
                end_ms=1000,
                speaker_id=None,
                source_language="en",
                target_language="zh",
                source_text="Hello world",
                translated_text="",
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
            )
        ],
    )
    runtime.store.save_subtitle_document(project.project_id, document)
    return project.project_id


def test_translation_job_updates_missing_translations(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="missing_only",
        provider_config=TranslationProviderConfig(provider="fake"),
    )
    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    document = runtime.store.load_subtitle_document(project_id)
    line = document.lines[0]

    assert completed.status == "completed"
    assert line.translated_text == "[zh] Hello world"
    assert line.translation_status == "translated"
    assert line.translation_origin is not None
    assert line.translation_origin.provider == "fake"


def test_translation_job_maps_runtime_out_of_memory_error(tmp_path: Path) -> None:
    runtime = make_runtime(
        tmp_path,
        translation_provider_factory=lambda config: OutOfMemoryTranslationProvider(),
    )
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="missing_only",
        provider_config=TranslationProviderConfig(provider="fake"),
    )
    manager.run_pending_once()

    failed = runtime.store.get_task(task.task_id)
    assert failed.status == "failed"
    assert failed.error_code == "RUNTIME_OUT_OF_MEMORY"
    assert failed.error_message is not None
    assert "lighter model" in failed.error_message


def test_missing_only_preserves_edited_translation(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    document = runtime.store.load_subtitle_document(project_id)
    runtime.store.save_subtitle_document(
        project_id,
        document.model_copy(
            update={
                "lines": [
                    document.lines[0].model_copy(
                        update={
                            "translated_text": "Manual translation",
                            "translation_status": "edited",
                        }
                    )
                ]
            }
        ),
    )
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="missing_only",
        provider_config=TranslationProviderConfig(provider="fake"),
    )
    manager.run_pending_once()

    line = runtime.store.load_subtitle_document(project_id).lines[0]
    assert runtime.store.get_task(task.task_id).status == "completed"
    assert line.translated_text == "Manual translation"
    assert line.translation_status == "edited"


def test_overwrite_all_replaces_existing_translation(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    document = runtime.store.load_subtitle_document(project_id)
    runtime.store.save_subtitle_document(
        project_id,
        document.model_copy(
            update={
                "lines": [
                    document.lines[0].model_copy(
                        update={"translated_text": "Old", "translation_status": "edited"}
                    )
                ]
            }
        ),
    )
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="overwrite_all",
        provider_config=TranslationProviderConfig(provider="fake"),
    )
    manager.run_pending_once()

    line = runtime.store.load_subtitle_document(project_id).lines[0]
    assert runtime.store.get_task(task.task_id).status == "completed"
    assert line.translated_text == "[zh] Hello world"
    assert line.translation_status == "translated"


def test_overwrite_all_snapshots_existing_stable_subtitle_before_translation(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="overwrite_all",
        provider_config=TranslationProviderConfig(provider="fake"),
    )
    snapshots = runtime.store.list_subtitle_snapshots(project_id)

    assert task.type == "translation"
    assert len(snapshots) == 1
    assert snapshots[0].reason == "translation_overwrite"
    assert snapshots[0].label == "Before translation overwrite"
    assert snapshots[0].document.lines[0].source_text == "Hello world"


def test_missing_only_translation_does_not_create_overwrite_snapshot(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)

    manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="missing_only",
        provider_config=TranslationProviderConfig(provider="fake"),
    )

    assert runtime.store.list_subtitle_snapshots(project_id) == []


def test_translation_job_completes_with_installed_curated_translation_model(tmp_path: Path) -> None:
    entry = make_entry()
    captured_configs: list[TranslationProviderConfig] = []

    def factory(config: TranslationProviderConfig) -> RecordingTranslationProvider:
        captured_configs.append(config)
        return RecordingTranslationProvider(
            provider=config.provider,
            model=config.model_id or "missing-model",
        )

    runtime = make_runtime(tmp_path, model_registry=[entry], translation_provider_factory=factory)
    installed_path = install_entry(runtime.store, entry)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="missing_only",
        provider_config=TranslationProviderConfig(
            provider="ct2-marian",
            model_id=entry.model_id,
            device="cpu",
            compute_type="int8",
        ),
    )
    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    line = runtime.store.load_subtitle_document(project_id).lines[0]
    assert completed.status == "completed"
    assert task.request_payload == {
        "sourceLanguage": "en",
        "targetLanguage": "zh",
        "mode": "missing_only",
        "provider": "ct2-marian",
        "modelId": entry.model_id,
        "device": "cpu",
        "computeType": "int8",
    }
    assert captured_configs[0].model_name_or_path == str(installed_path)
    assert captured_configs[0].model_id == entry.model_id
    assert line.translated_text == "[local zh] Hello world"
    assert line.translation_status == "translated"
    assert line.translation_origin is not None
    assert line.translation_origin.provider == "ct2-marian"
    assert line.translation_origin.model == entry.model_id


def test_translation_job_rejects_uninstalled_curated_translation_model(tmp_path: Path) -> None:
    entry = make_entry()
    runtime = make_runtime(tmp_path, model_registry=[entry])
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)

    with pytest.raises(TranslationConfigurationError) as exc_info:
        manager.create_translation_job(
            project_id,
            source_language="en",
            target_language="zh",
            mode="missing_only",
            provider_config=TranslationProviderConfig(
                provider="ct2-marian",
                model_id=entry.model_id,
            ),
        )

    assert exc_info.value.code == "TRANSLATION_MODEL_NOT_INSTALLED"


def test_translation_job_fails_if_installed_model_files_disappear_before_run(tmp_path: Path) -> None:
    entry = make_entry()
    runtime = make_runtime(tmp_path, model_registry=[entry])
    installed_path = install_entry(runtime.store, entry)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project_id,
        source_language="en",
        target_language="zh",
        mode="missing_only",
        provider_config=TranslationProviderConfig(
            provider="ct2-marian",
            model_id=entry.model_id,
        ),
    )
    shutil.rmtree(installed_path)
    manager.run_pending_once()

    failed = runtime.store.get_task(task.task_id)
    assert failed.status == "failed"
    assert failed.error_code == "TRANSLATION_MODEL_FILES_MISSING"
    assert failed.diagnostic_log_path is not None
    assert Path(failed.diagnostic_log_path).exists()


def test_retry_failed_translation_job_uses_replacement_config(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)
    task = runtime.store.create_task(
        project_id=project_id,
        task_type="translation",
        message="Failed",
        request_payload={
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "missing_only",
            "provider": "libretranslate",
        },
    )
    runtime.store.update_task(task.task_id, status="failed", completed=True)

    retry = manager.retry_task(
        task.task_id,
        provider_config=TranslationProviderConfig(provider="fake"),
    )

    assert retry.task_id != task.task_id
    assert retry.request_payload["provider"] == "fake"


def test_retry_failed_translation_job_preserves_local_model_config(tmp_path: Path) -> None:
    entry = make_entry()
    runtime = make_runtime(tmp_path, model_registry=[entry])
    install_entry(runtime.store, entry)
    project_id = create_project_with_document(runtime, tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)
    task = runtime.store.create_task(
        project_id=project_id,
        task_type="translation",
        message="Failed",
        request_payload={
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "overwrite_all",
            "provider": "ct2-marian",
            "modelId": entry.model_id,
            "device": "cuda",
            "computeType": "float16",
        },
    )
    runtime.store.update_task(task.task_id, status="failed", completed=True)

    retry = manager.retry_task(task.task_id)

    assert retry.task_id != task.task_id
    assert retry.request_payload == {
        "sourceLanguage": "en",
        "targetLanguage": "zh",
        "mode": "overwrite_all",
        "provider": "ct2-marian",
        "modelId": entry.model_id,
        "device": "cuda",
        "computeType": "float16",
    }
