import sqlite3
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
    assert loaded.created_at == created.created_at
    assert loaded.updated_at == created.updated_at


def test_project_store_lists_projects_newest_first(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    first = store.create_project(
        name="First",
        source_video_path=tmp_path / "first.mp4",
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )
    second = store.create_project(
        name="Second",
        source_video_path=tmp_path / "second.mp4",
        duration_ms=2000,
        source_language="en",
        target_language="zh",
    )

    projects = store.list_projects()

    assert [project.project_id for project in projects] == [second.project_id, first.project_id]
    assert projects[0].created_at
    assert projects[0].updated_at


def test_project_store_tracks_subtitle_presence_and_updates_timestamp(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )
    before = project.updated_at

    assert store.has_subtitle_document(project.project_id) is False

    store.save_subtitle_document(
        project.project_id,
        SubtitleDocument(
            project_id=project.project_id,
            media_id="media-1",
            duration_ms=1000,
            lines=[],
        ),
    )

    after = store.get_project(project.project_id).updated_at
    assert store.has_subtitle_document(project.project_id) is True
    assert after >= before


def test_project_store_migrates_m2a_database_without_rewriting_subtitle(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
    project_dir = tmp_path / "projects" / "project-old"
    project_dir.mkdir(parents=True)
    subtitle_path = project_dir / "subtitle.diplomat.json"
    subtitle_path.write_text('{"kept": true}', encoding="utf-8")
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE projects (
                project_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_video_path TEXT NOT NULL,
                project_dir TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                source_language TEXT NOT NULL,
                target_language TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "project-old",
                "Old",
                str(tmp_path / "old.mp4"),
                str(project_dir),
                1000,
                "zh",
                "en",
                "2026-06-01T00:00:00+00:00",
            ),
        )

    store = ProjectStore(database_path)
    project = store.get_project("project-old")

    assert project.updated_at == "2026-06-01T00:00:00+00:00"
    assert subtitle_path.read_text(encoding="utf-8") == '{"kept": true}'


def test_project_store_migrates_minimal_old_project_rows(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute("CREATE TABLE projects (project_id TEXT PRIMARY KEY, name TEXT NOT NULL)")
        connection.execute(
            "INSERT INTO projects (project_id, name) VALUES (?, ?)",
            ("project-minimal", "Minimal"),
        )

    store = ProjectStore(database_path)
    project = store.get_project("project-minimal")

    assert project.project_dir == tmp_path / "projects" / "project-minimal"
    assert project.duration_ms == 0
    assert project.source_language == "und"
    assert project.updated_at


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
