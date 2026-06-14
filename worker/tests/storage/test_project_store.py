import sqlite3
from pathlib import Path

import pytest

from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine
from diplomat_worker.storage.project_store import ProjectStore


def translated_document(project_id: str) -> SubtitleDocument:
    return SubtitleDocument(
        project_id=project_id,
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
                translation_status="translated",
                notes="",
            )
        ],
    )


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


def test_project_store_diagnostics_track_not_transcribed_and_disk_usage(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project(
        name="Demo",
        source_video_path=source,
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )
    cache_file = project.project_dir / "cache" / "waveform.bin"
    cache_file.parent.mkdir()
    cache_file.write_bytes(b"cache")

    diagnostics = store.project_diagnostics(project)

    assert diagnostics.status == "not_transcribed"
    assert diagnostics.source_video_exists is True
    assert diagnostics.project_dir_exists is True
    assert diagnostics.cache_usage_bytes == 5
    assert diagnostics.disk_usage_bytes >= 5
    assert diagnostics.cache_dir == project.project_dir / "cache"


def test_project_store_diagnostics_track_translated_exported_failed_and_corrupted(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project(
        name="Demo",
        source_video_path=source,
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )

    store.save_subtitle_document(project.project_id, translated_document(project.project_id))
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))
    assert diagnostics.status == "translated"
    assert diagnostics.subtitle_line_count == 1
    assert diagnostics.translated_line_count == 1

    export_file = project.project_dir / "exports" / "subtitle.srt"
    export_file.parent.mkdir()
    export_file.write_text("1", encoding="utf-8")
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))
    assert diagnostics.status == "exported"
    assert diagnostics.export_count == 1

    store.create_task(project.project_id, "analysis", "queued", {})
    task = store.list_tasks_for_project(project.project_id)[0]
    store.update_task(
        task.task_id,
        status="failed",
        completed=True,
        error_code="TEST",
        error_message="failed",
    )
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))
    assert diagnostics.status == "failed"
    assert diagnostics.failed_task_count == 1

    (project.project_dir / "subtitle.diplomat.json").write_text("{broken", encoding="utf-8")
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))
    assert diagnostics.status == "corrupted"
    assert diagnostics.warnings[0].code == "subtitle_corrupted"


def test_project_store_diagnostics_warn_when_source_video_is_missing(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "missing.mp4",
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )

    diagnostics = store.project_diagnostics(project)

    assert diagnostics.source_video_exists is False
    assert diagnostics.warnings[0].code == "source_missing"


def test_project_store_cleans_cache_and_exports_only(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project(
        name="Demo",
        source_video_path=source,
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )
    cache_file = project.project_dir / "cache" / "waveform.bin"
    export_file = project.project_dir / "exports" / "subtitle.srt"
    cache_file.parent.mkdir()
    export_file.parent.mkdir()
    cache_file.write_bytes(b"cache")
    export_file.write_bytes(b"export")

    cache_result = store.cleanup_project_cache(project.project_id)

    assert cache_result.action == "cleanup_cache"
    assert cache_result.files_affected == 1
    assert cache_result.bytes_affected == 5
    assert not cache_file.exists()
    assert export_file.exists()

    export_result = store.cleanup_project_exports(project.project_id)

    assert export_result.action == "cleanup_exports"
    assert export_result.files_affected == 1
    assert export_result.bytes_affected == 6
    assert not export_file.exists()


def test_project_store_delete_removes_rows_and_safe_project_directory(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project(
        name="Demo",
        source_video_path=source,
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )
    (project.project_dir / "cache").mkdir()
    (project.project_dir / "cache" / "item.bin").write_bytes(b"x")
    store.create_task(project.project_id, "analysis", "queued", {})

    result = store.delete_project(project.project_id, delete_files=True)

    assert result.action == "delete"
    assert result.files_affected >= 1
    assert not project.project_dir.exists()
    assert store.list_tasks_for_project(project.project_id) == []
    with pytest.raises(KeyError):
        store.get_project(project.project_id)


def test_project_store_delete_refuses_unsafe_project_directory(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(
        name="Unsafe",
        source_video_path=tmp_path / "source.mp4",
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )
    with store._connect() as connection:
        connection.execute(
            "UPDATE projects SET project_dir = ? WHERE project_id = ?",
            (str(tmp_path.parent), project.project_id),
        )
        connection.commit()

    with pytest.raises(ValueError, match="unsafe"):
        store.delete_project(project.project_id, delete_files=True)
    assert store.get_project(project.project_id).project_id == project.project_id


def test_project_store_backup_and_import_round_trip(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project(
        name="Demo",
        source_video_path=source,
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )
    store.save_subtitle_document(project.project_id, translated_document(project.project_id))
    export_file = project.project_dir / "exports" / "subtitle.srt"
    export_file.parent.mkdir(exist_ok=True)
    export_file.write_text("subtitle", encoding="utf-8")

    backup = store.backup_project(project.project_id)
    imported = store.import_project_backup(backup.package_path, restore_name="Restored Demo")

    assert backup.package_path.exists()
    assert backup.bytes_written > 0
    assert imported.name == "Restored Demo"
    assert imported.project_id != project.project_id
    assert imported.source_video_path == source
    assert store.has_subtitle_document(imported.project_id) is True
    assert (imported.project_dir / "exports" / "subtitle.srt").exists()


def test_translation_settings_default_to_project_languages(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=1000,
        source_language="zh",
        target_language="en",
    )

    settings = store.get_translation_settings(project.project_id)

    assert settings.project_id == project.project_id
    assert settings.provider == "fake"
    assert settings.model_id is None
    assert settings.model_name_or_path is None
    assert settings.source_language == "zh"
    assert settings.target_language == "en"
    assert settings.mode == "missing_only"
    assert settings.device == "cpu"
    assert settings.compute_type == "int8"


def test_translation_settings_can_be_saved_and_reopened(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
    store = ProjectStore(database_path)
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=1000,
        source_language="en",
        target_language="zh",
    )

    saved = store.save_translation_settings(
        project.project_id,
        provider="ct2-marian",
        model_id="translation.opus-mt.en-zh",
        model_name_or_path=None,
        source_language="en",
        target_language="zh",
        mode="overwrite_all",
        device="cuda",
        compute_type="float16",
    )
    reopened = ProjectStore(database_path).get_translation_settings(project.project_id)

    assert saved.provider == "ct2-marian"
    assert saved.model_id == "translation.opus-mt.en-zh"
    assert reopened.model_id == "translation.opus-mt.en-zh"
    assert reopened.model_name_or_path is None
    assert reopened.device == "cuda"
    assert reopened.compute_type == "float16"


def test_translation_settings_table_migrates_local_model_columns(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
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
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE translation_settings (
                project_id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                source_language TEXT NOT NULL,
                target_language TEXT NOT NULL,
                mode TEXT NOT NULL,
                endpoint TEXT,
                api_key_env TEXT,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "project-old-settings",
                "Old Settings",
                str(tmp_path / "old.mp4"),
                str(tmp_path / "projects" / "project-old-settings"),
                1000,
                "zh",
                "en",
                "2026-06-01T00:00:00+00:00",
                "2026-06-01T00:00:00+00:00",
            ),
        )
        connection.execute(
            "INSERT INTO translation_settings VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "project-old-settings",
                "libretranslate",
                "zh",
                "en",
                "missing_only",
                "http://localhost:5000",
                "LIBRETRANSLATE_API_KEY",
                "2026-06-01T00:00:00+00:00",
            ),
        )

    settings = ProjectStore(database_path).get_translation_settings("project-old-settings")

    assert settings.provider == "libretranslate"
    assert settings.model_id is None
    assert settings.model_name_or_path is None
    assert settings.device == "cpu"
    assert settings.compute_type == "int8"
    assert settings.endpoint == "http://localhost:5000"


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
