from pathlib import Path

from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.asr.chunk_store import build_chunk_manifest, read_manifest, write_manifest
from diplomat_worker.asr.chunk_store import (
    chunk_result_path,
    read_chunk_result,
    valid_chunk_result_exists,
    write_chunk_result,
)
from diplomat_worker.media.audio import build_fixed_chunks


def test_build_chunk_manifest_uses_stable_ids_and_overlap_metadata(tmp_path: Path) -> None:
    audio_path = tmp_path / "audio.wav"
    source_path = tmp_path / "source.mp4"
    chunks = build_fixed_chunks(duration_ms=65_000, chunk_ms=30_000, overlap_ms=500)

    manifest = build_chunk_manifest(
        task_id="task-1",
        audio_path=audio_path,
        source_video_path=source_path,
        duration_ms=65_000,
        chunk_ms=30_000,
        overlap_ms=500,
        chunks=chunks,
    )

    assert manifest.schema_version == "diplomat.asr_manifest.v1"
    assert manifest.task_id == "task-1"
    assert [chunk.chunk_id for chunk in manifest.chunks] == [
        "chunk-000001",
        "chunk-000002",
        "chunk-000003",
    ]
    assert manifest.chunks[0].overlap_before_ms == 0
    assert manifest.chunks[0].overlap_after_ms == 500
    assert manifest.chunks[1].overlap_before_ms == 500
    assert manifest.chunks[1].overlap_after_ms == 500
    assert manifest.chunks[2].overlap_before_ms == 500
    assert manifest.chunks[2].overlap_after_ms == 0


def test_manifest_round_trips_as_json(tmp_path: Path) -> None:
    manifest = build_chunk_manifest(
        task_id="task-2",
        audio_path=tmp_path / "audio.wav",
        source_video_path=tmp_path / "source.mp4",
        duration_ms=31_000,
        chunk_ms=30_000,
        overlap_ms=500,
        chunks=build_fixed_chunks(31_000, chunk_ms=30_000, overlap_ms=500),
    )
    manifest_path = tmp_path / "cache" / "asr" / "task-2" / "manifest.json"

    write_manifest(manifest_path, manifest)

    assert read_manifest(manifest_path) == manifest
    assert manifest_path.read_text(encoding="utf-8").startswith("{\n")


def make_result() -> AsrResult:
    return AsrResult(
        engine="fake-asr",
        model="fake-v1",
        language="zh",
        segments=[
            AsrSegment(
                id="segment-1",
                start_ms=0,
                end_ms=1000,
                text="你好",
                words=[AsrWord(text="你好", start_ms=0, end_ms=1000, confidence=0.9)],
            )
        ],
    )


def test_chunk_result_round_trips_as_json(tmp_path: Path) -> None:
    path = chunk_result_path(tmp_path / "cache" / "asr" / "task-1", "chunk-000001")

    write_chunk_result(path, chunk_id="chunk-000001", result=make_result())

    restored = read_chunk_result(path)
    assert restored.chunk_id == "chunk-000001"
    assert restored.result.engine == "fake-asr"
    assert restored.result.segments[0].text == "你好"
    assert valid_chunk_result_exists(path, chunk_id="chunk-000001") is True


def test_valid_chunk_result_rejects_mismatched_chunk_id(tmp_path: Path) -> None:
    path = chunk_result_path(tmp_path / "cache" / "asr" / "task-1", "chunk-000001")
    write_chunk_result(path, chunk_id="chunk-000001", result=make_result())

    assert valid_chunk_result_exists(path, chunk_id="chunk-000002") is False
