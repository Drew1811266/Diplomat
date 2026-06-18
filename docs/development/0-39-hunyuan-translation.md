# Diplomat 0.39 Hunyuan Translation

Date: 2026-06-18

Stage: 0.39

## Objective

Integrate `tencent/Hunyuan-MT-7B-fp8` as the 0.4 real translation model and run translation only after ASR memory is released. This stage addresses the translation portion of the second major 0.4 task and extends the end-to-end workflow required by the third task.

## Product Outcome

Diplomat can translate subtitle batches with the Hunyuan model through an isolated translation runner, preserve completed batches, use glossary and hotword context, and release translation memory after completion.

## Scope

- Add Hunyuan translation provider configuration.
- Add Hunyuan prompt templates for Chinese-English and general translation.
- Add isolated translation child-process runner.
- Add translation memory lifecycle evidence hooks.
- Add glossary and hotword prompt injection.
- Add batch result persistence and retry tests for the Hunyuan path.
- Add UI readiness states for Hunyuan model availability and license acceptance.

## Non-Goals

- Do not integrate `Hy-MT2-30B-A3B` in 0.39.
- Do not require cloud translation.
- Do not commit Hunyuan model weights.
- Do not remove existing fake, CTranslate2, or local LLM development providers.

## Acceptance Criteria

- Hunyuan provider is selectable when manifest and local readiness allow it.
- Missing Hunyuan model files produce clear actionable errors.
- Hunyuan prompt generation is tested.
- Batch translation persistence works for the Hunyuan runner.
- Translation starts only after ASR stage completion.
- Translation memory evidence can be written.
- Full repository verification passes.

## Verification

Focused verification:

```powershell
python -m pytest worker/tests/translation worker/tests/tasks/test_translation_jobs.py worker/tests/models -q
corepack pnpm --dir apps/web test -- TranslationInspector ModelsPage
```

Opt-in real-model verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.39-hunyuan-translation.ps1 -ModelDir .\models\dev\translation\tencent--Hunyuan-MT-7B-fp8 -SubtitlePath <subtitle-json>
```

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.39 can merge only when the Hunyuan translation path is wired through the product, default tests remain model-free, and opt-in real-model status is recorded honestly.

