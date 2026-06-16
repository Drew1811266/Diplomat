# Diplomat 0.35 Desktop Stability Implementation Plan

Date: 2026-06-15 Asia/Shanghai

Branch: `codex/0.35-desktop-stability`

## Objective

Complete the 0.35 final stability stage by advancing release metadata, improving translation recovery for long-video jobs, adding repeatable release-evidence scripts, verifying the repository, and merging the accepted stage to `main`.

## Task 0: Version Metadata

- Update package, Tauri, Cargo, Worker, README, lock metadata, and version verifier expectations to `0.35.0`.
- Run:

```powershell
corepack pnpm install --lockfile-only
node .\scripts\verify-version.mjs
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Task 1: Translation Batch Recovery

Test first:

- Add a Worker translation task test where a batch provider translates the first line, requests cancellation, and leaves the task canceled.
- Assert the first batch is persisted as translated while the remaining line is still retryable.
- Retry the canceled task and assert only the missing line is translated.

Implementation:

- Save the subtitle document after each successful translation batch.
- Keep final glossary quality auditing on completed translation jobs.
- Preserve existing error and cancellation behavior.

Verification:

```powershell
python -m pytest worker/tests/tasks/test_translation_jobs.py -q
```

## Task 2: 0.35 Release Evidence Writer

Test first:

- Add Worker tests for timestamped release evidence JSON output.
- Assert evidence records include schema version, stage, kind, status, artifacts, metrics, and notes.

Implementation:

- Add `diplomat_worker.release.evidence`.
- Add a small CLI entry point for evidence JSON writing.

Verification:

```powershell
python -m pytest worker/tests/release/test_evidence.py -q
```

## Task 3: Opt-In 0.35 Acceptance Scripts

Implementation:

- Add `scripts/verify-0.35-installer.ps1`.
- Add `scripts/verify-0.35-long-video.ps1`.
- Add `scripts/verify-0.35-crash-resume.ps1`.
- Each script validates supplied artifact paths and writes evidence through the Worker evidence CLI.
- Update `docs/development/0-35-stability-release-gate.md` with script parameters and evidence expectations.

Verification:

```powershell
python -m diplomat_worker.release.evidence --help
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.35-installer.ps1 -Help
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.35-long-video.ps1 -Help
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.35-crash-resume.ps1 -Help
```

## Task 4: Stage Gate

- Run focused Worker, shared, web, and desktop checks.
- Run:

```powershell
$env:PATH='C:\Users\Drew\AppData\Local\Programs\Python\Python312;' + $env:PATH; .\scripts\check.ps1
```

- Write `docs/development/0-35-stage-gate-review.md`.
- Commit the gate review.
- Merge `codex/0.35-desktop-stability` into `main`.
- Push `main` to GitHub.

## Risks

- Real long-video and installer acceptance cannot be proven without operator-provided assets in this session.
- Evidence scripts verify and record artifacts; they do not replace actually running the desktop workflow.
- Translation batch persistence must avoid marking not-yet-translated queued lines as quality failures.
