# Diplomat 0.38 Intelligent ASR

Date: 2026-06-18

Stage: 0.38

## Objective

Replace fixed-duration-only long-video ASR with intelligent course-oriented segmentation and isolated VibeVoice-ASR execution. This stage covers the ASR portion of the second major 0.4 task and the first executable part of the third major task.

## Product Outcome

Diplomat can take long lecture, tutorial, or course audio, find safer speech-aware boundaries, process chunks through an isolated ASR runner, persist chunk outputs, and release ASR memory before later stages.

## Scope

- Add a segmentation manifest distinct from the ASR result manifest.
- Add Silero VAD based speech activity detection as the default stable segmenter.
- Add scoring rules for course-oriented chunk boundaries.
- Add manifest fields for boundary confidence and forced split risk.
- Add VibeVoice-ASR provider interface.
- Add isolated ASR child-process runner.
- Add ASR memory lifecycle evidence hooks.
- Preserve retry behavior for completed chunks.
- Add opt-in NeMo segmentation experiment documentation and script hooks.

## Non-Goals

- Do not make NeMo mandatory unless it proves stable.
- Do not complete Hunyuan translation.
- Do not require real VibeVoice downloads for default automated tests.
- Do not remove the faster-whisper provider.

## Acceptance Criteria

- Fake and fixture-based segmentation tests pass.
- Chunk planner prefers speech gaps over fixed boundaries.
- Forced boundaries are recorded.
- ASR child process contract is tested with a fake runner.
- VibeVoice provider can be smoke-tested when the model exists locally.
- Completed ASR chunks survive cancellation and retry.
- ASR memory lifecycle evidence can be written.
- Full repository verification passes.

## Verification

Focused verification:

```powershell
python -m pytest worker/tests/media worker/tests/asr worker/tests/pipeline worker/tests/tasks/test_analysis_jobs.py -q
```

Opt-in real-model verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.38-vibevoice-asr.ps1 -MediaPath <short-or-long-video> -ModelDir .\models\dev\asr\microsoft--VibeVoice-ASR
```

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.38 can merge only when intelligent segmentation and isolated ASR execution are proven by automated tests, and any unavailable real-model evidence is recorded as an explicit caveat rather than hidden.

