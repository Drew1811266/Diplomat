# Diplomat 0.32 Recoverable Long-Media ASR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-shot ASR with manifest-backed, chunk-level, resumable transcription for one-to-three-hour videos.

**Architecture:** Keep one normalized project audio file, then run ASR one manifest chunk at a time. Persist manifest and chunk JSON outputs under `cache/asr/<task-id>/`, reuse valid chunk outputs on retry, and merge chunk outputs into the existing subtitle document model only after validation.

**Tech Stack:** Python 3.12, FastAPI Worker, Pydantic/dataclasses, pytest, faster-whisper `clip_timestamps`, existing task store and subtitle schemas.

---

## Files

- Modify: `README.md`
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/desktop/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/Cargo.lock`
- Modify: `worker/pyproject.toml`
- Modify: `worker/diplomat_worker/__init__.py`
- Modify: `scripts/verify-version.mjs`
- Modify: `worker/diplomat_worker/media/audio.py`
- Modify: `worker/diplomat_worker/asr/faster_whisper.py`
- Modify: `worker/diplomat_worker/pipeline/core.py`
- Modify: `worker/diplomat_worker/tasks/analysis.py`
- Create: `worker/diplomat_worker/asr/chunk_store.py`
- Create: `worker/diplomat_worker/asr/merge.py`
- Create: `worker/tests/asr/test_chunk_store.py`
- Create: `worker/tests/asr/test_merge.py`
- Create: `worker/tests/pipeline/test_long_asr.py`
- Modify: `worker/tests/asr/test_faster_whisper.py`
- Modify: `worker/tests/tasks/test_analysis_jobs.py`
- Create: `docs/development/0-32-stage-gate-review.md` during stage review

## Task 0: Advance Version Metadata To 0.32.0

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/desktop/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/Cargo.lock`
- Modify: `worker/pyproject.toml`
- Modify: `worker/diplomat_worker/__init__.py`
- Modify: `README.md`
- Modify: `scripts/verify-version.mjs`

- [ ] **Step 1: Update version strings**

Set every release metadata value to `0.32.0`. In `scripts/verify-version.mjs`, set:

```js
const expectedVersion = "0.32.0";
```

In `README.md`, update the version section to:

```markdown
Current project version: **0.32.0**
Release tag: **v0.32**
```

- [ ] **Step 2: Refresh lock metadata**

Run:

```powershell
corepack pnpm install --lockfile-only
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected: Cargo finishes successfully and `Cargo.lock` records the local package version as `0.32.0`.

- [ ] **Step 3: Verify version metadata**

Run:

```powershell
node .\scripts\verify-version.mjs
```

Expected output:

```text
All release version metadata matches 0.32.0.
```

- [ ] **Step 4: Commit**

```powershell
git add package.json apps/web/package.json apps/desktop/package.json packages/shared/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock worker/pyproject.toml worker/diplomat_worker/__init__.py README.md scripts/verify-version.mjs pnpm-lock.yaml
git commit -m "chore(release): advance version to 0.32.0"
```

## Task 1: Add Stable Chunk Manifests

**Files:**
- Modify: `worker/diplomat_worker/media/audio.py`
- Create: `worker/diplomat_worker/asr/chunk_store.py`
- Create: `worker/tests/asr/test_chunk_store.py`

- [ ] **Step 1: Write failing manifest tests**

Create `worker/tests/asr/test_chunk_store.py`:

```python
from pathlib import Path

from diplomat_worker.asr.chunk_store import build_chunk_manifest, read_manifest, write_manifest
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
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/asr/test_chunk_store.py -q
```

Expected: import failure because `diplomat_worker.asr.chunk_store` does not exist.

- [ ] **Step 3: Add manifest implementation**

Create `worker/diplomat_worker/asr/chunk_store.py`:

```python
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
```

- [ ] **Step 4: Run tests and confirm pass**

```powershell
python -m pytest worker/tests/asr/test_chunk_store.py -q
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/asr/chunk_store.py worker/tests/asr/test_chunk_store.py
git commit -m "feat(asr): add chunk manifest store"
```

## Task 2: Persist Chunk-Level ASR Results

**Files:**
- Modify: `worker/diplomat_worker/asr/chunk_store.py`
- Modify: `worker/tests/asr/test_chunk_store.py`

- [ ] **Step 1: Add failing chunk result tests**

Append to `worker/tests/asr/test_chunk_store.py`:

```python
from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.asr.chunk_store import (
    chunk_result_path,
    read_chunk_result,
    valid_chunk_result_exists,
    write_chunk_result,
)


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
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/asr/test_chunk_store.py -q
```

Expected: import failure for chunk result helpers.

- [ ] **Step 3: Add chunk result helpers**

Append to `worker/diplomat_worker/asr/chunk_store.py`:

```python
from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord

CHUNK_RESULT_SCHEMA_VERSION = "diplomat.asr_chunk_result.v1"


@dataclass(frozen=True)
class AsrChunkResultDocument:
    schema_version: str
    chunk_id: str
    result: AsrResult


def chunk_result_path(task_cache_dir: Path, chunk_id_value: str) -> Path:
    return task_cache_dir / "chunks" / f"{chunk_id_value}.json"


def _word_to_dict(word: AsrWord) -> dict:
    return {
        "text": word.text,
        "start_ms": word.start_ms,
        "end_ms": word.end_ms,
        "confidence": word.confidence,
    }


def _segment_to_dict(segment: AsrSegment) -> dict:
    return {
        "id": segment.id,
        "start_ms": segment.start_ms,
        "end_ms": segment.end_ms,
        "text": segment.text,
        "words": [_word_to_dict(word) for word in segment.words],
    }


def _result_to_dict(result: AsrResult) -> dict:
    return {
        "engine": result.engine,
        "model": result.model,
        "language": result.language,
        "segments": [_segment_to_dict(segment) for segment in result.segments],
    }


def _result_from_dict(payload: dict) -> AsrResult:
    return AsrResult(
        engine=payload["engine"],
        model=payload["model"],
        language=payload["language"],
        segments=[
            AsrSegment(
                id=segment["id"],
                start_ms=int(segment["start_ms"]),
                end_ms=int(segment["end_ms"]),
                text=segment["text"],
                words=[
                    AsrWord(
                        text=word["text"],
                        start_ms=int(word["start_ms"]),
                        end_ms=int(word["end_ms"]),
                        confidence=word["confidence"],
                    )
                    for word in segment["words"]
                ],
            )
            for segment in payload["segments"]
        ],
    )


def write_chunk_result(path: Path, *, chunk_id: str, result: AsrResult) -> Path:
    return write_json_atomic(
        path,
        {
            "schema_version": CHUNK_RESULT_SCHEMA_VERSION,
            "chunk_id": chunk_id,
            "result": _result_to_dict(result),
        },
    )


def read_chunk_result(path: Path) -> AsrChunkResultDocument:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return AsrChunkResultDocument(
        schema_version=payload["schema_version"],
        chunk_id=payload["chunk_id"],
        result=_result_from_dict(payload["result"]),
    )


def valid_chunk_result_exists(path: Path, *, chunk_id: str) -> bool:
    if not path.exists():
        return False
    try:
        document = read_chunk_result(path)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return False
    return document.schema_version == CHUNK_RESULT_SCHEMA_VERSION and document.chunk_id == chunk_id
```

- [ ] **Step 4: Run tests**

```powershell
python -m pytest worker/tests/asr/test_chunk_store.py -q
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/asr/chunk_store.py worker/tests/asr/test_chunk_store.py
git commit -m "feat(asr): persist chunk transcription results"
```

## Task 3: Merge Chunk Outputs Deterministically

**Files:**
- Create: `worker/diplomat_worker/asr/merge.py`
- Create: `worker/tests/asr/test_merge.py`

- [ ] **Step 1: Write failing merge tests**

Create `worker/tests/asr/test_merge.py`:

```python
from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.asr.merge import merge_chunk_results
from diplomat_worker.asr.chunk_store import AsrChunkRecord, AsrChunkResultDocument


def segment(segment_id: str, start_ms: int, end_ms: int, text: str) -> AsrSegment:
    return AsrSegment(
        id=segment_id,
        start_ms=start_ms,
        end_ms=end_ms,
        text=text,
        words=[AsrWord(text=text, start_ms=start_ms, end_ms=end_ms, confidence=None)],
    )


def document(chunk_id: str, segments: list[AsrSegment]) -> AsrChunkResultDocument:
    return AsrChunkResultDocument(
        schema_version="diplomat.asr_chunk_result.v1",
        chunk_id=chunk_id,
        result=AsrResult(engine="fake-asr", model="fake-v1", language="zh", segments=segments),
    )


def test_merge_chunk_results_sorts_and_renumbers_segments() -> None:
    merged = merge_chunk_results(
        [
            document("chunk-000002", [segment("later", 1500, 2500, "后面")]),
            document("chunk-000001", [segment("first", 0, 1000, "前面")]),
        ]
    )

    assert [item.id for item in merged.segments] == ["segment-1", "segment-2"]
    assert [item.text for item in merged.segments] == ["前面", "后面"]
    assert merged.language == "zh"


def test_merge_chunk_results_deduplicates_overlap_by_text_and_time() -> None:
    merged = merge_chunk_results(
        [
            document("chunk-000001", [segment("a", 0, 1000, "重复"), segment("b", 1200, 2000, "保留")]),
            document("chunk-000002", [segment("c", 900, 1600, "重复"), segment("d", 2100, 3000, "继续")]),
        ]
    )

    assert [item.text for item in merged.segments] == ["重复", "保留", "继续"]


def test_merge_chunk_results_clamps_non_monotonic_timings() -> None:
    merged = merge_chunk_results(
        [
            document("chunk-000001", [segment("a", -100, 1000, "第一句")]),
            document("chunk-000002", [segment("b", 900, 800, "第二句")]),
        ]
    )

    assert merged.segments[0].start_ms == 0
    assert merged.segments[0].end_ms == 1000
    assert merged.segments[1].start_ms == 1000
    assert merged.segments[1].end_ms == 1001
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/asr/test_merge.py -q
```

Expected: import failure because `diplomat_worker.asr.merge` does not exist.

- [ ] **Step 3: Implement merge logic**

Create `worker/diplomat_worker/asr/merge.py`:

```python
from __future__ import annotations

from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.asr.chunk_store import AsrChunkResultDocument


def normalized_text(value: str) -> str:
    return "".join(value.lower().split())


def is_duplicate(previous: AsrSegment, current: AsrSegment) -> bool:
    if normalized_text(previous.text) != normalized_text(current.text):
        return False
    return current.start_ms <= previous.end_ms + 500


def clamp_segment(segment: AsrSegment, index: int, previous_end_ms: int) -> AsrSegment:
    start_ms = max(0, segment.start_ms, previous_end_ms)
    end_ms = max(start_ms + 1, segment.end_ms)
    words = [
        AsrWord(
            text=word.text,
            start_ms=max(start_ms, word.start_ms),
            end_ms=max(start_ms + 1, word.end_ms),
            confidence=word.confidence,
        )
        for word in segment.words
    ]
    return AsrSegment(
        id=f"segment-{index}",
        start_ms=start_ms,
        end_ms=end_ms,
        text=segment.text,
        words=words,
    )


def merge_chunk_results(documents: list[AsrChunkResultDocument]) -> AsrResult:
    if not documents:
        return AsrResult(engine="unknown-asr", model="unknown", language="und", segments=[])

    ordered_segments = sorted(
        [segment for document in documents for segment in document.result.segments],
        key=lambda segment: (segment.start_ms, segment.end_ms, segment.text),
    )
    merged: list[AsrSegment] = []
    for segment in ordered_segments:
        if merged and is_duplicate(merged[-1], segment):
            continue
        previous_end_ms = merged[-1].end_ms if merged else 0
        merged.append(clamp_segment(segment, len(merged) + 1, previous_end_ms))

    first_result = documents[0].result
    return AsrResult(
        engine=first_result.engine,
        model=first_result.model,
        language=first_result.language,
        segments=merged,
    )
```

- [ ] **Step 4: Run tests**

```powershell
python -m pytest worker/tests/asr/test_merge.py -q
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/asr/merge.py worker/tests/asr/test_merge.py
git commit -m "feat(asr): merge chunk transcription outputs"
```

## Task 4: Make Faster-Whisper Honor Single-Chunk Requests

**Files:**
- Modify: `worker/diplomat_worker/asr/faster_whisper.py`
- Modify: `worker/tests/asr/test_faster_whisper.py`

- [ ] **Step 1: Add failing faster-whisper chunk clipping test**

Append to `worker/tests/asr/test_faster_whisper.py`:

```python
def test_faster_whisper_transcriber_clips_single_chunk(monkeypatch, tmp_path: Path) -> None:
    install_fake_faster_whisper(monkeypatch)
    audio_path = tmp_path / "audio.wav"
    audio_path.write_bytes(b"audio")
    transcriber = FasterWhisperTranscriber(model_name="small", language="zh")

    transcriber.transcribe(
        audio_path=audio_path,
        chunks=[AudioChunk(index=2, start_ms=60_000, end_ms=90_000)],
    )

    model = FakeWhisperModel.instances[0]
    assert model.transcribe_calls[0][1]["clip_timestamps"] == [60.0, 90.0]
    assert model.transcribe_calls[0][1]["condition_on_previous_text"] is False
```

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
python -m pytest worker/tests/asr/test_faster_whisper.py::test_faster_whisper_transcriber_clips_single_chunk -q
```

Expected: assertion failure because `clip_timestamps` is not passed.

- [ ] **Step 3: Update faster-whisper transcriber**

In `worker/diplomat_worker/asr/faster_whisper.py`, update `transcribe_kwargs` construction:

```python
        transcribe_kwargs = {
            "language": self.language,
            "word_timestamps": True,
            "condition_on_previous_text": False,
        }
        if len(chunks) == 1:
            chunk = chunks[0]
            transcribe_kwargs["clip_timestamps"] = [
                chunk.start_ms / 1000,
                chunk.end_ms / 1000,
            ]
```

Then normalize segment and word timestamps with this helper in the same file:

```python
def _normalize_timestamp_ms(value_seconds: float, chunk: AudioChunk | None) -> int:
    value_ms = int(value_seconds * 1000)
    if chunk is None or chunk.start_ms == 0:
        return value_ms
    chunk_duration_ms = chunk.end_ms - chunk.start_ms
    if value_ms <= chunk_duration_ms + 1000:
        return value_ms + chunk.start_ms
    return value_ms
```

Use:

```python
        active_chunk = chunks[0] if len(chunks) == 1 else None
```

and call `_normalize_timestamp_ms(segment.start, active_chunk)` for segment and word times.

Update the existing `test_faster_whisper_transcriber_converts_segments_and_words` expected kwargs to include the new stable chunk parameters:

```python
            {
                "language": "zh",
                "word_timestamps": True,
                "condition_on_previous_text": False,
                "clip_timestamps": [0.0, 2.0],
                "initial_prompt": "Use subtitle punctuation",
            },
```

- [ ] **Step 4: Run faster-whisper tests**

```powershell
python -m pytest worker/tests/asr/test_faster_whisper.py -q
```

Expected: all faster-whisper tests pass.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/asr/faster_whisper.py worker/tests/asr/test_faster_whisper.py
git commit -m "feat(asr): clip faster-whisper by chunk"
```

## Task 5: Integrate Manifest-Backed Chunk Execution In Core Pipeline

**Files:**
- Modify: `worker/diplomat_worker/pipeline/core.py`
- Create: `worker/tests/pipeline/test_long_asr.py`

- [ ] **Step 1: Write failing recoverable pipeline tests**

Create `worker/tests/pipeline/test_long_asr.py`:

```python
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
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/pipeline/test_long_asr.py -q
```

Expected: `CorePipelineInput` does not accept `task_id` and chunk outputs are not written.

- [ ] **Step 3: Add task fields to `CorePipelineInput`**

In `worker/diplomat_worker/pipeline/core.py`, extend the dataclass:

```python
    task_id: str = "manual"
    resume_from_task_id: str | None = None
```

- [ ] **Step 4: Add chunk cache helpers inside `core.py`**

Import:

```python
import shutil
from diplomat_worker.asr.chunk_store import (
    build_chunk_manifest,
    chunk_result_path,
    read_chunk_result,
    valid_chunk_result_exists,
    write_chunk_result,
    write_manifest,
)
from diplomat_worker.asr.merge import merge_chunk_results
```

Add helper:

```python
def asr_task_cache_dir(project_dir: Path, task_id: str) -> Path:
    return project_dir / "cache" / "asr" / task_id
```

- [ ] **Step 5: Replace one-shot ASR with chunk loop**

Replace the single `transcriber.transcribe(audio_path=audio_path, chunks=chunks, ...)` call with:

```python
    chunk_ms = 30_000
    overlap_ms = 500
    chunks = build_fixed_chunks(request.duration_ms, chunk_ms=chunk_ms, overlap_ms=overlap_ms)
    task_cache_dir = asr_task_cache_dir(request.project_dir, request.task_id)
    manifest = build_chunk_manifest(
        task_id=request.task_id,
        audio_path=audio_path,
        source_video_path=request.source_video,
        duration_ms=request.duration_ms,
        chunk_ms=chunk_ms,
        overlap_ms=overlap_ms,
        chunks=chunks,
    )
    write_manifest(task_cache_dir / "manifest.json", manifest)

    chunk_documents = []
    resume_cache_dir = (
        asr_task_cache_dir(request.project_dir, request.resume_from_task_id)
        if request.resume_from_task_id is not None
        else None
    )
    total_chunks = len(chunks)
    for position, chunk in enumerate(chunks, start=1):
        record = manifest.chunks[position - 1]
        output_path = chunk_result_path(task_cache_dir, record.chunk_id)
        resume_path = chunk_result_path(resume_cache_dir, record.chunk_id) if resume_cache_dir is not None else None

        if valid_chunk_result_exists(output_path, chunk_id=record.chunk_id):
            chunk_documents.append(read_chunk_result(output_path))
        elif resume_path is not None and valid_chunk_result_exists(resume_path, chunk_id=record.chunk_id):
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(resume_path, output_path)
            chunk_documents.append(read_chunk_result(output_path))
        else:
            raise_if_canceled()
            if progress_callback is not None:
                progress_callback(0.3 + ((position - 1) / max(total_chunks, 1)) * 0.55, f"Transcribing chunk {position} of {total_chunks}")
            chunk_result = transcriber.transcribe(
                audio_path=audio_path,
                chunks=[chunk],
                progress_callback=None,
                cancel_token=cancel_token,
            )
            write_chunk_result(output_path, chunk_id=record.chunk_id, result=chunk_result)
            chunk_documents.append(read_chunk_result(output_path))

        if progress_callback is not None:
            progress_callback(0.3 + (position / max(total_chunks, 1)) * 0.55, f"Completed chunk {position} of {total_chunks}")

    asr_result = merge_chunk_results(chunk_documents)
```

Keep the existing subtitle document construction after `asr_result`.

- [ ] **Step 6: Run long ASR tests**

```powershell
python -m pytest worker/tests/pipeline/test_long_asr.py worker/tests/pipeline/test_core.py -q
```

Expected: all pipeline tests pass.

- [ ] **Step 7: Commit**

```powershell
git add worker/diplomat_worker/pipeline/core.py worker/tests/pipeline/test_long_asr.py
git commit -m "feat(asr): run analysis through resumable chunks"
```

## Task 6: Wire Retry Resume Through Analysis Tasks

**Files:**
- Modify: `worker/diplomat_worker/tasks/analysis.py`
- Modify: `worker/tests/tasks/test_analysis_jobs.py`

- [ ] **Step 1: Add failing retry reuse test**

Append to `worker/tests/tasks/test_analysis_jobs.py`:

```python
class CancelAfterOneChunkTranscriber(FakeTranscriber):
    def __init__(self) -> None:
        super().__init__(language="zh")
        self.calls = 0

    def transcribe(self, audio_path, chunks, progress_callback=None, cancel_token=None):
        self.calls += 1
        if self.calls > 1:
            from diplomat_worker.asr.base import AsrCanceled

            raise AsrCanceled("Analysis canceled")
        return super().transcribe(audio_path, chunks, progress_callback, cancel_token)


def test_retry_canceled_analysis_reuses_completed_chunk_outputs(tmp_path: Path) -> None:
    transcribers: list[FakeTranscriber] = []

    def factory(config: AsrModelConfig, fallback_language: str):
        transcriber = CancelAfterOneChunkTranscriber() if not transcribers else FakeTranscriber(language="zh")
        transcribers.append(transcriber)
        return transcriber

    runtime = make_runtime(tmp_path, transcriber_factory=factory)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)
    first_task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    assert runtime.store.get_task(first_task.task_id).status == "canceled"

    retry = manager.retry_task(first_task.task_id)
    manager.run_pending_once()

    assert runtime.store.get_task(retry.task_id).status == "completed"
    project = runtime.store.get_project(project_id)
    first_chunk = project.project_dir / "cache" / "asr" / first_task.task_id / "chunks" / "chunk-000001.json"
    retry_chunk = project.project_dir / "cache" / "asr" / retry.task_id / "chunks" / "chunk-000001.json"
    assert first_chunk.exists()
    assert retry_chunk.exists()
```

- [ ] **Step 2: Run test and confirm failure**

```powershell
python -m pytest worker/tests/tasks/test_analysis_jobs.py::test_retry_canceled_analysis_reuses_completed_chunk_outputs -q
```

Expected: retry does not pass `resume_from_task_id`, so the first chunk is not reused.

- [ ] **Step 3: Add resume task id before queueing retry**

Change `create_analysis_job` signature in `worker/diplomat_worker/tasks/analysis.py`:

```python
    def create_analysis_job(
        self,
        project_id: str,
        config: AsrModelConfig,
        resume_from_task_id: str | None = None,
    ) -> TaskRecord:
```

Before `create_task`, build the payload:

```python
        request_payload = config.to_request_payload()
        if resume_from_task_id is not None:
            request_payload = {**request_payload, "resumeTaskId": resume_from_task_id}
```

Pass `request_payload=request_payload` into `self.runtime.store.create_task(...)`.

In `retry_task`, replace the final return with:

```python
        retry_config = config or AsrModelConfig.from_request_payload(task.request_payload)
        return self.create_analysis_job(
            task.project_id,
            retry_config,
            resume_from_task_id=task.task_id,
        )
```

- [ ] **Step 4: Pass resume id into core pipeline**

In `_run_task`, parse:

```python
            resume_from_task_id = task.request_payload.get("resumeTaskId")
```

When constructing `CorePipelineInput`, pass:

```python
                    task_id=task.task_id,
                    resume_from_task_id=resume_from_task_id,
```

- [ ] **Step 5: Run task tests**

```powershell
python -m pytest worker/tests/tasks/test_analysis_jobs.py -q
```

Expected: task tests pass.

- [ ] **Step 6: Commit**

```powershell
git add worker/diplomat_worker/tasks/analysis.py worker/tests/tasks/test_analysis_jobs.py
git commit -m "feat(tasks): resume analysis retries from completed chunks"
```

## Task 7: Full Verification And 0.32 Stage Gate

**Files:**
- Create: `docs/development/0-32-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

```powershell
python -m pytest worker/tests/asr/test_chunk_store.py worker/tests/asr/test_merge.py worker/tests/asr/test_faster_whisper.py worker/tests/pipeline/test_long_asr.py worker/tests/tasks/test_analysis_jobs.py -q
python -m pytest worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/AnalysisInspector.test.tsx src/pages/WorkbenchPage.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full repository verification**

```powershell
.\scripts\check.ps1
```

Expected: all JavaScript, Rust, TypeScript, and Python checks pass with nonzero propagation still active.

- [ ] **Step 3: Write stage gate review**

Create `docs/development/0-32-stage-gate-review.md`:

```markdown
# Diplomat 0.32 Stage Gate Review

Review date: 2026-06-15 Asia/Shanghai local build time

Stage: 0.32

Decision: accepted for merge to `main`.

## Scope Completed

- Long-media ASR uses a manifest under `cache/asr/<task-id>/manifest.json`.
- ASR chunk outputs are written atomically under `cache/asr/<task-id>/chunks/`.
- Retry can reuse valid chunk outputs from a previous canceled or failed task.
- Chunk outputs are merged deterministically into monotonic subtitle lines.
- Faster-whisper receives single-chunk `clip_timestamps` for chunk execution.

## Verification Evidence

- Focused ASR and task tests: passed.
- `.\scripts\check.ps1`: passed.

## Known Limitations

- Manual real-media smoke must still be recorded before public release.
- Speaker diarization and translation glossary consistency remain 0.34+ work.

## Decision

0.32 meets the repository merge gate for recoverable long-media ASR.
```

- [ ] **Step 4: Commit stage gate**

```powershell
git add docs/development/0-32-stage-gate-review.md
git commit -m "docs: record 0.32 stage gate review"
```

- [ ] **Step 5: Merge and push after acceptance**

```powershell
git switch main
git merge --no-ff codex/0.32-long-media-asr -m "merge: complete 0.32 long-media asr"
git push origin main
```

Expected: merge and push succeed. Start 0.33 planning only after the push succeeds.

## Self-Review

- Spec coverage: manifest storage, chunk outputs, cancellation persistence, retry reuse, restart-compatible persisted outputs, merge monotonicity, overlap de-duplication, faster-whisper chunk clipping, focused verification, and stage gate are covered.
- Marker scan: no incomplete-work markers remain, and every task includes concrete files, commands, and expected outcomes.
- Type consistency: `task_id`, `resume_from_task_id`, `AsrChunkManifest`, `AsrChunkResultDocument`, `chunk_result_path`, and `merge_chunk_results` are introduced before use.
