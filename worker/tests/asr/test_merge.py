from diplomat_worker.asr.base import AsrResult, AsrSegment, AsrWord
from diplomat_worker.asr.chunk_store import AsrChunkResultDocument
from diplomat_worker.asr.merge import merge_chunk_results


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
