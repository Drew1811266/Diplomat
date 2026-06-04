from pathlib import Path

from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine
from diplomat_worker.storage.project_store import ProjectStore


def test_project_store_creates_project_and_saves_subtitle_document(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(name="Demo", source_video_path=tmp_path / "demo.mp4")

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
