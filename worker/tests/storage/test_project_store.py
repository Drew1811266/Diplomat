from pathlib import Path

import pytest

from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine
from diplomat_worker.storage.project_store import ProjectStore


def test_project_store_creates_project_and_saves_subtitle_document(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=65_000,
        source_language="zh",
        target_language="en",
    )

    document = SubtitleDocument(
        project_id=project.project_id,
        media_id="media-1",
        duration_ms=2500,
        lines=[
            SubtitleLine(
                id="line-1",
                start_ms=0,
                end_ms=2500,
                speaker_id=None,
                source_language="zh",
                target_language="en",
                source_text="你好",
                translated_text="Hello",
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
            )
        ],
    )

    document_path = store.save_subtitle_document(project.project_id, document)
    loaded = store.load_subtitle_document(project.project_id)

    assert document_path.exists()
    assert loaded.project_id == project.project_id
    assert loaded.lines[0].source_text == "你好"
    assert project.duration_ms == 65_000
    assert project.source_language == "zh"
    assert project.target_language == "en"


def test_project_store_round_trips_project_metadata(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    created = store.create_project(
        name="Course Clip",
        source_video_path=tmp_path / "course.mp4",
        duration_ms=90_000,
        source_language="en",
        target_language="zh",
    )

    loaded = store.get_project(created.project_id)

    assert loaded.name == "Course Clip"
    assert loaded.source_video_path == tmp_path / "course.mp4"
    assert loaded.project_dir == created.project_dir
    assert loaded.duration_ms == 90_000
    assert loaded.source_language == "en"
    assert loaded.target_language == "zh"


def test_create_project_rejects_negative_duration(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")

    with pytest.raises(ValueError, match="duration_ms must be greater than or equal to 0"):
        store.create_project(
            name="Demo",
            source_video_path=tmp_path / "demo.mp4",
            duration_ms=-1,
            source_language="zh",
            target_language="en",
        )


def test_create_project_rejects_short_source_language(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")

    with pytest.raises(ValueError, match="source_language must be at least 2 characters"):
        store.create_project(
            name="Demo",
            source_video_path=tmp_path / "demo.mp4",
            duration_ms=65_000,
            source_language="z",
            target_language="en",
        )


def test_create_project_rejects_short_target_language(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")

    with pytest.raises(ValueError, match="target_language must be at least 2 characters"):
        store.create_project(
            name="Demo",
            source_video_path=tmp_path / "demo.mp4",
            duration_ms=65_000,
            source_language="zh",
            target_language="e",
        )


def test_save_subtitle_document_rejects_mismatched_project_id(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=65_000,
        source_language="zh",
        target_language="en",
    )
    document = SubtitleDocument(
        project_id="project-other",
        media_id="media-1",
        duration_ms=2500,
        lines=[],
    )

    with pytest.raises(ValueError):
        store.save_subtitle_document(project.project_id, document)
