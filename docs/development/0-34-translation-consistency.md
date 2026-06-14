# Diplomat 0.34 Long-Video Translation Consistency

Date: 2026-06-14

Stage: 0.34

## Objective

Improve long-video translation quality and reliability by translating in recoverable batches with glossary support, context windows, incremental saves, and global consistency review.

## Deliverables

- Project glossary schema.
- Glossary extraction from source subtitles.
- User-lockable glossary terms.
- Translation batch manifest and per-batch output files.
- Batch translation with bounded context.
- Incremental save behavior for completed batches.
- Consistency review pass for terminology drift, empty translations, duplicate translations, and overlong subtitles.
- UI surfaces for glossary review and consistency warnings.
- Tests for glossary, batch resume, and consistency issue detection.

## Non-Goals

- Do not promise broad multilingual terminology quality.
- Do not introduce a cloud terminology service.
- Do not require an LLM for default glossary extraction.
- Do not make glossary review mandatory before every translation.

## Architecture

Glossary data belongs to the project store and is referenced by translation jobs. The source subtitle document remains the canonical source text. Translation batches are generated from saved source subtitles plus a snapshot of glossary terms.

Batch outputs live under:

```text
<project>/cache/translation/<task-id>/manifest.json
<project>/cache/translation/<task-id>/batches/batch-000001.json
```

The final consistency pass produces structured warnings that can be shown in the Workbench and export inspector.

## Acceptance Criteria

- A glossary can be generated from a saved subtitle document.
- Users can lock preferred translations for terms.
- Translation batches include glossary terms and bounded context.
- Completed batch outputs survive cancellation and retry.
- Consistency review detects at least terminology drift, empty translation, duplicate output, and likely overlong bilingual lines.
- Export warns when consistency blockers remain.
- Full repository verification passes.

## Focused Verification

```powershell
python -m pytest worker/tests/translation worker/tests/tasks/test_translation_jobs.py worker/tests/storage/test_project_store.py -q
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/TranslationInspector.test.tsx src/pages/WorkbenchPage.test.tsx
```

Manual smoke:

1. Open a project with at least 50 saved subtitle lines.
2. Generate glossary candidates.
3. Lock two preferred translations.
4. Run translation in batches.
5. Cancel and retry after one batch completes.
6. Confirm completed batches are reused.
7. Run consistency review and inspect warnings.

## Stage Gate

0.34 is accepted when long-video translation can be resumed and terminology consistency is visible before export.

