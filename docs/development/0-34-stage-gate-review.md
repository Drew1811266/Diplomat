# Diplomat 0.34 Stage Gate Review

Review date: 2026-06-15 Asia/Shanghai local build time

Stage: 0.34

Decision: accepted for merge to `main`.

Release caveat: a real 1-3 hour long-video translation smoke with local translation models was not executed in this session. The repository gate passes because glossary persistence, translation-job payload propagation, deterministic quality audit, line-level issue storage, frontend visibility, focused tests, and the full automated repository check all pass.

## Scope Completed

- Advanced release metadata to `0.34.0` across JavaScript packages, Tauri, Cargo, Python worker, README, lock metadata, and version verification.
- Added Worker and shared TypeScript schemas for translation glossary entries and line-level translation quality issues.
- Persisted glossary entries in project translation settings, backup export, and backup import.
- Exposed glossary fields through translation settings and translation job API contracts.
- Added deterministic glossary quality auditing for missing required target terms.
- Applied glossary quality auditing after translation jobs and during no-op translation runs with existing translated lines.
- Preserved glossary payloads across failed or canceled translation task retries.
- Cleared stale line quality issues when queued lines are retranslated.
- Added frontend glossary editing in the Translation inspector with source and target term fields.
- Added quality issue badges in the subtitle grid and issue details in the line inspector.
- Updated frontend API helpers, fixtures, i18n resources, and schema default expectations for `glossary` and `translationQualityIssues`.

## Verification Evidence

Passed:

```powershell
python -m pytest worker/tests/schemas/test_subtitle.py worker/tests/storage/test_project_store.py worker/tests/translation/test_quality.py worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py -q
corepack pnpm --dir packages/shared test
corepack pnpm --dir packages/shared typecheck
corepack pnpm --dir apps/web test
corepack pnpm --dir apps/web typecheck
$env:PATH='C:\Users\Drew\AppData\Local\Programs\Python\Python312;' + $env:PATH; .\scripts\check.ps1
```

Focused verification result:

```text
0.34 Worker schema, storage, quality, translation task, and API tests passed.
50 shared package tests passed.
175 web tests passed.
Shared and web TypeScript checks passed.
```

Full repository check result:

```text
Release version metadata verified for 0.34.0.
Release packaging assets verified for Diplomat 0.34.0.
20 desktop Rust tests passed.
50 shared package tests passed.
175 web tests passed.
TypeScript checks passed.
263 Python tests passed.
```

## Known Limitations

- Real long-video translation smoke with representative 1-3 hour media was not executed in this session.
- The quality audit is deterministic glossary inclusion only; semantic adequacy scoring and LLM-based review remain out of scope.
- The frontend glossary editor supports source and target term fields but does not yet expose bulk import or case-sensitivity controls.
- The current audit flags missing target terms; it does not automatically rewrite translated text.
- `pnpm` reports ignored `esbuild` build scripts during install; this remains a non-blocking local dependency policy warning in the current environment.

## Stage Gate Result

0.34 meets the repository merge gate for deterministic translation consistency and quality visibility. The next stage can start from `main` after this branch is merged and pushed.
