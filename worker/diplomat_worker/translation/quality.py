from __future__ import annotations

from diplomat_worker.schemas.subtitle import (
    SubtitleLine,
    TranslationGlossaryEntry,
    TranslationQualityIssue,
)


def audit_translation_quality(
    lines: list[SubtitleLine],
    glossary: list[TranslationGlossaryEntry],
    *,
    source_language: str,
    target_language: str,
) -> dict[str, list[TranslationQualityIssue]]:
    matching_terms = [
        term
        for term in glossary
        if term.source_language == source_language and term.target_language == target_language
    ]
    issues_by_line: dict[str, list[TranslationQualityIssue]] = {}
    for line in lines:
        line_issues: list[TranslationQualityIssue] = []
        for term in matching_terms:
            if not _contains(line.source_text, term.source_text, term.case_sensitive):
                continue
            if _contains(line.translated_text, term.target_text, term.case_sensitive):
                continue
            line_issues.append(
                TranslationQualityIssue(
                    code="glossary_term_missing",
                    severity="warning",
                    message=(
                        f'Expected translation for "{term.source_text}" '
                        f'to include "{term.target_text}".'
                    ),
                    termId=term.id,
                )
            )
        if line_issues:
            issues_by_line[line.id] = line_issues
    return issues_by_line


def apply_translation_quality(
    lines: list[SubtitleLine],
    glossary: list[TranslationGlossaryEntry],
    *,
    source_language: str,
    target_language: str,
) -> list[SubtitleLine]:
    issues_by_line = audit_translation_quality(
        lines,
        glossary,
        source_language=source_language,
        target_language=target_language,
    )
    return [
        line.model_copy(
            update={"translation_quality_issues": issues_by_line.get(line.id, [])}
        )
        for line in lines
    ]


def _contains(text: str, needle: str, case_sensitive: bool) -> bool:
    if case_sensitive:
        return needle in text
    return needle.casefold() in text.casefold()
