from diplomat_worker.asr.base import AsrSegment, AsrWord
from diplomat_worker.pipeline.subtitle_cues import segment_asr_segments_to_cues


def test_splits_multisentence_asr_segment_into_sentence_cues() -> None:
    segment = AsrSegment(
        id="segment-1",
        start_ms=0,
        end_ms=6000,
        text="Hello world. This is the second sentence.",
        words=[
            AsrWord("Hello", 0, 700, 0.9),
            AsrWord("world.", 700, 1400, 0.9),
            AsrWord("This", 3000, 3400, 0.9),
            AsrWord("is", 3400, 3700, 0.9),
            AsrWord("the", 3700, 4000, 0.9),
            AsrWord("second", 4000, 4800, 0.9),
            AsrWord("sentence.", 4800, 5600, 0.9),
        ],
    )

    cues = segment_asr_segments_to_cues([segment])

    assert [cue.text for cue in cues] == ["Hello world.", "This is the second sentence."]
    assert [(cue.start_ms, cue.end_ms) for cue in cues] == [(0, 1400), (3000, 5600)]
    assert [[word.text for word in cue.words] for cue in cues] == [
        ["Hello", "world."],
        ["This", "is", "the", "second", "sentence."],
    ]


def test_uses_proportional_timing_when_word_timing_is_missing() -> None:
    segment = AsrSegment(
        id="segment-1",
        start_ms=1000,
        end_ms=5000,
        text="第一句话。第二句话。",
        words=[],
    )

    cues = segment_asr_segments_to_cues([segment])

    assert [cue.text for cue in cues] == ["第一句话。", "第二句话。"]
    assert cues[0].start_ms == 1000
    assert cues[0].end_ms == 3000
    assert cues[1].start_ms == 3000
    assert cues[1].end_ms == 5000
