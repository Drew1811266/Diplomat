import pytest
from pydantic import ValidationError

from diplomat_worker.schemas.subtitle import (
    AiOrigin,
    Speaker,
    SubtitleDocument,
    SubtitleLine,
    SubtitleStyle,
    TranslationGlossaryEntry,
    TranslationOrigin,
    TranslationQualityIssue,
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


def test_empty_style_overrides_serialize_as_empty_object() -> None:
    payload = make_document().model_dump(by_alias=True)

    assert payload["lines"][0]["styleOverrides"] == {}


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


def test_subtitle_document_rejects_empty_project_id() -> None:
    document = make_document()
    payload = document.model_dump()
    payload["project_id"] = ""

    with pytest.raises(ValidationError):
        SubtitleDocument(**payload)


def test_subtitle_line_rejects_negative_style_override_font_size() -> None:
    with pytest.raises(ValidationError):
        SubtitleLine(
            id="line-1",
            start_ms=1000,
            end_ms=2500,
            speaker_id="speaker-1",
            source_language="zh",
            target_language="en",
            source_text="bad",
            translated_text="bad",
            words=[],
            style_overrides={"fontSize": -1},
            review_status="draft",
            ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
            notes="",
        )


def test_subtitle_line_rejects_unknown_style_override_fields() -> None:
    with pytest.raises(ValidationError):
        SubtitleLine(
            id="line-1",
            start_ms=1000,
            end_ms=2500,
            speaker_id="speaker-1",
            source_language="zh",
            target_language="en",
            source_text="bad",
            translated_text="bad",
            words=[],
            style_overrides={"unexpected": "value"},
            review_status="draft",
            ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
            notes="",
        )


def make_line(**overrides) -> SubtitleLine:
    payload = {
        "id": "line-1",
        "startMs": 0,
        "endMs": 1200,
        "speakerId": "speaker-1",
        "sourceLanguage": "en",
        "targetLanguage": "zh",
        "sourceText": "Hello world",
        "translatedText": "",
        "words": [],
        "styleOverrides": {},
        "reviewStatus": "draft",
        "aiOrigin": {"engine": "fake-asr", "model": "fake-v1"},
        "notes": "",
    }
    payload.update(overrides)
    return SubtitleLine.model_validate(payload)


def test_subtitle_line_defaults_translation_metadata() -> None:
    line = make_line()

    assert line.translation_status == "not_requested"
    assert line.translation_origin is None
    assert line.translation_error is None

    payload = line.model_dump(by_alias=True)
    assert payload["translationStatus"] == "not_requested"
    assert payload["translationOrigin"] is None
    assert payload["translationError"] is None


def test_subtitle_line_accepts_generated_translation_metadata() -> None:
    line = make_line(
        translatedText="你好，世界",
        translationStatus="translated",
        translationOrigin={"provider": "fake", "model": "fake-v1"},
        translationError=None,
    )

    assert line.translation_status == "translated"
    assert line.translation_origin == TranslationOrigin(provider="fake", model="fake-v1")


def test_subtitle_line_accepts_translation_quality_issues() -> None:
    line = make_line(
        translationQualityIssues=[
            {
                "code": "glossary_term_missing",
                "severity": "warning",
                "message": 'Expected translation for "GPU" to include "GPU".',
                "termId": "term-1",
            }
        ]
    )

    assert line.translation_quality_issues == [
        TranslationQualityIssue(
            code="glossary_term_missing",
            severity="warning",
            message='Expected translation for "GPU" to include "GPU".',
            term_id="term-1",
        )
    ]


def test_translation_glossary_entry_serializes_camel_case() -> None:
    entry = TranslationGlossaryEntry(
        id="term-1",
        sourceText="GPU",
        targetText="GPU",
        sourceLanguage="en",
        targetLanguage="zh",
        caseSensitive=False,
    )

    assert entry.model_dump(by_alias=True) == {
        "id": "term-1",
        "sourceText": "GPU",
        "targetText": "GPU",
        "sourceLanguage": "en",
        "targetLanguage": "zh",
        "caseSensitive": False,
    }
