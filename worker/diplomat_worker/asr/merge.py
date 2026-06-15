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
