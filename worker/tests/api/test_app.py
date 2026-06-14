import importlib
import hashlib
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from diplomat_worker.api.runtime import default_data_dir
from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.api.schemas import (
    AnalysisJobRequest,
    CreateProjectRequest,
    ProjectResponse,
    ProjectDiagnosticsResponse,
    SrtExportRequest,
    TranslationSettingsRequest,
)
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe
from diplomat_worker.models.manager import ModelDownloadManager
from diplomat_worker.models.registry import ModelRegistryEntry
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.analysis import AnalysisJobManager
from diplomat_worker.tasks.translation import TranslationJobManager


def make_test_runtime(
    tmp_path: Path,
    model_registry: list[ModelRegistryEntry] | None = None,
) -> WorkerRuntime:
    return WorkerRuntime(
        store=ProjectStore(tmp_path / "diplomat.db"),
        transcriber=FakeTranscriber(language="zh"),
        probe_video_fn=lambda source: VideoProbe(
            duration_ms=65_000,
            has_audio=True,
            audio_codec="aac",
            video_codec="h264",
        ),
        extract_audio_fn=lambda source, target: target.write_bytes(b"fake-audio") or target,
        model_registry=model_registry,
    )


@pytest.fixture()
def app_module(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("DIPLOMAT_DATA_DIR", str(tmp_path / "data"))
    module = importlib.import_module("diplomat_worker.api.app")

    return importlib.reload(module)


def test_module_app_and_create_app_do_not_create_default_runtime(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("DIPLOMAT_DATA_DIR", str(tmp_path / "data"))
    import diplomat_worker.api.runtime as runtime_module

    calls = []

    def fake_create_default_runtime() -> WorkerRuntime:
        calls.append("created")
        return make_test_runtime(tmp_path)

    monkeypatch.setattr(runtime_module, "create_default_runtime", fake_create_default_runtime)
    module = importlib.import_module("diplomat_worker.api.app")

    module = importlib.reload(module)
    module.create_app()

    assert calls == []


def test_default_runtime_is_created_lazily_for_project_endpoint(app_module, monkeypatch, tmp_path: Path) -> None:
    calls = []

    def fake_create_default_runtime() -> WorkerRuntime:
        calls.append("created")
        return make_test_runtime(tmp_path)

    monkeypatch.setattr(app_module, "create_default_runtime", fake_create_default_runtime)
    client = TestClient(app_module.create_app())

    health_response = client.get("/health")

    assert health_response.status_code == 200
    assert calls == []

    project_response = client.get("/projects/missing-project")

    assert project_response.status_code == 404
    assert project_response.json()["detail"] == "Project not found"
    assert calls == ["created"]


def test_health_endpoint_returns_worker_status(app_module) -> None:
    client = TestClient(app_module.create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"name": "diplomat-worker", "status": "ok", "version": "0.2.0"}


def test_cors_allows_configured_local_web_origin(app_module, monkeypatch) -> None:
    monkeypatch.setenv("DIPLOMAT_CORS_ORIGINS", "http://127.0.0.1:1421")
    client = TestClient(app_module.create_app())

    response = client.options(
        "/health",
        headers={
            "Origin": "http://127.0.0.1:1421",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:1421"


def test_app_exposes_worker_project_routes(app_module, monkeypatch) -> None:
    calls = []
    monkeypatch.setattr(
        app_module,
        "create_default_runtime",
        lambda: calls.append("created"),
    )
    app = app_module.create_app()
    routes = {
        (method, route.path)
        for route in app.routes
        if isinstance(getattr(route, "path", None), str)
        for method in getattr(route, "methods", set())
    }

    assert routes == {
        ("GET", "/health"),
        ("GET", "/models"),
        ("GET", "/models/{model_id}"),
        ("POST", "/models/{model_id}/download"),
        ("POST", "/models/{model_id}/cancel"),
        ("POST", "/models/{model_id}/retry"),
        ("DELETE", "/models/{model_id}"),
        ("GET", "/projects"),
        ("POST", "/projects"),
        ("POST", "/projects/import"),
        ("GET", "/projects/{project_id}"),
        ("DELETE", "/projects/{project_id}"),
        ("POST", "/projects/{project_id}/analyze"),
        ("POST", "/projects/{project_id}/analysis-jobs"),
        ("POST", "/projects/{project_id}/backup"),
        ("POST", "/projects/{project_id}/cleanup/cache"),
        ("POST", "/projects/{project_id}/cleanup/exports"),
        ("GET", "/projects/{project_id}/translation-settings"),
        ("PUT", "/projects/{project_id}/translation-settings"),
        ("POST", "/projects/{project_id}/translation-jobs"),
        ("POST", "/projects/{project_id}/exports/srt"),
        ("GET", "/projects/{project_id}/subtitle"),
        ("PUT", "/projects/{project_id}/subtitle"),
        ("GET", "/tasks/{task_id}"),
        ("POST", "/tasks/{task_id}/cancel"),
        ("POST", "/tasks/{task_id}/retry"),
    }
    assert calls == []


def make_model_entry(tmp_path: Path, content: bytes = b"api model") -> ModelRegistryEntry:
    source_path = tmp_path / "api-model.bin"
    source_path.write_bytes(content)
    checksum = hashlib.sha256(content).hexdigest()
    return ModelRegistryEntry(
        model_id="api-asr-light",
        name="API ASR Light",
        task="asr",
        tier="light",
        runtime="faster-whisper",
        provider="faster-whisper",
        version="test",
        languages=["zh", "en"],
        language_pairs=[],
        model_size_bytes=len(content),
        download_size_bytes=len(content),
        disk_requirement_bytes=len(content),
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url=str(source_path),
        checksum_algorithm="sha256",
        checksum=checksum,
        terms_summary="API fixture model.",
    )


def test_model_catalog_download_and_delete_routes(app_module, tmp_path: Path) -> None:
    entry = make_model_entry(tmp_path)
    runtime = make_test_runtime(tmp_path, model_registry=[entry])
    model_manager = ModelDownloadManager(runtime.store, registry=[entry], auto_start=False)
    client = TestClient(app_module.create_app(runtime, model_downloads=model_manager))

    list_response = client.get("/models")
    download_response = client.post("/models/api-asr-light/download")
    model_manager.run_pending_once()
    installed_response = client.get("/models/api-asr-light")
    delete_response = client.delete("/models/api-asr-light")

    assert list_response.status_code == 200
    listed = list_response.json()["models"][0]
    assert listed["modelId"] == "api-asr-light"
    assert listed["installation"]["status"] == "not_installed"
    assert listed["availability"]["usable"] is False
    assert download_response.status_code == 202
    assert download_response.json()["status"] == "queued"
    installed = installed_response.json()
    assert installed["installation"]["status"] == "installed"
    assert installed["availability"]["usable"] is True
    assert delete_response.status_code == 200
    assert delete_response.json()["filesDeleted"] == 1


def test_model_cancel_retry_and_unknown_routes(app_module, tmp_path: Path) -> None:
    entry = make_model_entry(tmp_path)
    runtime = make_test_runtime(tmp_path, model_registry=[entry])
    model_manager = ModelDownloadManager(runtime.store, registry=[entry], auto_start=False)
    client = TestClient(app_module.create_app(runtime, model_downloads=model_manager))

    client.post("/models/api-asr-light/download")
    cancel_response = client.post("/models/api-asr-light/cancel")
    retry_response = client.post("/models/api-asr-light/retry")
    missing_response = client.get("/models/missing-model")

    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "canceled"
    assert retry_response.status_code == 202
    assert retry_response.json()["status"] == "queued"
    assert missing_response.status_code == 404
    assert missing_response.json()["detail"] == "Model not found"


def test_project_list_includes_diagnostics(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    )

    response = client.get("/projects")

    assert response.status_code == 200
    diagnostics = response.json()["projects"][0]["diagnostics"]
    assert diagnostics["status"] == "not_transcribed"
    assert diagnostics["sourceVideoExists"] is True
    assert diagnostics["cacheDir"].endswith("cache")


def test_project_cleanup_backup_import_and_delete_routes(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]
    project = runtime.store.get_project(project_id)
    cache_file = project.project_dir / "cache" / "waveform.bin"
    export_file = project.project_dir / "exports" / "subtitle.srt"
    cache_file.parent.mkdir()
    export_file.parent.mkdir()
    cache_file.write_bytes(b"cache")
    export_file.write_text("subtitle", encoding="utf-8")

    cache_response = client.post(f"/projects/{project_id}/cleanup/cache")
    exports_response = client.post(f"/projects/{project_id}/cleanup/exports")
    backup_response = client.post(f"/projects/{project_id}/backup")
    import_response = client.post(
        "/projects/import",
        json={
            "packagePath": backup_response.json()["packagePath"],
            "restoreName": "Restored Episode",
        },
    )
    delete_response = client.delete(f"/projects/{import_response.json()['projectId']}?deleteFiles=true")

    assert cache_response.status_code == 200
    assert cache_response.json()["action"] == "cleanup_cache"
    assert exports_response.status_code == 200
    assert exports_response.json()["action"] == "cleanup_exports"
    assert backup_response.status_code == 200
    assert backup_response.json()["packagePath"].endswith(".diplomat-project.zip")
    assert import_response.status_code == 201
    assert import_response.json()["name"] == "Restored Episode"
    assert delete_response.status_code == 200
    assert delete_response.json()["action"] == "delete"


def test_project_maintenance_routes_return_not_found(app_module, tmp_path: Path) -> None:
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))

    response = client.post("/projects/missing-project/cleanup/cache")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def create_project_with_saved_subtitle(client: TestClient, tmp_path: Path) -> str:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "en",
            "targetLanguage": "zh",
        },
    ).json()["projectId"]
    document = {
        "schemaVersion": "diplomat.subtitle.v1",
        "projectId": project_id,
        "mediaId": "media-1",
        "durationMs": 1000,
        "speakers": [],
        "styles": [],
        "lines": [
            {
                "id": "line-1",
                "startMs": 0,
                "endMs": 1000,
                "speakerId": None,
                "sourceLanguage": "en",
                "targetLanguage": "zh",
                "sourceText": "Hello world",
                "translatedText": "",
                "words": [],
                "styleOverrides": {},
                "reviewStatus": "draft",
                "aiOrigin": {"engine": "fake-asr", "model": "fake-v1"},
                "translationStatus": "not_requested",
                "translationOrigin": None,
                "translationError": None,
                "notes": "",
            }
        ],
    }
    response = client.put(f"/projects/{project_id}/subtitle", json={"document": document})
    assert response.status_code == 200
    return project_id


def test_project_list_endpoint_returns_recent_projects(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    first = client.post(
        "/projects",
        json={
            "name": "First",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()
    second = client.post(
        "/projects",
        json={
            "name": "Second",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "en",
            "targetLanguage": "zh",
        },
    ).json()

    response = client.get("/projects")

    assert response.status_code == 200
    payload = response.json()
    assert [item["projectId"] for item in payload["projects"]] == [
        second["projectId"],
        first["projectId"],
    ]
    assert payload["projects"][0]["createdAt"]
    assert payload["projects"][0]["updatedAt"]
    assert payload["projects"][0]["hasSubtitleDocument"] is False


def test_get_project_response_includes_m2b_metadata(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]

    response = client.get(f"/projects/{project_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["createdAt"]
    assert payload["updatedAt"]
    assert payload["hasSubtitleDocument"] is False


def test_project_updated_at_changes_after_save_and_export(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]
    original = client.get(f"/projects/{project_id}").json()["updatedAt"]

    time.sleep(0.001)
    document = client.post(f"/projects/{project_id}/analyze").json()["document"]

    after_analyze_response = client.get(f"/projects/{project_id}")
    after_analyze = after_analyze_response.json()["updatedAt"]
    assert after_analyze > original
    assert after_analyze_response.json()["hasSubtitleDocument"] is True

    document["lines"][0]["sourceText"] = "Edited before export"
    client.put(f"/projects/{project_id}/subtitle", json={"document": document})

    time.sleep(0.001)
    client.post(f"/projects/{project_id}/exports/srt", json={"mode": "source"})
    after_export = client.get(f"/projects/{project_id}").json()["updatedAt"]
    assert after_export > after_analyze


def test_project_analyze_and_subtitle_round_trip(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))

    create_response = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    )

    assert create_response.status_code == 201
    created_project = create_response.json()
    assert created_project["durationMs"] == 65_000

    project_id = created_project["projectId"]
    get_response = client.get(f"/projects/{project_id}")

    assert get_response.status_code == 200
    assert get_response.json()["projectId"] == project_id

    analyze_response = client.post(f"/projects/{project_id}/analyze")

    assert analyze_response.status_code == 200
    analyzed = analyze_response.json()
    assert analyzed["status"] == "completed"
    assert analyzed["lineCount"] == 3

    subtitle_response = client.get(f"/projects/{project_id}/subtitle")

    assert subtitle_response.status_code == 200
    document = subtitle_response.json()
    document["lines"][0]["sourceText"] = "Edited text"
    document["lines"][0]["translatedText"] = "Translated text"

    put_response = client.put(f"/projects/{project_id}/subtitle", json={"document": document})

    assert put_response.status_code == 200

    reloaded_response = client.get(f"/projects/{project_id}/subtitle")

    assert reloaded_response.status_code == 200
    assert reloaded_response.json()["lines"][0]["sourceText"] == "Edited text"

    export_response = client.post(f"/projects/{project_id}/exports/srt", json={"mode": "bilingual"})

    assert export_response.status_code == 200
    export = export_response.json()
    assert export["projectId"] == project_id
    assert export["mode"] == "bilingual"
    assert export["exportPath"].endswith("subtitle-bilingual.srt")
    export_path = Path(export["exportPath"])
    assert export_path.exists()
    exported_srt = export_path.read_text(encoding="utf-8")
    assert "1\n00:00:00,000 --> 00:00:30,000\nEdited text\nTranslated text" in exported_srt


def test_create_analysis_job_returns_accepted_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, analysis_jobs=manager))
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]

    response = client.post(
        f"/projects/{project_id}/analysis-jobs",
        json={"provider": "fake", "sourceLanguage": "zh"},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["projectId"] == project_id
    assert payload["type"] == "analysis"
    assert payload["status"] == "queued"
    assert payload["progress"] == 0

    task_response = client.get(f"/tasks/{payload['taskId']}")
    assert task_response.status_code == 200
    assert task_response.json()["taskId"] == payload["taskId"]


def test_cancel_analysis_job_returns_canceled_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, analysis_jobs=manager))
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]
    task_id = client.post(f"/projects/{project_id}/analysis-jobs", json={"provider": "fake"}).json()["taskId"]

    response = client.post(f"/tasks/{task_id}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "canceled"


def test_retry_failed_analysis_job_returns_new_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    runtime = WorkerRuntime(
        store=runtime.store,
        transcriber=runtime.transcriber,
        probe_video_fn=runtime.probe_video_fn,
        extract_audio_fn=runtime.extract_audio_fn,
        ffmpeg_check_fn=lambda source, ffmpeg, ffprobe: FfmpegCheck(
            False,
            "FFMPEG_NOT_FOUND",
            "FFmpeg executable not found: ffmpeg",
        ),
    )
    manager = AnalysisJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, analysis_jobs=manager))
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]
    task_id = client.post(f"/projects/{project_id}/analysis-jobs", json={"provider": "fake"}).json()["taskId"]
    manager.run_pending_once()

    failed = client.get(f"/tasks/{task_id}").json()
    retry_response = client.post(f"/tasks/{task_id}/retry")

    assert failed["status"] == "failed"
    assert retry_response.status_code == 202
    assert retry_response.json()["taskId"] != task_id
    assert retry_response.json()["status"] == "queued"


def test_retry_failed_analysis_job_accepts_replacement_config(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    runtime = WorkerRuntime(
        store=runtime.store,
        transcriber=runtime.transcriber,
        probe_video_fn=runtime.probe_video_fn,
        extract_audio_fn=runtime.extract_audio_fn,
        ffmpeg_check_fn=lambda source, ffmpeg, ffprobe: FfmpegCheck(
            False,
            "FFMPEG_NOT_FOUND",
            "FFmpeg executable not found: ffmpeg",
        ),
    )
    manager = AnalysisJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, analysis_jobs=manager))
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]
    task_id = client.post(f"/projects/{project_id}/analysis-jobs", json={"provider": "fake"}).json()["taskId"]
    manager.run_pending_once()

    retry_response = client.post(
        f"/tasks/{task_id}/retry",
        json={
            "provider": "faster-whisper",
            "modelNameOrPath": "tiny",
            "device": "cpu",
            "computeType": "int8",
            "sourceLanguage": "en",
        },
    )
    retry_task_id = retry_response.json()["taskId"]

    assert retry_response.status_code == 202
    assert runtime.store.get_task(retry_task_id).request_payload == {
        "provider": "faster-whisper",
        "modelNameOrPath": "tiny",
        "device": "cpu",
        "computeType": "int8",
        "sourceLanguage": "en",
    }


def test_translation_settings_round_trip(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    default_response = client.get(f"/projects/{project_id}/translation-settings")
    save_response = client.put(
        f"/projects/{project_id}/translation-settings",
        json={
            "provider": "fake",
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "overwrite_all",
            "endpoint": None,
            "apiKeyEnv": None,
        },
    )

    assert default_response.status_code == 200
    assert default_response.json()["projectId"] == project_id
    assert default_response.json()["mode"] == "missing_only"
    assert save_response.status_code == 200
    assert save_response.json()["mode"] == "overwrite_all"


def test_create_translation_job_returns_accepted_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, translation_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.post(
        f"/projects/{project_id}/translation-jobs",
        json={
            "provider": "fake",
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "missing_only",
        },
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["projectId"] == project_id
    assert payload["type"] == "translation"
    assert payload["status"] == "queued"
    assert payload["progress"] == 0


def test_cancel_translation_job_routes_to_translation_manager(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, translation_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    task_id = client.post(
        f"/projects/{project_id}/translation-jobs",
        json={"provider": "fake", "sourceLanguage": "en", "targetLanguage": "zh"},
    ).json()["taskId"]

    response = client.post(f"/tasks/{task_id}/cancel")

    assert response.status_code == 200
    assert response.json()["type"] == "translation"
    assert response.json()["status"] == "canceled"


def test_retry_translation_job_accepts_replacement_config(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = TranslationJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, translation_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    task_id = client.post(
        f"/projects/{project_id}/translation-jobs",
        json={
            "provider": "libretranslate",
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "missing_only",
            "endpoint": "http://translate.local",
        },
    ).json()["taskId"]
    client.post(f"/tasks/{task_id}/cancel")

    retry_response = client.post(
        f"/tasks/{task_id}/retry",
        json={
            "provider": "fake",
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "overwrite_all",
        },
    )
    retry_task_id = retry_response.json()["taskId"]

    assert retry_response.status_code == 202
    assert retry_response.json()["type"] == "translation"
    assert runtime.store.get_task(retry_task_id).request_payload == {
        "provider": "fake",
        "sourceLanguage": "en",
        "targetLanguage": "zh",
        "mode": "overwrite_all",
    }


def test_create_project_rejects_video_without_audio(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    runtime = make_test_runtime(tmp_path)
    runtime = WorkerRuntime(
        store=runtime.store,
        transcriber=runtime.transcriber,
        probe_video_fn=lambda source: VideoProbe(
            duration_ms=65_000,
            has_audio=False,
            audio_codec=None,
            video_codec="h264",
        ),
        extract_audio_fn=runtime.extract_audio_fn,
    )
    client = TestClient(app_module.create_app(runtime))

    response = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Source video does not contain an audio stream"


def test_get_missing_project_returns_404(app_module, tmp_path: Path) -> None:
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))

    response = client.get("/projects/missing-project")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_get_subtitle_before_analyze_returns_404(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]

    response = client.get(f"/projects/{project_id}/subtitle")

    assert response.status_code == 404
    assert response.json()["detail"] == "Subtitle document not found"


def test_export_srt_for_missing_project_returns_404(app_module, tmp_path: Path) -> None:
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))

    response = client.post("/projects/missing-project/exports/srt", json={"mode": "bilingual"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_export_srt_before_subtitle_document_returns_404(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]

    response = client.post(f"/projects/{project_id}/exports/srt", json={"mode": "bilingual"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Subtitle document not found"


def test_export_srt_rejects_invalid_mode(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]

    response = client.post(f"/projects/{project_id}/exports/srt", json={"mode": "invalid"})

    assert response.status_code == 422


def test_put_subtitle_with_mismatched_project_id_returns_400(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = client.post(
        "/projects",
        json={
            "name": "Episode 1",
            "sourceVideoPath": str(source_video),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    ).json()["projectId"]
    document = client.post(f"/projects/{project_id}/analyze").json()["document"]
    document["projectId"] = "different-project"

    response = client.put(f"/projects/{project_id}/subtitle", json={"document": document})

    assert response.status_code == 400
    assert response.json()["detail"] == "document.project_id must match project_id"


def test_m2a_api_schemas_validate_project_payload(tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"

    request = CreateProjectRequest(
        name="Episode 1",
        sourceVideoPath=source_video,
        sourceLanguage="zh",
        targetLanguage="en",
    )

    assert request.source_video_path == source_video
    assert request.source_language == "zh"
    assert request.target_language == "en"


def test_project_response_populates_by_field_name_and_dumps_by_alias(tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    project_dir = tmp_path / "project"

    response = ProjectResponse(
        project_id="project-1",
        name="Episode 1",
        source_video_path=str(source_video),
        project_dir=str(project_dir),
        duration_ms=1234,
        source_language="zh",
        target_language="en",
        created_at="2026-06-07T00:00:00+00:00",
        updated_at="2026-06-07T00:01:00+00:00",
        has_subtitle_document=True,
        diagnostics=ProjectDiagnosticsResponse(
            status="not_transcribed",
            warnings=[],
            source_video_exists=True,
            project_dir_exists=True,
            disk_usage_bytes=0,
            cache_usage_bytes=0,
            export_usage_bytes=0,
            export_count=0,
            subtitle_line_count=0,
            translated_line_count=0,
            active_task_count=0,
            failed_task_count=0,
            latest_task_status=None,
            exports_dir=str(project_dir / "exports"),
            cache_dir=str(project_dir / "cache"),
            logs_dir=str(project_dir / "logs"),
            backups_dir=str(project_dir / "backups"),
        ),
    )

    assert response.project_id == "project-1"
    assert response.project_dir == str(project_dir)
    assert response.duration_ms == 1234
    assert response.model_dump(by_alias=True) == {
        "projectId": "project-1",
        "name": "Episode 1",
        "sourceVideoPath": str(source_video),
        "projectDir": str(project_dir),
        "durationMs": 1234,
        "sourceLanguage": "zh",
        "targetLanguage": "en",
        "createdAt": "2026-06-07T00:00:00+00:00",
        "updatedAt": "2026-06-07T00:01:00+00:00",
        "hasSubtitleDocument": True,
        "diagnostics": {
            "status": "not_transcribed",
            "warnings": [],
            "sourceVideoExists": True,
            "projectDirExists": True,
            "diskUsageBytes": 0,
            "cacheUsageBytes": 0,
            "exportUsageBytes": 0,
            "exportCount": 0,
            "subtitleLineCount": 0,
            "translatedLineCount": 0,
            "activeTaskCount": 0,
            "failedTaskCount": 0,
            "latestTaskStatus": None,
            "exportsDir": str(project_dir / "exports"),
            "cacheDir": str(project_dir / "cache"),
            "logsDir": str(project_dir / "logs"),
            "backupsDir": str(project_dir / "backups"),
        },
    }


def test_create_project_request_allows_null_target_language_and_rejects_short_value(tmp_path: Path) -> None:
    request = CreateProjectRequest(
        name="Episode 1",
        sourceVideoPath=tmp_path / "source.mp4",
        sourceLanguage="zh",
        targetLanguage=None,
    )

    assert request.target_language is None
    with pytest.raises(ValidationError):
        CreateProjectRequest(
            name="Episode 1",
            sourceVideoPath=tmp_path / "source.mp4",
            sourceLanguage="zh",
            targetLanguage="e",
        )


def test_srt_export_request_defaults_to_bilingual_and_rejects_unsupported_mode() -> None:
    assert SrtExportRequest().mode == "bilingual"

    with pytest.raises(ValidationError):
        SrtExportRequest(mode="invalid")


def test_analysis_job_request_defaults_to_fake_provider() -> None:
    request = AnalysisJobRequest()

    assert request.provider == "fake"
    assert request.model_name_or_path is None
    assert request.device == "cpu"
    assert request.compute_type == "int8"

    configured = AnalysisJobRequest(
        provider="faster-whisper",
        modelNameOrPath="small",
        sourceLanguage="zh",
        initialPrompt="Domain words",
    )

    assert configured.model_name_or_path == "small"
    assert configured.source_language == "zh"


def test_translation_settings_request_defaults_to_fake_missing_only() -> None:
    request = TranslationSettingsRequest(sourceLanguage="en", targetLanguage="zh")

    assert request.provider == "fake"
    assert request.source_language == "en"
    assert request.target_language == "zh"
    assert request.mode == "missing_only"
    assert request.endpoint is None
    assert request.api_key_env is None

    configured = TranslationSettingsRequest(
        provider="libretranslate",
        sourceLanguage="zh",
        targetLanguage="en",
        mode="overwrite_all",
        endpoint="http://translate.local",
        apiKeyEnv="LIBRETRANSLATE_API_KEY",
    )

    assert configured.provider == "libretranslate"
    assert configured.mode == "overwrite_all"
    assert configured.api_key_env == "LIBRETRANSLATE_API_KEY"


def test_default_data_dir_uses_configured_dir_then_local_app_data(monkeypatch, tmp_path: Path) -> None:
    configured = tmp_path / "configured"
    local_app_data = tmp_path / "local"
    monkeypatch.setenv("DIPLOMAT_DATA_DIR", str(configured))
    monkeypatch.setenv("LOCALAPPDATA", str(local_app_data))

    assert default_data_dir() == configured

    monkeypatch.delenv("DIPLOMAT_DATA_DIR")

    assert default_data_dir() == local_app_data / "Diplomat"


def test_default_data_dir_ignores_blank_env_values(monkeypatch, tmp_path: Path) -> None:
    local_app_data = tmp_path / "local"
    monkeypatch.setenv("DIPLOMAT_DATA_DIR", "  ")
    monkeypatch.setenv("LOCALAPPDATA", str(local_app_data))

    assert default_data_dir() == local_app_data / "Diplomat"

    monkeypatch.setenv("DIPLOMAT_DATA_DIR", "")
    monkeypatch.setenv("LOCALAPPDATA", "\t")

    assert default_data_dir() == Path.home() / ".diplomat"


def test_default_data_dir_falls_back_to_home_when_env_unset(monkeypatch) -> None:
    monkeypatch.delenv("DIPLOMAT_DATA_DIR", raising=False)
    monkeypatch.delenv("LOCALAPPDATA", raising=False)

    assert default_data_dir() == Path.home() / ".diplomat"
