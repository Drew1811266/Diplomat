from pathlib import Path

import pytest

from diplomat_worker.export.text_subtitles import (
    ExportValidationError,
    ass_color,
    format_ass_timestamp,
    format_vtt_timestamp,
    subtitle_document_to_ass,
    subtitle_document_to_vtt,
    validate_subtitle_document_for_export,
    write_subtitle_export,
)
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine, SubtitleStyle


def make_style(**overrides) -> SubtitleStyle:
    payload = {
        "id": "default",
        "name": "Default",
        "fontFamily": "Arial",
        "fontSize": 42,
        "primaryColor": "#ffffff",
        "secondaryColor": "#14b8a6",
        "strokeWidth": 2,
        "shadow": 1,
        "position": "bottom",
        "marginV": 48,
        "alignment": "center",
        "bilingualLayout": "source_top",
        "lineSpacing": 1.1,
        "backgroundBar": False,
        "backgroundColor": "#000000cc",
        "safeAreaMargin": 32,
    }
    payload.update(overrides)
    return SubtitleStyle.model_validate(payload)


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


def make_document(*, lines: list[SubtitleLine] | None = None, style: SubtitleStyle | None = None) -> SubtitleDocument:
    return SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=10_000,
        styles=[style or make_style()],
        lines=lines
        or [
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
                end_ms=3000,
                source_text=" 你好 ",
                translated_text=" Hello ",
            ),
        ],
    )


def test_format_vtt_timestamp_uses_dot_milliseconds() -> None:
    assert format_vtt_timestamp(3_723_045) == "01:02:03.045"


def test_format_ass_timestamp_uses_centiseconds_without_leading_hour_zero() -> None:
    assert format_ass_timestamp(3_723_045) == "1:02:03.04"


def test_ass_color_converts_css_hex_to_ass_bbggrr_alpha_order() -> None:
    assert ass_color("#14b8a6") == "&H00A6B814"


def test_vtt_export_writes_header_dot_timestamps_sorted_cues_and_bilingual_text() -> None:
    vtt = subtitle_document_to_vtt(make_document(), mode="bilingual")

    assert vtt == (
        "WEBVTT\n"
        "\n"
        "00:00:01.000 --> 00:00:03.000\n"
        "你好\n"
        "Hello\n"
        "\n"
        "00:00:03.000 --> 00:00:04.500\n"
        "世界\n"
        "World\n"
    )


def test_vtt_target_export_falls_back_to_source_when_translation_missing() -> None:
    document = make_document(
        lines=[
            make_line(
                id="line-1",
                start_ms=1000,
                end_ms=3000,
                source_text=" 你好 ",
                translated_text=" ",
            )
        ]
    )

    assert "你好" in subtitle_document_to_vtt(document, mode="target")


def test_ass_export_writes_style_and_dialogue_rows() -> None:
    ass = subtitle_document_to_ass(make_document(), mode="bilingual")

    assert "[V4+ Styles]" in ass
    assert "Style: Default,Arial,42" in ass
    assert "[Events]" in ass
    assert "Dialogue: 0,0:00:01.00,0:00:03.00,Default" in ass
    assert "你好\\NHello" in ass


def test_ass_export_uses_target_top_layout_when_configured() -> None:
    document = make_document(style=make_style(bilingualLayout="target_top"))

    ass = subtitle_document_to_ass(document, mode="bilingual")

    assert "Hello\\N你好" in ass


def test_ass_export_skips_empty_rendered_lines() -> None:
    document = make_document(
        lines=[
            make_line(
                id="line-1",
                start_ms=1000,
                end_ms=3000,
                source_text=" ",
                translated_text="\t",
            )
        ]
    )

    assert "Dialogue:" not in subtitle_document_to_ass(document, mode="bilingual")


def test_export_validation_blocks_overlaps() -> None:
    document = make_document(
        lines=[
            make_line(id="line-1", start_ms=1000, end_ms=3000, source_text="你好"),
            make_line(id="line-2", start_ms=2500, end_ms=3500, source_text="世界"),
        ]
    )

    with pytest.raises(ExportValidationError) as exc:
        validate_subtitle_document_for_export(document)

    assert any(issue.code == "overlap_previous" for issue in exc.value.issues)
    assert any(issue.code == "overlap_next" for issue in exc.value.issues)


def test_export_validation_returns_warnings_for_short_cues() -> None:
    document = make_document(
        lines=[make_line(id="line-1", start_ms=1000, end_ms=1200, source_text="你好")]
    )

    warnings = validate_subtitle_document_for_export(document)

    assert warnings[0].code == "too_short"
    assert warnings[0].severity == "warning"


def test_export_validation_returns_warnings_for_overlong_text() -> None:
    document = make_document(
        lines=[
            make_line(
                id="line-1",
                start_ms=1000,
                end_ms=2000,
                source_text="This line has far too many readable characters for one second",
            )
        ]
    )

    warnings = validate_subtitle_document_for_export(document)

    assert any(issue.code == "overlong_text" for issue in warnings)


def test_write_subtitle_export_uses_requested_format(tmp_path: Path) -> None:
    output_path = tmp_path / "nested" / "subtitle.vtt"

    result = write_subtitle_export(make_document(), output_path, "vtt", "target")

    assert result == output_path
    assert output_path.read_text(encoding="utf-8").startswith("WEBVTT")


def test_write_subtitle_export_rejects_unsupported_format(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="Unsupported subtitle export format: txt"):
        write_subtitle_export(make_document(), tmp_path / "subtitle.txt", "txt", "target")
