from pathlib import Path

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.translation import TranslationJobManager
from diplomat_worker.translation.config import TranslationProviderConfig


def make_runtime(tmp_path: Path) -> WorkerRuntime:
    return WorkerRuntime(store=ProjectStore(tmp_path / "diplomat.db"), transcriber=None)


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
