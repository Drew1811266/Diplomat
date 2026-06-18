import pytest

from diplomat_worker.media.audio import AudioChunk
from diplomat_worker.pipeline.segmentation import (
    AudioSegmentationConfig,
    SpeechActivity,
    build_speech_aware_chunks,
    normalize_speech_activity,
)


def test_empty_speech_activity_falls_back_to_fixed_chunks() -> None:
    chunks = build_speech_aware_chunks(
        65_000,
        [],
        AudioSegmentationConfig(fallback_chunk_ms=30_000, fallback_overlap_ms=500),
    )

    assert chunks == [
        AudioChunk(index=0, start_ms=0, end_ms=30_000),
        AudioChunk(index=1, start_ms=29_500, end_ms=59_500),
        AudioChunk(index=2, start_ms=59_000, end_ms=65_000),
    ]


def test_micro_pauses_are_merged_before_chunking() -> None:
    normalized = normalize_speech_activity(
        20_000,
        [
            SpeechActivity(start_ms=1_000, end_ms=5_000),
            SpeechActivity(start_ms=5_500, end_ms=9_000),
            SpeechActivity(start_ms=11_000, end_ms=15_000),
        ],
        min_silence_gap_ms=700,
    )

    assert normalized == [
        SpeechActivity(start_ms=1_000, end_ms=9_000),
        SpeechActivity(start_ms=11_000, end_ms=15_000),
    ]


def test_chunk_boundaries_prefer_available_silence_gaps() -> None:
    chunks = build_speech_aware_chunks(
        40_000,
        [
            SpeechActivity(start_ms=1_000, end_ms=5_000),
            SpeechActivity(start_ms=9_000, end_ms=13_000),
            SpeechActivity(start_ms=25_000, end_ms=30_000),
        ],
        AudioSegmentationConfig(
            target_chunk_ms=15_000,
            max_chunk_ms=30_000,
            min_silence_gap_ms=700,
            padding_ms=100,
        ),
    )

    assert chunks == [
        AudioChunk(index=0, start_ms=900, end_ms=13_100),
        AudioChunk(index=1, start_ms=24_900, end_ms=30_100),
    ]


def test_long_continuous_speech_is_force_split_by_max_chunk_length() -> None:
    chunks = build_speech_aware_chunks(
        100_000,
        [SpeechActivity(start_ms=0, end_ms=100_000)],
        AudioSegmentationConfig(
            target_chunk_ms=30_000,
            max_chunk_ms=30_000,
            min_silence_gap_ms=700,
            padding_ms=0,
        ),
    )

    assert chunks == [
        AudioChunk(index=0, start_ms=0, end_ms=30_000),
        AudioChunk(index=1, start_ms=30_000, end_ms=60_000),
        AudioChunk(index=2, start_ms=60_000, end_ms=90_000),
        AudioChunk(index=3, start_ms=90_000, end_ms=100_000),
    ]


def test_segmentation_rejects_invalid_config() -> None:
    with pytest.raises(ValueError, match="target_chunk_ms"):
        build_speech_aware_chunks(
            10_000,
            [SpeechActivity(start_ms=0, end_ms=1_000)],
            AudioSegmentationConfig(target_chunk_ms=0),
        )

    with pytest.raises(ValueError, match="max_chunk_ms"):
        build_speech_aware_chunks(
            10_000,
            [SpeechActivity(start_ms=0, end_ms=1_000)],
            AudioSegmentationConfig(target_chunk_ms=30_000, max_chunk_ms=20_000),
        )
