from pathlib import Path

import pytest

from diplomat_worker.export import (
    format_srt_timestamp,
    subtitle_document_to_srt,
    write_srt_export,
)
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine, TranslationOrigin


def make_line(
    *,
    id: str,
    start_ms: int,
    end_ms: int,
    source_text: str,
    translated_text: str = "",
) -> SubtitleLine:
    return SubtitleLine(
        id=id,
        start_ms=start_ms,
        end_ms=end_ms,
        speaker_id=None,
        source_language="zh",
        target_language="en",
        source_text=source_text,
        translated_text=translated_text,
        words=[],
        style_overrides={},
        review_status="draft",
        ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
        notes="",
    )


def make_document() -> SubtitleDocument:
    return SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=10_000,
        lines=[
            make_line(
                id="line-2",
                start_ms=3000,
                end_ms=4500,
                source_text=" 世界 ",
                translated_text=" World ",
            ),
            make_line(
                id="line-1",
                start_ms=1000,
                end_ms=2500,
                source_text=" 你好 ",
                translated_text=" Hello ",
            ),
        ],
    )


def make_translated_document(translated_text: str) -> SubtitleDocument:
    return SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=2000,
        speakers=[],
        styles=[],
        lines=[
            SubtitleLine(
                id="line-1",
                start_ms=0,
                end_ms=1000,
                speaker_id=None,
                source_language="en",
                target_language="zh",
                source_text="Hello from source",
                translated_text=translated_text,
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                translation_status="translated" if translated_text else "not_requested",
                translation_origin=TranslationOrigin(provider="fake", model="fake-v1")
                if translated_text
                else None,
                translation_error=None,
                notes="",
            )
        ],
    )


def test_format_srt_timestamp_formats_hours_minutes_seconds_and_milliseconds() -> None:
    assert format_srt_timestamp(3_723_045) == "01:02:03,045"


def test_format_srt_timestamp_rejects_negative_values() -> None:
    with pytest.raises(ValueError, match="milliseconds must be greater than or equal to 0"):
        format_srt_timestamp(-1)


def test_subtitle_document_to_srt_sorts_lines_and_renders_bilingual_text() -> None:
    assert subtitle_document_to_srt(make_document()) == (
        "1\n"
        "00:00:01,000 --> 00:00:02,500\n"
        "你好\n"
        "Hello\n"
        "\n"
        "2\n"
        "00:00:03,000 --> 00:00:04,500\n"
        "世界\n"
        "World\n"
    )


def test_subtitle_document_to_srt_target_mode_falls_back_to_source_text() -> None:
    document = SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=5000,
        lines=[
            make_line(
                id="line-1",
                start_ms=1000,
                end_ms=2500,
                source_text=" 你好 ",
                translated_text=" ",
            )
        ],
    )

    assert subtitle_document_to_srt(document, mode="target") == (
        "1\n"
        "00:00:01,000 --> 00:00:02,500\n"
        "你好\n"
    )


def test_target_srt_uses_translated_text_after_translation() -> None:
    srt = subtitle_document_to_srt(make_translated_document("Hello from translation"), "target")

    assert "Hello from translation" in srt
    assert "Hello from source" not in srt


def test_bilingual_srt_writes_source_and_target_after_translation() -> None:
    srt = subtitle_document_to_srt(make_translated_document("Hello from translation"), "bilingual")

    assert "Hello from source\nHello from translation" in srt


def test_target_srt_falls_back_to_source_when_target_is_empty_after_translation() -> None:
    srt = subtitle_document_to_srt(make_translated_document(""), "target")

    assert "Hello from source" in srt


def test_subtitle_document_to_srt_source_mode_exports_source_text_only() -> None:
    assert subtitle_document_to_srt(make_document(), mode="source") == (
        "1\n"
        "00:00:01,000 --> 00:00:02,500\n"
        "你好\n"
        "\n"
        "2\n"
        "00:00:03,000 --> 00:00:04,500\n"
        "世界\n"
    )


def test_subtitle_document_to_srt_rejects_unsupported_mode() -> None:
    with pytest.raises(ValueError, match="Unsupported SRT export mode: invalid"):
        subtitle_document_to_srt(make_document(), mode="invalid")


def test_write_srt_export_creates_parent_directories(tmp_path: Path) -> None:
    output_path = tmp_path / "nested" / "exports" / "captions.srt"

    result = write_srt_export(make_document(), output_path, mode="source")

    assert result == output_path
    assert output_path.read_text(encoding="utf-8") == (
        "1\n"
        "00:00:01,000 --> 00:00:02,500\n"
        "你好\n"
        "\n"
        "2\n"
        "00:00:03,000 --> 00:00:04,500\n"
        "世界\n"
    )


def test_subtitle_document_to_srt_skips_empty_rendered_lines() -> None:
    document = SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=5000,
        lines=[
            make_line(
                id="line-2",
                start_ms=3000,
                end_ms=4500,
                source_text=" ",
                translated_text="\t",
            ),
            make_line(
                id="line-1",
                start_ms=1000,
                end_ms=2500,
                source_text=" 你好 ",
                translated_text=" Hello ",
            ),
        ],
    )

    assert subtitle_document_to_srt(document) == (
        "1\n"
        "00:00:01,000 --> 00:00:02,500\n"
        "你好\n"
        "Hello\n"
    )
