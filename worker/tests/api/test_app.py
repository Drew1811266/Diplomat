from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from diplomat_worker.api.app import create_app
from diplomat_worker.api.runtime import default_data_dir
from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.api.schemas import CreateProjectRequest, ProjectResponse, SrtExportRequest
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import VideoProbe
from diplomat_worker.storage.project_store import ProjectStore


def make_test_runtime(tmp_path: Path) -> WorkerRuntime:
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
    )


def test_health_endpoint_returns_worker_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"name": "diplomat-worker", "status": "ok", "version": "0.1.0"}


def test_app_exposes_worker_project_routes() -> None:
    app = create_app()
    routes = {
        (method, route.path)
        for route in app.routes
        if isinstance(getattr(route, "path", None), str)
        for method in getattr(route, "methods", set())
    }

    assert routes == {
        ("GET", "/health"),
        ("POST", "/projects"),
        ("GET", "/projects/{project_id}"),
        ("POST", "/projects/{project_id}/analyze"),
        ("GET", "/projects/{project_id}/subtitle"),
        ("PUT", "/projects/{project_id}/subtitle"),
    }


def test_project_analyze_and_subtitle_round_trip(tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(create_app(make_test_runtime(tmp_path)))

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

    put_response = client.put(f"/projects/{project_id}/subtitle", json={"document": document})

    assert put_response.status_code == 200

    reloaded_response = client.get(f"/projects/{project_id}/subtitle")

    assert reloaded_response.status_code == 200
    assert reloaded_response.json()["lines"][0]["sourceText"] == "Edited text"


def test_create_project_rejects_video_without_audio(tmp_path: Path) -> None:
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
    client = TestClient(create_app(runtime))

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


def test_get_missing_project_returns_404(tmp_path: Path) -> None:
    client = TestClient(create_app(make_test_runtime(tmp_path)))

    response = client.get("/projects/missing-project")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_get_subtitle_before_analyze_returns_404(tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(create_app(make_test_runtime(tmp_path)))
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


def test_put_subtitle_with_mismatched_project_id_returns_400(tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(create_app(make_test_runtime(tmp_path)))
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
