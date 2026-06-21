from dataclasses import dataclass
import re

from diplomat_worker.asr.base import AsrSegment, AsrWord


SENTENCE_PATTERN = re.compile(r"[^.!?。？！]+[.!?。？！]+(?:[\"'”’）)]*)|[^.!?。？！]+$")
MAX_CUE_CHARS = 72
MIN_CUE_DURATION_MS = 500


@dataclass(frozen=True)
class SubtitleCue:
    source_segment_id: str
    start_ms: int
    end_ms: int
    text: str
    words: list[AsrWord]


@dataclass(frozen=True)
class TextSpan:
    start: int
    end: int
    text: str


@dataclass(frozen=True)
class WordSpan:
    start: int
    end: int
    word: AsrWord


def segment_asr_segments_to_cues(segments: list[AsrSegment]) -> list[SubtitleCue]:
    cues: list[SubtitleCue] = []
    for segment in segments:
        spans = _sentence_spans(segment.text)
        if len(spans) == 1 and len(spans[0].text) > MAX_CUE_CHARS:
            spans = _split_long_span(spans[0])

        word_spans = _word_spans(segment.text, segment.words)
        for index, span in enumerate(spans):
            words = _words_for_span(span, word_spans)
            start_ms, end_ms = _timing_for_span(
                segment=segment,
                span=span,
                spans=spans,
                span_index=index,
                words=words,
            )
            if end_ms <= start_ms:
                end_ms = min(segment.end_ms, start_ms + 1)
            cues.append(
                SubtitleCue(
                    source_segment_id=segment.id,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    text=span.text,
                    words=words,
                )
            )
    return cues


def _sentence_spans(text: str) -> list[TextSpan]:
    stripped = text.strip()
    if not stripped:
        return []

    leading_offset = len(text) - len(text.lstrip())
    spans: list[TextSpan] = []
    for match in SENTENCE_PATTERN.finditer(stripped):
        raw = match.group(0)
        sentence = raw.strip()
        if not sentence:
            continue
        start = leading_offset + match.start() + len(raw) - len(raw.lstrip())
        end = start + len(sentence)
        spans.append(TextSpan(start=start, end=end, text=sentence))
    return spans or [TextSpan(start=leading_offset, end=leading_offset + len(stripped), text=stripped)]


def _split_long_span(span: TextSpan) -> list[TextSpan]:
    words = span.text.split()
    if len(words) <= 1:
        return [span]

    spans: list[TextSpan] = []
    cursor = span.start
    active: list[str] = []
    active_start = span.start
    for word in words:
        candidate = " ".join([*active, word])
        if active and len(candidate) > MAX_CUE_CHARS:
            text = " ".join(active)
            spans.append(TextSpan(start=active_start, end=active_start + len(text), text=text))
            active_start = cursor
            active = [word]
        else:
            active.append(word)
        cursor += len(word) + 1
    if active:
        text = " ".join(active)
        spans.append(TextSpan(start=active_start, end=active_start + len(text), text=text))
    return spans


def _word_spans(text: str, words: list[AsrWord]) -> list[WordSpan]:
    spans: list[WordSpan] = []
    cursor = 0
    for word in words:
        index = text.find(word.text, cursor)
        if index < 0:
            return []
        end = index + len(word.text)
        spans.append(WordSpan(start=index, end=end, word=word))
        cursor = end
    return spans


def _words_for_span(span: TextSpan, word_spans: list[WordSpan]) -> list[AsrWord]:
    return [
        word_span.word
        for word_span in word_spans
        if word_span.start < span.end and word_span.end > span.start
    ]


def _timing_for_span(
    *,
    segment: AsrSegment,
    span: TextSpan,
    spans: list[TextSpan],
    span_index: int,
    words: list[AsrWord],
) -> tuple[int, int]:
    if words:
        return words[0].start_ms, words[-1].end_ms

    total_chars = max(1, sum(len(item.text) for item in spans))
    prior_chars = sum(len(item.text) for item in spans[:span_index])
    duration = max(1, segment.end_ms - segment.start_ms)
    start_ms = segment.start_ms + round((prior_chars / total_chars) * duration)
    end_ms = segment.start_ms + round(((prior_chars + len(span.text)) / total_chars) * duration)
    if end_ms - start_ms < MIN_CUE_DURATION_MS and duration >= MIN_CUE_DURATION_MS:
        end_ms = min(segment.end_ms, start_ms + MIN_CUE_DURATION_MS)
    return start_ms, end_ms
