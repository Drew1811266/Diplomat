# Diplomat 0.38 Smart Audio Segmentation Implementation Plan

> For agentic workers: execute this task-by-task. Keep commits small, verify each layer before moving to the next one, and do not add model runtime dependencies in this stage.

**Goal:** Replace purely fixed ASR chunking with a detector-independent speech-aware segmentation planner that can be fed by NVIDIA NeMo, Silero VAD, pyannote, or fixture detectors in later stages.

**Architecture:** Add a pure Python planner under `worker/diplomat_worker/pipeline/segmentation.py`. Keep `AudioChunk` as the transcriber-facing unit. Extend `run_core_pipeline` with an optional `segmentation_planner` callable. The default path stays fixed-chunk compatible, while tests inject speech intervals.

**0.4 Alignment:** This is the first runtime pipeline step toward the final three-hour acceptance run. It prepares chunking for lecture/tutorial/course videos with long speech regions and specialized vocabulary.

## Files

- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/Cargo.lock`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `worker/pyproject.toml`
- Modify: `worker/diplomat_worker/__init__.py`
- Modify: `scripts/verify-version.mjs`
- Modify: `README.md`
- Create: `worker/diplomat_worker/pipeline/segmentation.py`
- Modify: `worker/diplomat_worker/pipeline/core.py`
- Modify: `worker/diplomat_worker/pipeline/__init__.py`
- Create: `worker/tests/pipeline/test_segmentation.py`
- Modify: `worker/tests/pipeline/test_core.py`
- Modify: `worker/tests/pipeline/test_long_asr.py`
- Create: `docs/development/0-38-stage-gate-review.md`

## Task 1: Version Metadata And Planning Commit

- [ ] Confirm branch is `codex/0.38-smart-audio-segmentation`.
- [ ] Commit 0.38 development and implementation docs.
- [ ] Update release metadata from `0.37.0` to `0.38.0`.
- [ ] Run:

```powershell
corepack pnpm install --lockfile-only
node .\scripts\verify-version.mjs
```

- [ ] Commit version metadata:

```powershell
git commit -m "chore(release): advance version to 0.38.0"
```

## Task 2: Add Segmentation Planner With Tests

- [ ] Create `worker/tests/pipeline/test_segmentation.py` first.
- [ ] Cover these cases:
  - Empty speech activity falls back to fixed chunks.
  - Adjacent speech intervals separated by micro-pauses are merged.
  - Chunk boundaries prefer silence gaps.
  - A speech block longer than `max_chunk_ms` is force-split.
  - Invalid config values raise `ValueError`.
- [ ] Implement `worker/diplomat_worker/pipeline/segmentation.py`.

Target public API:

```python
@dataclass(frozen=True)
class SpeechActivity:
    start_ms: int
    end_ms: int

@dataclass(frozen=True)
class AudioSegmentationConfig:
    target_chunk_ms: int = 45_000
    max_chunk_ms: int = 90_000
    min_silence_gap_ms: int = 700
    padding_ms: int = 250
    fallback_chunk_ms: int = 30_000
    fallback_overlap_ms: int = 500

def normalize_speech_activity(
    duration_ms: int,
    activity: list[SpeechActivity],
    *,
    min_silence_gap_ms: int,
) -> list[SpeechActivity]

def build_speech_aware_chunks(
    duration_ms: int,
    activity: list[SpeechActivity],
    config: AudioSegmentationConfig | None = None,
) -> list[AudioChunk]
```

Expected behavior:

- Returned chunks are ordered.
- Chunk indexes are zero-based and stable.
- Chunks are clamped to `[0, duration_ms]`.
- Chunks never have `end_ms <= start_ms`.
- Fallback calls `build_fixed_chunks`.

- [ ] Run:

```powershell
python -m pytest worker/tests/pipeline/test_segmentation.py -q
```

- [ ] Commit:

```powershell
git commit -m "feat(worker): add speech-aware chunk planner"
```

## Task 3: Integrate Planner Into Core Pipeline

- [ ] Modify `run_core_pipeline` to accept:

```python
SegmentationPlanner = Callable[[int], list[AudioChunk]]
segmentation_planner: SegmentationPlanner | None = None
```

- [ ] If no planner is provided, preserve existing fixed chunk behavior.
- [ ] If a planner is provided, use it after audio extraction and before manifest writing.
- [ ] Keep existing manifest output compatible with resume/retry.
- [ ] Update progress copy from `Chunking audio` to `Planning ASR chunks`.
- [ ] Add tests proving:
  - Injected planner chunk boundaries are used.
  - Resume/retry still reuses completed chunk results.
  - Default behavior still creates the same fixed chunks as before.

- [ ] Run:

```powershell
python -m pytest worker/tests/pipeline -q
python -m pytest worker/tests/tasks/test_analysis_jobs.py -q
```

- [ ] Commit:

```powershell
git commit -m "feat(worker): use segmentation planner in ASR pipeline"
```

## Task 4: Verification And Stage Gate

- [ ] Run focused verification:

```powershell
python -m pytest worker/tests/pipeline worker/tests/media -q
python -m pytest worker/tests/tasks/test_analysis_jobs.py -q
node .\scripts\verify-version.mjs
```

- [ ] Run full verification:

```powershell
.\scripts\check.ps1
```

- [ ] Write `docs/development/0-38-stage-gate-review.md` with:
  - Scope completed.
  - Focused verification results.
  - Full verification results.
  - Known limitations.
  - Decision.

- [ ] Commit:

```powershell
git commit -m "docs: accept 0.38 smart segmentation gate"
```

## Task 5: Merge And Push

- [ ] Confirm clean worktree.
- [ ] Merge into `main`:

```powershell
git switch main
git merge --no-ff codex/0.38-smart-audio-segmentation -m "merge: complete 0.38 smart audio segmentation"
git push origin main
```

- [ ] Proceed automatically to 0.39 if the stage gate is accepted.

## Self-Review

- This stage does not depend on installing large model packages.
- The planner is deterministic and unit-testable.
- The pipeline remains compatible with existing chunk result caches.
- Long-video final acceptance is still reserved for 0.40.
