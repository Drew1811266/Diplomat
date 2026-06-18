from __future__ import annotations

from dataclasses import dataclass

from diplomat_worker.media.audio import AudioChunk, build_fixed_chunks


@dataclass(frozen=True)
class SpeechActivity:
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class AudioSegmentationConfig:
    target_chunk_ms: int = 45_000
    max_chunk_ms: int = 90_000
    min_silence_gap_ms: int = 700
    padding_ms: int = 250
    fallback_chunk_ms: int = 30_000
    fallback_overlap_ms: int = 500


def normalize_speech_activity(
    duration_ms: int,
    activity: list[SpeechActivity],
    *,
    min_silence_gap_ms: int,
) -> list[SpeechActivity]:
    if duration_ms <= 0:
        return []
    if min_silence_gap_ms < 0:
        raise ValueError("min_silence_gap_ms must be greater than or equal to 0")

    clamped = []
    for item in activity:
        start_ms = max(0, min(duration_ms, item.start_ms))
        end_ms = max(0, min(duration_ms, item.end_ms))
        if end_ms > start_ms:
            clamped.append(SpeechActivity(start_ms=start_ms, end_ms=end_ms))

    ordered = sorted(clamped, key=lambda item: (item.start_ms, item.end_ms))
    merged: list[SpeechActivity] = []
    for item in ordered:
        if not merged:
            merged.append(item)
            continue
        previous = merged[-1]
        gap_ms = item.start_ms - previous.end_ms
        if gap_ms < min_silence_gap_ms:
            merged[-1] = SpeechActivity(
                start_ms=previous.start_ms,
                end_ms=max(previous.end_ms, item.end_ms),
            )
            continue
        merged.append(item)
    return merged


def build_speech_aware_chunks(
    duration_ms: int,
    activity: list[SpeechActivity],
    config: AudioSegmentationConfig | None = None,
) -> list[AudioChunk]:
    active_config = config or AudioSegmentationConfig()
    _validate_config(active_config)
    if duration_ms <= 0:
        return []

    speech = normalize_speech_activity(
        duration_ms,
        activity,
        min_silence_gap_ms=active_config.min_silence_gap_ms,
    )
    if not speech:
        return build_fixed_chunks(
            duration_ms,
            chunk_ms=active_config.fallback_chunk_ms,
            overlap_ms=active_config.fallback_overlap_ms,
        )

    ranges = [
        SpeechActivity(
            start_ms=max(0, item.start_ms - active_config.padding_ms),
            end_ms=min(duration_ms, item.end_ms + active_config.padding_ms),
        )
        for item in speech
    ]

    chunk_ranges: list[SpeechActivity] = []
    current = ranges[0]
    for item in ranges[1:]:
        proposed = SpeechActivity(start_ms=current.start_ms, end_ms=item.end_ms)
        if proposed.end_ms - proposed.start_ms <= active_config.target_chunk_ms:
            current = proposed
            continue

        chunk_ranges.extend(_split_range(current, max_chunk_ms=active_config.max_chunk_ms))
        current = item
    chunk_ranges.extend(_split_range(current, max_chunk_ms=active_config.max_chunk_ms))

    return [
        AudioChunk(index=index, start_ms=item.start_ms, end_ms=item.end_ms)
        for index, item in enumerate(chunk_ranges)
        if item.end_ms > item.start_ms
    ]


def _split_range(item: SpeechActivity, *, max_chunk_ms: int) -> list[SpeechActivity]:
    if item.end_ms - item.start_ms <= max_chunk_ms:
        return [item]

    ranges = []
    start_ms = item.start_ms
    while start_ms < item.end_ms:
        end_ms = min(start_ms + max_chunk_ms, item.end_ms)
        ranges.append(SpeechActivity(start_ms=start_ms, end_ms=end_ms))
        start_ms = end_ms
    return ranges


def _validate_config(config: AudioSegmentationConfig) -> None:
    if config.target_chunk_ms <= 0:
        raise ValueError("target_chunk_ms must be greater than 0")
    if config.max_chunk_ms <= 0:
        raise ValueError("max_chunk_ms must be greater than 0")
    if config.max_chunk_ms < config.target_chunk_ms:
        raise ValueError("max_chunk_ms must be greater than or equal to target_chunk_ms")
    if config.min_silence_gap_ms < 0:
        raise ValueError("min_silence_gap_ms must be greater than or equal to 0")
    if config.padding_ms < 0:
        raise ValueError("padding_ms must be greater than or equal to 0")
    if config.fallback_chunk_ms <= 0:
        raise ValueError("fallback_chunk_ms must be greater than 0")
    if config.fallback_overlap_ms < 0:
        raise ValueError("fallback_overlap_ms must be greater than or equal to 0")
