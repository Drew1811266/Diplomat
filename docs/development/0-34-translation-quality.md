# Diplomat 0.34 Translation Quality Development Document

Review date: 2026-06-15 Asia/Shanghai local planning time

Target stage: 0.34

## Product Goal

0.34 adds a deterministic terminology and translation quality layer for long-video workflows. The goal is to let an operator define project translation glossary terms, run long translation jobs with those terms attached, and surface line-level quality issues when translated text does not include the required target term.

This stage does not add a second LLM judge or automatic semantic rewriting. It builds the stable substrate needed before 0.35 desktop release hardening: glossary persistence, payload propagation, deterministic audit, line-level issue storage, and UI visibility.

## Scope

- Persist glossary entries with translation settings.
- Include glossary entries in translation job and retry payloads.
- Audit translated subtitle lines against glossary entries after translation.
- Store line-level translation quality issues in the subtitle document.
- Show quality issue counts in the subtitle grid and issue details in the line inspector.
- Add a simple translation inspector glossary editor using one `source => target` entry per line.
- Keep the implementation local and deterministic so it works without network access or extra model downloads.

## Out Of Scope

- Semantic translation scoring.
- Cross-language named-entity extraction.
- LLM-based rewrite or adjudication.
- Automatic source-term discovery from long videos.
- A dedicated project glossary management page.

## Architecture

Glossary entries live in translation settings because they are part of the translation run configuration and should survive project backup/restore. Quality issues live on subtitle lines because they are review artifacts tied to translated output.

The Worker owns the quality audit implementation in `diplomat_worker.translation.quality`. The translation job manager calls it after translation results are merged into the document. The frontend edits glossary entries in the Translation inspector and displays generated line issues in existing review surfaces.

## Data Model

Glossary entry:

```json
{
  "id": "term-1",
  "sourceText": "OpenAI",
  "targetText": "OpenAI",
  "sourceLanguage": "en",
  "targetLanguage": "zh",
  "caseSensitive": false
}
```

Line quality issue:

```json
{
  "code": "glossary_term_missing",
  "severity": "warning",
  "message": "Expected translation for \"GPU\" to include \"GPU\".",
  "termId": "term-1"
}
```

## Stage Gate

0.34 is accepted only if focused schema, storage, quality engine, translation task, API, and UI tests pass, followed by the full repository `scripts/check.ps1` gate. A real long-video translation smoke remains recommended before public release, but repository acceptance depends on deterministic automated coverage.
