from diplomat_worker.schemas.subtitle import (
    AiOrigin,
    SubtitleLine,
    TranslationGlossaryEntry,
)
from diplomat_worker.translation.quality import audit_translation_quality


def make_line(source_text: str, translated_text: str) -> SubtitleLine:
    return SubtitleLine(
        id="line-1",
        startMs=0,
        endMs=1000,
        speakerId=None,
        sourceLanguage="en",
        targetLanguage="zh",
        sourceText=source_text,
        translatedText=translated_text,
        words=[],
        styleOverrides={},
        reviewStatus="draft",
        aiOrigin=AiOrigin(engine="fixture", model="fixture"),
        translationStatus="translated",
        translationOrigin=None,
        translationError=None,
        notes="",
    )


def test_audit_flags_missing_glossary_target() -> None:
    glossary = [
        TranslationGlossaryEntry(
            id="term-1",
            sourceText="GPU",
            targetText="GPU",
            sourceLanguage="en",
            targetLanguage="zh",
            caseSensitive=False,
        )
    ]

    issues = audit_translation_quality(
        [make_line("GPU acceleration matters", "图形处理器加速很重要")],
        glossary,
        source_language="en",
        target_language="zh",
    )

    assert issues["line-1"][0].code == "glossary_term_missing"
    assert issues["line-1"][0].term_id == "term-1"


def test_audit_ignores_lines_with_required_target() -> None:
    glossary = [
        TranslationGlossaryEntry(
            id="term-1",
            sourceText="GPU",
            targetText="GPU",
            sourceLanguage="en",
            targetLanguage="zh",
            caseSensitive=False,
        )
    ]

    issues = audit_translation_quality(
        [make_line("GPU acceleration matters", "GPU 加速很重要")],
        glossary,
        source_language="en",
        target_language="zh",
    )

    assert issues == {}
