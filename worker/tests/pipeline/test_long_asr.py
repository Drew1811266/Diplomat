from pathlib import Path

import pytest

from diplomat_worker.asr.base import AsrCanceled, AsrResult, AsrSegment
from diplomat_worker.media.audio import AudioChunk
from diplomat_worker.pipeline.core import CorePipelineInput, run_core_pipeline


class CountingTranscriber:
    def __init__(self, cancel_after_calls: int | None = None) -> None:
        self.calls: list[list[AudioChunk]] = []
        self.cancel_after_calls = cancel_after_calls

    def transcribe(self, audio_path, chunks, progress_callback=None, cancel_token=None):
        self.calls.append(chunks)
        if self.cancel_after_calls is not None and len(self.calls) > self.cancel_after_calls:
            raise AsrCanceled("Analysis canceled")
        chunk = chunks[0]
        return AsrResult(
            engine="fake-asr",
            model="fake-v1",
            language="zh",
            segments=[
                AsrSegment(
                    id=f"segment-{chunk.index}",
                    start_ms=chunk.start_ms,
                    end_ms=min(chunk.start_ms + 1000, chunk.end_ms),
                    text=f"chunk {chunk.index}",
                    words=[],
                )
            ],
        )


def make_input(tmp_path: Path, task_id: str, resume_from_task_id: str | None = None) -> CorePipelineInput:
    source_video = tmp_path / "demo.mp4"
    source_video.write_bytes(b"fake-video")
    return CorePipelineInput(
        project_id="project-1",
        media_id="media-1",
        source_video=source_video,
        project_dir=tmp_path / "project",
        duration_ms=65_000,
        source_language="zh",
        target_language="en",
        task_id=task_id,
        resume_from_task_id=resume_from_task_id,
    )


def test_core_pipeline_writes_manifest_and_chunk_results(tmp_path: Path) -> None:
    transcriber = CountingTranscriber()

    result = run_core_pipeline(
        make_input(tmp_path, task_id="task-1"),
        transcriber=transcriber,
        extract_audio_fn=lambda source, target: target.write_bytes(b"audio") or target,
    )

    asr_dir = tmp_path / "project" / "cache" / "asr" / "task-1"
    assert (asr_dir / "manifest.json").exists()
    assert (asr_dir / "chunks" / "chunk-000001.json").exists()
    assert (asr_dir / "chunks" / "chunk-000002.json").exists()
    assert (asr_dir / "chunks" / "chunk-000003.json").exists()
    assert [line.source_text for line in result.subtitle_document.lines] == ["chunk 0", "chunk 1", "chunk 2"]
    assert len(transcriber.calls) == 3


def test_core_pipeline_preserves_completed_chunks_when_canceled(tmp_path: Path) -> None:
    transcriber = CountingTranscriber(cancel_after_calls=1)

    with pytest.raises(AsrCanceled):
        run_core_pipeline(
            make_input(tmp_path, task_id="task-1"),
            transcriber=transcriber,
            extract_audio_fn=lambda source, target: target.write_bytes(b"audio") or target,
        )

    asr_dir = tmp_path / "project" / "cache" / "asr" / "task-1"
    assert (asr_dir / "chunks" / "chunk-000001.json").exists()
    assert not (asr_dir / "chunks" / "chunk-000002.json").exists()


def test_core_pipeline_reuses_completed_chunks_from_previous_task(tmp_path: Path) -> None:
    first = CountingTranscriber(cancel_after_calls=1)
    with pytest.raises(AsrCanceled):
        run_core_pipeline(
            make_input(tmp_path, task_id="task-1"),
            transcriber=first,
            extract_audio_fn=lambda source, target: target.write_bytes(b"audio") or target,
        )
    retry = CountingTranscriber()

    result = run_core_pipeline(
        make_input(tmp_path, task_id="task-2", resume_from_task_id="task-1"),
        transcriber=retry,
        extract_audio_fn=lambda source, target: target.write_bytes(b"audio") or target,
    )

    assert len(retry.calls) == 2
    assert [call[0].index for call in retry.calls] == [1, 2]
    assert [line.source_text for line in result.subtitle_document.lines] == ["chunk 0", "chunk 1", "chunk 2"]
