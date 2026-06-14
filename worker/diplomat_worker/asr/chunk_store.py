from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path

from diplomat_worker.media.audio import AudioChunk

MANIFEST_SCHEMA_VERSION = "diplomat.asr_manifest.v1"


@dataclass(frozen=True)
class AsrChunkRecord:
    chunk_id: str
    index: int
    start_ms: int
    end_ms: int
    overlap_before_ms: int
    overlap_after_ms: int


@dataclass(frozen=True)
class AsrChunkManifest:
    schema_version: str
    task_id: str
    audio_path: str
    source_video_path: str
    duration_ms: int
    chunk_ms: int
    overlap_ms: int
    chunks: list[AsrChunkRecord]


def chunk_id(index: int) -> str:
    return f"chunk-{index + 1:06d}"


def build_chunk_manifest(
    *,
    task_id: str,
    audio_path: Path,
    source_video_path: Path,
    duration_ms: int,
    chunk_ms: int,
    overlap_ms: int,
    chunks: list[AudioChunk],
) -> AsrChunkManifest:
    records = [
        AsrChunkRecord(
            chunk_id=chunk_id(chunk.index),
            index=chunk.index,
            start_ms=chunk.start_ms,
            end_ms=chunk.end_ms,
            overlap_before_ms=0 if chunk.index == 0 else overlap_ms,
            overlap_after_ms=0 if position == len(chunks) - 1 else overlap_ms,
        )
        for position, chunk in enumerate(chunks)
    ]
    return AsrChunkManifest(
        schema_version=MANIFEST_SCHEMA_VERSION,
        task_id=task_id,
        audio_path=str(audio_path),
        source_video_path=str(source_video_path),
        duration_ms=duration_ms,
        chunk_ms=chunk_ms,
        overlap_ms=overlap_ms,
        chunks=records,
    )


def write_json_atomic(path: Path, payload: dict) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp_path, path)
    return path


def write_manifest(path: Path, manifest: AsrChunkManifest) -> Path:
    return write_json_atomic(path, asdict(manifest))


def read_manifest(path: Path) -> AsrChunkManifest:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return AsrChunkManifest(
        schema_version=payload["schema_version"],
        task_id=payload["task_id"],
        audio_path=payload["audio_path"],
        source_video_path=payload["source_video_path"],
        duration_ms=int(payload["duration_ms"]),
        chunk_ms=int(payload["chunk_ms"]),
        overlap_ms=int(payload["overlap_ms"]),
        chunks=[AsrChunkRecord(**chunk) for chunk in payload["chunks"]],
    )
