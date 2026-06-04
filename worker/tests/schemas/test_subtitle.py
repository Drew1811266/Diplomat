import pytest
from pydantic import ValidationError

from diplomat_worker.schemas.subtitle import (
    AiOrigin,
    Speaker,
    SubtitleDocument,
    SubtitleLine,
    SubtitleStyle,
    WordTiming,
)


def make_document() -> SubtitleDocument:
    return SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=10_000,
        speakers=[
            Speaker(
                id="speaker-1",
                display_name="Speaker 1",
                color="#0D9488",
                style_id="default",
                merged_into=None,
            )
        ],
        styles=[
            SubtitleStyle(
                id="default",
                name="Default",
                font_family="Arial",
                font_size=36,
                primary_color="#FFFFFF",
                secondary_color="#14B8A6",
                stroke_width=3,
                shadow=1,
                position="bottom-center",
                margin_v=48,
                alignment="center",
                bilingual_layout="source-above-target",
                line_spacing=1.15,
            )
        ],
        lines=[
            SubtitleLine(
                id="line-1",
                start_ms=1000,
                end_ms=2500,
                speaker_id="speaker-1",
                source_language="zh",
                target_language="en",
                source_text="你好",
                translated_text="Hello",
                words=[WordTiming(text="你好", start_ms=1000, end_ms=2500, confidence=0.94)],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
            )
        ],
    )


def test_subtitle_document_serializes_with_camel_case_aliases() -> None:
    payload = make_document().model_dump(by_alias=True)

    assert payload["schemaVersion"] == "diplomat.subtitle.v1"
    assert payload["projectId"] == "project-1"
    assert payload["lines"][0]["startMs"] == 1000


def test_subtitle_line_rejects_invalid_timing() -> None:
    with pytest.raises(ValidationError):
        SubtitleLine(
            id="line-1",
            start_ms=3000,
            end_ms=2500,
            speaker_id=None,
            source_language="zh",
            target_language="en",
            source_text="bad",
            translated_text="bad",
            words=[],
            style_overrides={},
            review_status="draft",
            ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
            notes="",
        )
