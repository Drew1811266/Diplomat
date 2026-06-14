# Diplomat 0.32 Recoverable Long-Media ASR

Date: 2026-06-14

Stage: 0.32

## Objective

Replace one-shot ASR execution with recoverable long-media transcription. One to three hour media must be processed through chunk manifests, chunk-level ASR outputs, resumable task state, and deterministic merge logic.

## Current Baseline

The Worker has a `build_fixed_chunks` helper, but the real faster-whisper provider currently receives the full extracted audio path in a single `model.transcribe()` call. Task status exists, but completed ASR chunk outputs are not persisted as resumable units.

## Deliverables

- Audio chunk manifest stored under project cache.
- Deterministic chunk identifiers, start/end offsets, overlap metadata, and checksum fields.
- ASR chunk result files written atomically.
- Task state that records current stage and completed chunks.
- Resume behavior after Worker restart or app reopen.
- Retry behavior for failed chunks.
- Merge logic for global timestamps, overlap de-duplication, monotonic timing, and subtitle ordering.
- Diagnostic logs per ASR job and per failed chunk.
- Tests with fake ASR provider and generated audio metadata.

## Non-Goals

- Do not implement speaker diarization in 0.32.
- Do not implement glossary or translation consistency in 0.32.
- Do not require real GPU tests in default verification.
- Do not require full three-hour media in default CI-style tests.

## Architecture

The Worker owns chunk generation, chunk execution, and merge. The ASR provider interface should support either a chunk audio file or a time-bounded chunk request. The first implementation can extract one normalized WAV and pass chunk time ranges to the provider wrapper; a later optimization may write physical per-chunk WAV files when needed for provider reliability.

Chunk outputs live under:

```text
<project>/cache/asr/<task-id>/manifest.json
<project>/cache/asr/<task-id>/chunks/chunk-000001.json
<project>/cache/asr/<task-id>/chunks/chunk-000002.json
```

Subtitle documents are generated only from validated chunk outputs. Raw ASR outputs are kept separate from user-edited subtitle documents.

## Acceptance Criteria

- A long-media ASR job records chunk manifest and per-chunk output.
- Canceling a running ASR job preserves completed chunk outputs.
- Retrying a canceled or failed ASR job skips valid completed chunks.
- Worker restart can resume from existing valid chunk outputs.
- Overlap de-duplication prevents duplicated words in merged subtitle lines.
- Merged subtitle timings are monotonic and non-negative.
- Full repository verification passes.

## Focused Verification

```powershell
python -m pytest worker/tests/pipeline/test_long_asr.py worker/tests/tasks/test_analysis_jobs.py -q
python -m pytest worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/AnalysisInspector.test.tsx src/pages/WorkbenchPage.test.tsx
```

Manual smoke:

1. Create a project from a short real local video.
2. Run real local ASR with chunking enabled.
3. Cancel after at least one chunk completes.
4. Retry the job.
5. Confirm completed chunk output was reused.
6. Confirm final subtitles can be edited and exported.

## Stage Gate

0.32 is accepted only when ASR recovery is proven with automated chunk fixtures and a manual real-media smoke.

