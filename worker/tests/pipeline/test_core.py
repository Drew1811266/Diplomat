from pathlib import Path

from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.audio import AudioChunk
from diplomat_worker.pipeline.core import CorePipelineInput, run_core_pipeline


def test_core_pipeline_builds_subtitle_document_from_fake_asr(tmp_path: Path) -> None:
    source_video = tmp_path / "demo.mp4"
    source_video.write_bytes(b"fake-video")
    project_dir = tmp_path / "project"

    result = run_core_pipeline(
        CorePipelineInput(
            project_id="project-1",
            media_id="media-1",
            source_video=source_video,
            project_dir=project_dir,
            duration_ms=65_000,
            source_language="zh",
            target_language="en",
        ),
        transcriber=FakeTranscriber(language="zh"),
        extract_audio_fn=lambda source, target: target.write_bytes(b"fake-audio") or target,
    )

    assert result.subtitle_document.project_id == "project-1"
    assert len(result.subtitle_document.lines) == 3
    assert result.subtitle_document.lines[0].source_text == "Fake transcript chunk 0"
    assert result.subtitle_path.exists()
    assert result.audio_path.exists()


def test_core_pipeline_uses_injected_segmentation_planner(tmp_path: Path) -> None:
    source_video = tmp_path / "demo.mp4"
    source_video.write_bytes(b"fake-video")
    project_dir = tmp_path / "project"

    result = run_core_pipeline(
        CorePipelineInput(
            project_id="project-1",
            media_id="media-1",
            source_video=source_video,
            project_dir=project_dir,
            duration_ms=65_000,
            source_language="zh",
            target_language="en",
        ),
        transcriber=FakeTranscriber(language="zh"),
        extract_audio_fn=lambda source, target: target.write_bytes(b"fake-audio") or target,
        segmentation_planner=lambda duration_ms: [
            AudioChunk(index=0, start_ms=10_000, end_ms=20_000),
            AudioChunk(index=1, start_ms=42_000, end_ms=55_000),
        ],
    )

    assert [line.start_ms for line in result.subtitle_document.lines] == [10_000, 42_000]
    assert [line.end_ms for line in result.subtitle_document.lines] == [20_000, 55_000]
