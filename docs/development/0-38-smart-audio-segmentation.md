# Diplomat 0.38 Smart Audio Segmentation

Date: 2026-06-18

Stage: 0.38

## Objective

Add a speech-aware segmentation layer for long-video transcription. The system should stop depending only on fixed 30-second chunks and instead support cutting audio around detected speech gaps whenever possible.

This stage addresses the long-video requirement behind 0.4: one-to-three-hour videos must be split into stable units before ASR, so speech is not cut in the middle of a sentence unless there is no safe silence boundary.

## Product Outcome

The Worker can build an ASR chunk plan from speech activity intervals. The plan prefers silence boundaries, keeps each chunk within configurable duration limits, falls back safely when speech activity is unavailable, and records deterministic chunk boundaries for resume/retry.

## Current Technical Assessment

Current pipeline behavior:

- `run_core_pipeline` extracts 16 kHz mono audio.
- It always calls `build_fixed_chunks(duration_ms, chunk_ms=30000, overlap_ms=500)`.
- Long audio is therefore chunked mechanically and can cut across speech.

0.38 target behavior:

- Add a segmentation planner that accepts speech intervals from a detector.
- Merge very short gaps so micro-pauses do not over-split lectures.
- Prefer real silence gaps when closing chunks.
- Force split only when a continuous speech region exceeds the maximum chunk length.
- Keep fixed-chunk fallback for tests, missing VAD, and recovery cases.

## Research Notes

Primary references checked on 2026-06-18:

- NVIDIA NeMo speaker diarization documentation describes diarization as segmenting audio by speaker and identifies VAD/SAD, speaker embeddings, clustering, and Sortformer diarization as supported approaches: <https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/asr/speaker_diarization/intro.html>
- NVIDIA NeMo models documentation lists Sortformer, Streaming Sortformer, and Multi-Scale Diarization Decoder resources for diarization: <https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/asr/speaker_diarization/models.html>
- Silero VAD documents a lightweight VAD with Python usage, Torch/ONNX options, 8 kHz and 16 kHz support, and very low per-chunk CPU latency claims: <https://github.com/snakers4/silero-vad>
- pyannote.audio documents open-source diarization pipelines and local execution with Hugging Face-hosted models, plus benchmark information: <https://github.com/pyannote/pyannote-audio>

Conclusion:

- Long-term high-intelligence direction: NVIDIA NeMo Sortformer/diarization adapter.
- Practical fallback direction: Silero VAD for local CPU/GPU speech timestamp extraction.
- 0.38 code scope: detector-independent planner and pipeline integration. NeMo/Silero runtime adapters remain later work.

## Scope

- Add a Worker segmentation module.
- Add data structures for speech activity intervals and segmentation configuration.
- Add deterministic speech-aware chunk planning.
- Integrate the planner into `run_core_pipeline`.
- Preserve existing fixed chunk behavior when no speech activity is supplied.
- Add unit tests for silence-boundary planning, fallback, forced split, and core pipeline integration.
- Update release metadata to `0.38.0`.

## Non-Goals

- Do not download or run NVIDIA NeMo in 0.38.
- Do not download or run Silero VAD in 0.38.
- Do not run VibeVoice ASR inference in 0.38.
- Do not run Hunyuan translation inference in 0.38.
- Do not claim final 0.4 readiness.

## Acceptance Criteria

- `build_speech_aware_chunks` avoids splitting inside speech when a valid silence gap exists.
- Continuous speech longer than the maximum chunk length is force-split safely.
- Empty speech activity falls back to fixed chunks.
- `run_core_pipeline` accepts an injected segmentation planner.
- Resume/retry still uses deterministic chunk IDs and result paths.
- Worker tests pass.
- Full repository verification passes.

## Verification

Focused verification:

```powershell
python -m pytest worker/tests/pipeline worker/tests/media -q
python -m pytest worker/tests/tasks/test_analysis_jobs.py -q
node .\scripts\verify-version.mjs
```

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.38 can merge only when speech-aware planning is deterministic, fixed fallback is preserved, and full verification passes.
