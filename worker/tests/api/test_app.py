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
    SubtitleExportRequest,
    SrtExportRequest,
    TranslationSettingsRequest,
)
from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe
from diplomat_worker.media.waveform import WaveformData, build_waveform_peaks, write_waveform_cache
from diplomat_worker.models.manager import ModelDownloadManager
from diplomat_worker.models.registry import ModelRegistryEntry
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.analysis import AnalysisJobManager
from diplomat_worker.tasks.export import BurnInExportJobManager
from diplomat_worker.tasks.translation import TranslationJobManager
from diplomat_worker.tasks.waveform import WaveformJobManager


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
    assert response.json() == {"name": "diplomat-worker", "status": "ok", "version": "0.3.0"}


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
        ("GET", "/release/readiness"),
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
        ("GET", "/projects/{project_id}/media/source"),
        ("GET", "/projects/{project_id}/subtitle/draft"),
        ("PUT", "/projects/{project_id}/subtitle/draft"),
        ("DELETE", "/projects/{project_id}/subtitle/draft"),
        ("GET", "/projects/{project_id}/subtitle/snapshots"),
        ("POST", "/projects/{project_id}/subtitle/snapshots"),
        ("POST", "/projects/{project_id}/subtitle/snapshots/{snapshot_id}/restore"),
        ("GET", "/projects/{project_id}/style-presets"),
        ("POST", "/projects/{project_id}/style-presets"),
        ("PATCH", "/projects/{project_id}/style-presets/{preset_id}"),
        ("DELETE", "/projects/{project_id}/style-presets/{preset_id}"),
        ("POST", "/projects/{project_id}/style-presets/{preset_id}/apply"),
        ("GET", "/projects/{project_id}/translation-settings"),
        ("PUT", "/projects/{project_id}/translation-settings"),
        ("POST", "/projects/{project_id}/translation-jobs"),
        ("GET", "/projects/{project_id}/waveform"),
        ("POST", "/projects/{project_id}/waveform-jobs"),
        ("POST", "/projects/{project_id}/exports/subtitles"),
        ("POST", "/projects/{project_id}/exports/video"),
        ("POST", "/projects/{project_id}/exports/srt"),
        ("GET", "/projects/{project_id}/subtitle"),
        ("PUT", "/projects/{project_id}/subtitle"),
        ("GET", "/tasks/{task_id}"),
        ("POST", "/tasks/{task_id}/cancel"),
        ("POST", "/tasks/{task_id}/retry"),
    }
    assert calls == []


def test_release_readiness_route_reports_tool_blockers_without_model_audit_blockers(
    app_module,
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(
        app_module,
        "tool_availability",
        lambda path, label: {"status": "missing", "message": f"{label} missing: {path}"},
    )
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))

    response = client.get("/release/readiness")

    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == "0.3.0"
    assert payload["ready"] is False
    assert payload["summary"]["blocker"] >= 1
    blockers = {check["id"] for check in payload["checks"] if check["severity"] == "blocker"}
    assert {"ffmpeg_available", "ffprobe_available"} <= blockers
    assert "model_registry_checksums" not in blockers
    assert "model_registry_sources" not in blockers


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


def install_model_entry(store: ProjectStore, entry: ModelRegistryEntry) -> Path:
    installed_path = store.safe_model_dir(entry.model_id)
    installed_path.mkdir(parents=True, exist_ok=True)
    (installed_path / "model.bin").write_bytes(b"api model")
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
        "styles": [
            {
                "id": "default",
                "name": "Default",
                "fontFamily": "Arial",
                "fontSize": 36,
                "primaryColor": "#FFFFFF",
                "secondaryColor": "#14B8A6",
                "strokeWidth": 3,
                "shadow": 1,
                "position": "bottom-center",
                "marginV": 48,
                "alignment": "center",
                "bilingualLayout": "source-above-target",
                "lineSpacing": 1.15,
                "backgroundBar": False,
                "backgroundColor": "#000000cc",
                "safeAreaMargin": 32,
            }
        ],
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


def test_subtitle_draft_routes_round_trip(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"][0]["sourceText"] = "Draft edit"

    missing_response = client.get(f"/projects/{project_id}/subtitle/draft")
    save_response = client.put(f"/projects/{project_id}/subtitle/draft", json={"document": document})
    load_response = client.get(f"/projects/{project_id}/subtitle/draft")
    project_response = client.get(f"/projects/{project_id}")
    clear_response = client.delete(f"/projects/{project_id}/subtitle/draft")
    missing_after_clear = client.get(f"/projects/{project_id}/subtitle/draft")

    assert missing_response.status_code == 404
    assert save_response.status_code == 200
    assert save_response.json()["lineCount"] == 1
    assert load_response.status_code == 200
    assert load_response.json()["document"]["lines"][0]["sourceText"] == "Draft edit"
    assert project_response.json()["diagnostics"]["status"] == "dirty_draft"
    assert clear_response.status_code == 200
    assert clear_response.json()["action"] == "clear_draft"
    assert missing_after_clear.status_code == 404


def test_stable_subtitle_save_clears_draft_route(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"][0]["sourceText"] = "Draft edit"
    draft_response = client.put(f"/projects/{project_id}/subtitle/draft", json={"document": document})

    assert draft_response.status_code == 200

    stable_response = client.put(f"/projects/{project_id}/subtitle", json={"document": document})
    draft_after_save = client.get(f"/projects/{project_id}/subtitle/draft")

    assert stable_response.status_code == 200
    assert draft_after_save.status_code == 404


def test_subtitle_snapshot_routes_create_list_and_restore(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"][0]["sourceText"] = "Snapshot edit"

    create_response = client.post(
        f"/projects/{project_id}/subtitle/snapshots",
        json={"reason": "manual", "label": "Manual checkpoint", "document": document},
    )
    list_response = client.get(f"/projects/{project_id}/subtitle/snapshots")
    restore_response = client.post(
        f"/projects/{project_id}/subtitle/snapshots/{create_response.json()['snapshotId']}/restore"
    )
    missing_restore = client.post(f"/projects/{project_id}/subtitle/snapshots/snapshot-missing/restore")

    assert create_response.status_code == 201
    assert create_response.json()["reason"] == "manual"
    assert create_response.json()["document"]["lines"][0]["sourceText"] == "Snapshot edit"
    assert list_response.status_code == 200
    assert list_response.json()["snapshots"][0]["label"] == "Manual checkpoint"
    assert restore_response.status_code == 200
    assert restore_response.json()["lines"][0]["sourceText"] == "Snapshot edit"
    assert missing_restore.status_code == 404


def test_style_preset_routes_round_trip(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    style = client.get(f"/projects/{project_id}/subtitle").json()["styles"][0]

    default_response = client.get(f"/projects/{project_id}/style-presets")
    create_response = client.post(
        f"/projects/{project_id}/style-presets",
        json={"name": "Broadcast", "style": style},
    )
    preset_id = create_response.json()["id"]
    list_response = client.get(f"/projects/{project_id}/style-presets")
    rename_response = client.patch(
        f"/projects/{project_id}/style-presets/{preset_id}",
        json={"name": "Broadcast Renamed"},
    )
    apply_response = client.post(f"/projects/{project_id}/style-presets/{preset_id}/apply")
    subtitle_response = client.get(f"/projects/{project_id}/subtitle")
    delete_response = client.delete(f"/projects/{project_id}/style-presets/{preset_id}")
    missing_response = client.patch(
        f"/projects/{project_id}/style-presets/preset-missing",
        json={"name": "Missing"},
    )

    assert default_response.status_code == 200
    assert default_response.json()["activePresetId"] == "preset-default"
    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Broadcast"
    assert list_response.json()["presets"][-1]["id"] == preset_id
    assert rename_response.status_code == 200
    assert rename_response.json()["name"] == "Broadcast Renamed"
    assert apply_response.status_code == 200
    assert apply_response.json()["activePresetId"] == preset_id
    assert subtitle_response.json()["styles"][0]["name"] == "Broadcast Renamed"
    assert delete_response.status_code == 200
    assert delete_response.json()["activePresetId"] == "preset-default"
    assert missing_response.status_code == 404


def test_project_source_media_endpoint_returns_source_file(app_module, tmp_path: Path) -> None:
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.get(f"/projects/{project_id}/media/source")

    assert response.status_code == 200
    assert response.content == b"fake-video"


def test_project_source_media_endpoint_returns_not_found_for_missing_file(
    app_module,
    tmp_path: Path,
) -> None:
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    source_path = tmp_path / "source.mp4"
    source_path.unlink()

    response = client.get(f"/projects/{project_id}/media/source")

    assert response.status_code == 404
    assert response.json()["detail"] == "Source media not found"


def test_waveform_endpoint_returns_cached_waveform(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    project = runtime.store.get_project(project_id)

    missing_response = client.get(f"/projects/{project_id}/waveform")
    write_waveform_cache(
        project.project_dir / "cache" / "waveform.json",
        WaveformData(
            project_id=project_id,
            duration_ms=1000,
            sample_rate=8000,
            peaks=build_waveform_peaks([0.0, 0.5, -0.5, 0.25], 1000, 2, 8000),
        ),
    )
    cached_response = client.get(f"/projects/{project_id}/waveform")

    assert missing_response.status_code == 404
    assert cached_response.status_code == 200
    assert cached_response.json()["projectId"] == project_id
    assert cached_response.json()["peakCount"] == 2


def test_waveform_job_endpoint_returns_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = WaveformJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, waveform_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.post(f"/projects/{project_id}/waveform-jobs")

    assert response.status_code == 202
    assert response.json()["type"] == "waveform"
    assert response.json()["status"] == "queued"


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
    for index, line in enumerate(document["lines"]):
        line["startMs"] = index * 30_000
        line["endMs"] = min((index + 1) * 30_000, document["durationMs"])
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


def test_general_subtitle_export_writes_vtt_and_ass(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"][0]["translatedText"] = "你好，世界"
    client.put(f"/projects/{project_id}/subtitle", json={"document": document})

    vtt_response = client.post(
        f"/projects/{project_id}/exports/subtitles",
        json={"format": "vtt", "mode": "bilingual"},
    )
    ass_response = client.post(
        f"/projects/{project_id}/exports/subtitles",
        json={"format": "ass", "mode": "target", "style": document["styles"][0]},
    )

    assert vtt_response.status_code == 200
    assert vtt_response.json()["format"] == "vtt"
    assert vtt_response.json()["exportPath"].endswith("subtitle-bilingual.vtt")
    assert Path(vtt_response.json()["exportPath"]).read_text(encoding="utf-8").startswith("WEBVTT")
    assert ass_response.status_code == 200
    assert ass_response.json()["format"] == "ass"
    ass_text = Path(ass_response.json()["exportPath"]).read_text(encoding="utf-8")
    assert "[Events]" in ass_text
    assert "你好，世界" in ass_text


def test_general_subtitle_export_blocks_overlap(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"].append({**document["lines"][0], "id": "line-overlap"})
    save_response = client.put(f"/projects/{project_id}/subtitle", json={"document": document})

    response = client.post(
        f"/projects/{project_id}/exports/subtitles",
        json={"format": "ass", "mode": "bilingual"},
    )

    assert save_response.status_code == 200
    assert response.status_code == 409
    assert any("overlap" in issue["code"] for issue in response.json()["detail"])


def test_general_subtitle_export_returns_warnings(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"][0]["endMs"] = 200
    save_response = client.put(f"/projects/{project_id}/subtitle", json={"document": document})

    response = client.post(
        f"/projects/{project_id}/exports/subtitles",
        json={"format": "srt", "mode": "source"},
    )

    assert save_response.status_code == 200
    assert response.status_code == 200
    assert response.json()["warnings"][0]["code"] == "too_short"


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


def test_create_analysis_job_accepts_installed_curated_asr_model(app_module, tmp_path: Path) -> None:
    entry = make_model_entry(tmp_path)
    runtime = make_test_runtime(tmp_path, model_registry=[entry])
    install_model_entry(runtime.store, entry)
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
        json={"provider": "faster-whisper", "modelId": entry.model_id},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "queued"
    assert runtime.store.get_task(payload["taskId"]).request_payload == {
        "provider": "faster-whisper",
        "modelId": entry.model_id,
        "device": "cpu",
        "computeType": "int8",
    }


def test_create_analysis_job_rejects_uninstalled_curated_asr_model(app_module, tmp_path: Path) -> None:
    entry = make_model_entry(tmp_path)
    runtime = make_test_runtime(tmp_path, model_registry=[entry])
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
        json={"provider": "faster-whisper", "modelId": entry.model_id},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Install API ASR Light from Models before starting transcription."


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
    entry = make_model_entry(tmp_path)
    runtime = make_test_runtime(tmp_path, model_registry=[entry])
    install_model_entry(runtime.store, entry)
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
        model_registry=[entry],
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
            "modelId": entry.model_id,
            "device": "cpu",
            "computeType": "int8",
            "sourceLanguage": "en",
        },
    )
    retry_task_id = retry_response.json()["taskId"]

    assert retry_response.status_code == 202
    assert runtime.store.get_task(retry_task_id).request_payload == {
        "provider": "faster-whisper",
        "modelId": entry.model_id,
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


def test_create_translation_job_rejects_uninstalled_curated_translation_model(
    app_module,
    tmp_path: Path,
) -> None:
    source_path = tmp_path / "translation-model.bin"
    source_path.write_bytes(b"translation")
    entry = ModelRegistryEntry(
        model_id="translation.fixture.en-zh",
        name="Fixture Translation",
        task="translation",
        tier="light",
        runtime="ct2-marian",
        provider="ct2-marian",
        version="test",
        languages=["en", "zh"],
        language_pairs=[("en", "zh")],
        model_size_bytes=source_path.stat().st_size,
        download_size_bytes=source_path.stat().st_size,
        disk_requirement_bytes=source_path.stat().st_size,
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url=str(source_path),
        checksum_algorithm="sha256",
        checksum="d" * 64,
        terms_summary="Test fixture translation model.",
    )
    runtime = make_test_runtime(tmp_path, model_registry=[entry])
    manager = TranslationJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, translation_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.post(
        f"/projects/{project_id}/translation-jobs",
        json={
            "provider": "ct2-marian",
            "modelId": entry.model_id,
            "sourceLanguage": "en",
            "targetLanguage": "zh",
            "mode": "missing_only",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Install Fixture Translation from Models before starting translation."


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


def test_general_subtitle_export_for_missing_style_preset_returns_404(app_module, tmp_path: Path) -> None:
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.post(
        f"/projects/{project_id}/exports/subtitles",
        json={"format": "ass", "mode": "bilingual", "stylePresetId": "preset-missing"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Style preset not found"


def test_create_burn_in_export_job_returns_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, export_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.post(
        f"/projects/{project_id}/exports/video",
        json={"mode": "bilingual", "videoCodec": "libx264", "crf": 18, "preset": "medium"},
    )

    assert response.status_code == 202
    assert response.json()["type"] == "export"
    assert response.json()["status"] == "queued"
    task_id = response.json()["taskId"]
    assert runtime.store.get_task(task_id).request_payload["mode"] == "bilingual"


def test_cancel_and_retry_export_task_dispatch_to_export_manager(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, export_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    task = client.post(f"/projects/{project_id}/exports/video", json={"mode": "target"}).json()

    canceled = client.post(f"/tasks/{task['taskId']}/cancel")
    retry = client.post(f"/tasks/{task['taskId']}/retry")

    assert canceled.status_code == 200
    assert canceled.json()["status"] == "canceled"
    assert retry.status_code == 202
    assert retry.json()["type"] == "export"
    assert retry.json()["taskId"] != task["taskId"]


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


def test_subtitle_export_request_defaults_to_srt_bilingual() -> None:
    request = SubtitleExportRequest()

    assert request.format == "srt"
    assert request.mode == "bilingual"
    assert request.style_preset_id is None


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
    assert request.model_id is None
    assert request.model_name_or_path is None
    assert request.device == "cpu"
    assert request.compute_type == "int8"

    configured = AnalysisJobRequest(
        provider="faster-whisper",
        modelId="asr.faster-whisper.small",
        sourceLanguage="zh",
        initialPrompt="Domain words",
    )

    assert configured.model_id == "asr.faster-whisper.small"
    assert configured.model_name_or_path is None
    assert configured.source_language == "zh"


def test_asr_model_config_serializes_model_id() -> None:
    config = AsrModelConfig(
        provider="faster-whisper",
        model_id="asr.faster-whisper.small",
        device="cuda",
        compute_type="float16",
        source_language="zh",
    )

    assert config.to_request_payload() == {
        "provider": "faster-whisper",
        "modelId": "asr.faster-whisper.small",
        "device": "cuda",
        "computeType": "float16",
        "sourceLanguage": "zh",
    }


def test_translation_settings_request_defaults_to_fake_missing_only() -> None:
    request = TranslationSettingsRequest(sourceLanguage="en", targetLanguage="zh")

    assert request.provider == "fake"
    assert request.model_id is None
    assert request.model_name_or_path is None
    assert request.source_language == "en"
    assert request.target_language == "zh"
    assert request.mode == "missing_only"
    assert request.device == "cpu"
    assert request.compute_type == "int8"
    assert request.endpoint is None
    assert request.api_key_env is None

    configured = TranslationSettingsRequest(
        provider="ct2-marian",
        modelId="translation.opus-mt.zh-en",
        sourceLanguage="zh",
        targetLanguage="en",
        mode="overwrite_all",
        device="cuda",
        computeType="float16",
    )

    assert configured.provider == "ct2-marian"
    assert configured.model_id == "translation.opus-mt.zh-en"
    assert configured.mode == "overwrite_all"
    assert configured.device == "cuda"
    assert configured.compute_type == "float16"


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
