from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from diplomat_worker.api.app import create_app
from diplomat_worker.api.runtime import default_data_dir
from diplomat_worker.api.schemas import CreateProjectRequest, ProjectResponse, SrtExportRequest


def test_health_endpoint_returns_worker_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"name": "diplomat-worker", "status": "ok", "version": "0.1.0"}


def test_app_exposes_only_health_route() -> None:
    app = create_app()
    paths = {route.path for route in app.routes if isinstance(getattr(route, "path", None), str)}

    assert paths == {"/health"}


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
