# Diplomat 0.34 Translation Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project glossary persistence, deterministic post-translation terminology audit, and frontend visibility for long-video translation quality issues.

**Architecture:** Store glossary entries in translation settings and task payloads, then store audit results on subtitle lines. The Worker performs deterministic glossary checks after translation results are written, while the web UI edits glossary text in the Translation inspector and surfaces line-level issues in existing subtitle review surfaces.

**Tech Stack:** Python 3.12, Pydantic, SQLite ProjectStore, pytest, TypeScript, Zod, React, Mantine, Vitest.

---

## Files

- Modify: `README.md`
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/desktop/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/Cargo.lock`
- Modify: `worker/pyproject.toml`
- Modify: `worker/diplomat_worker/__init__.py`
- Modify: `scripts/verify-version.mjs`
- Modify: `worker/diplomat_worker/schemas/subtitle.py`
- Modify: `packages/shared/src/subtitle.ts`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `packages/shared/src/task.ts`
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/diplomat_worker/tasks/translation.py`
- Create: `worker/diplomat_worker/translation/quality.py`
- Create: `worker/tests/translation/test_quality.py`
- Modify: `worker/tests/schemas/test_subtitle.py`
- Modify: `worker/tests/storage/test_project_store.py`
- Modify: `worker/tests/tasks/test_translation_jobs.py`
- Modify: `worker/tests/api/test_app.py`
- Modify: `packages/shared/tests/subtitle.test.ts`
- Modify: `packages/shared/tests/task.test.ts`
- Create: `apps/web/src/lib/glossaryText.ts`
- Create: `apps/web/src/lib/glossaryText.test.ts`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.test.tsx`
- Modify: `apps/web/src/components/inspectors/LineInspector.tsx`
- Modify: `apps/web/src/components/inspectors/LineInspector.test.tsx`
- Modify: `apps/web/src/components/SubtitleGrid.tsx`
- Modify: `apps/web/src/components/SubtitleGrid.test.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/test/fixtures.ts`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`
- Create: `docs/development/0-34-stage-gate-review.md`

## Task 0: Advance Version Metadata To 0.34.0

**Files:**
- Modify: release metadata files listed above

- [ ] **Step 1: Update version strings**

Set every release metadata value to `0.34.0`. In `scripts/verify-version.mjs`, set:

```js
const expectedVersion = "0.34.0";
```

In `README.md`, update the version section to:

```markdown
Current project version: **0.34.0**
Release tag: **v0.34**
```

- [ ] **Step 2: Refresh lock metadata**

Run:

```powershell
corepack pnpm install --lockfile-only
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected: Cargo finishes successfully and `Cargo.lock` records the local package version as `0.34.0`.

- [ ] **Step 3: Verify version metadata**

Run:

```powershell
node .\scripts\verify-version.mjs
```

Expected output:

```text
All release version metadata matches 0.34.0.
```

- [ ] **Step 4: Commit**

```powershell
git add package.json apps/web/package.json apps/desktop/package.json packages/shared/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock worker/pyproject.toml worker/diplomat_worker/__init__.py README.md scripts/verify-version.mjs pnpm-lock.yaml
git commit -m "chore(release): advance version to 0.34.0"
```

## Task 1: Add Glossary And Quality Schemas

**Files:**
- Modify: `worker/diplomat_worker/schemas/subtitle.py`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `packages/shared/src/subtitle.ts`
- Modify: `packages/shared/src/task.ts`
- Modify: `worker/tests/schemas/test_subtitle.py`
- Modify: `packages/shared/tests/subtitle.test.ts`
- Modify: `packages/shared/tests/task.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add to `worker/tests/schemas/test_subtitle.py`:

```python
from diplomat_worker.schemas.subtitle import (
    TranslationGlossaryEntry,
    TranslationQualityIssue,
)


def test_subtitle_line_accepts_translation_quality_issues() -> None:
    line = make_line(
        translationQualityIssues=[
            {
                "code": "glossary_term_missing",
                "severity": "warning",
                "message": 'Expected translation for "GPU" to include "GPU".',
                "termId": "term-1",
            }
        ]
    )

    assert line.translation_quality_issues == [
        TranslationQualityIssue(
            code="glossary_term_missing",
            severity="warning",
            message='Expected translation for "GPU" to include "GPU".',
            term_id="term-1",
        )
    ]


def test_translation_glossary_entry_serializes_camel_case() -> None:
    entry = TranslationGlossaryEntry(
        id="term-1",
        sourceText="GPU",
        targetText="GPU",
        sourceLanguage="en",
        targetLanguage="zh",
        caseSensitive=False,
    )

    assert entry.model_dump(by_alias=True) == {
        "id": "term-1",
        "sourceText": "GPU",
        "targetText": "GPU",
        "sourceLanguage": "en",
        "targetLanguage": "zh",
        "caseSensitive": False,
    }
```

Add to `packages/shared/tests/subtitle.test.ts`:

```ts
it("parses translation quality issues on subtitle lines", () => {
  const parsed = SubtitleLineSchema.parse({
    ...validLine,
    translationQualityIssues: [
      {
        code: "glossary_term_missing",
        severity: "warning",
        message: 'Expected translation for "GPU" to include "GPU".',
        termId: "term-1"
      }
    ]
  });

  expect(parsed.translationQualityIssues[0]?.termId).toBe("term-1");
});
```

Add to `packages/shared/tests/task.test.ts`:

```ts
it("parses translation glossary entries on job requests", () => {
  const request = TranslationJobRequestSchema.parse({
    sourceLanguage: "en",
    targetLanguage: "zh",
    glossary: [
      {
        id: "term-1",
        sourceText: "GPU",
        targetText: "GPU",
        sourceLanguage: "en",
        targetLanguage: "zh",
        caseSensitive: false
      }
    ]
  });

  expect(request.glossary[0]?.sourceText).toBe("GPU");
});
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/schemas/test_subtitle.py -q
corepack pnpm --dir packages/shared test -- subtitle.test.ts task.test.ts
```

Expected: imports or schema fields fail because glossary and quality issue types do not exist.

- [ ] **Step 3: Add Worker subtitle schema types**

In `worker/diplomat_worker/schemas/subtitle.py`, add:

```python
class TranslationGlossaryEntry(CamelModel):
    id: str = Field(min_length=1)
    source_text: str = Field(alias="sourceText", min_length=1)
    target_text: str = Field(alias="targetText", min_length=1)
    source_language: str = Field(alias="sourceLanguage", min_length=2, max_length=12)
    target_language: str = Field(alias="targetLanguage", min_length=2, max_length=12)
    case_sensitive: bool = Field(default=False, alias="caseSensitive")


class TranslationQualityIssue(CamelModel):
    code: Literal["glossary_term_missing"] = "glossary_term_missing"
    severity: Literal["warning", "error"] = "warning"
    message: str = Field(min_length=1)
    term_id: str | None = Field(default=None, alias="termId")
```

Add to `SubtitleLine`:

```python
    translation_quality_issues: list[TranslationQualityIssue] = Field(
        default_factory=list,
        alias="translationQualityIssues",
    )
```

- [ ] **Step 4: Add API request glossary field**

In `worker/diplomat_worker/api/schemas.py`, import `TranslationGlossaryEntry` and add to `TranslationSettingsRequest`:

```python
    glossary: list[TranslationGlossaryEntry] = Field(default_factory=list)
```

- [ ] **Step 5: Add shared schemas**

In `packages/shared/src/subtitle.ts`, add:

```ts
export const TranslationGlossaryEntrySchema = z.object({
  id: z.string().min(1),
  sourceText: z.string().min(1),
  targetText: z.string().min(1),
  sourceLanguage: LanguageCodeSchema,
  targetLanguage: LanguageCodeSchema,
  caseSensitive: z.boolean().default(false)
});

export const TranslationQualityIssueSchema = z.object({
  code: z.literal("glossary_term_missing"),
  severity: z.enum(["warning", "error"]),
  message: z.string().min(1),
  termId: z.string().nullable().default(null)
});
```

Add to `SubtitleLineSchema`:

```ts
    translationQualityIssues: z.array(TranslationQualityIssueSchema).default([])
```

Export:

```ts
export type TranslationGlossaryEntry = z.infer<typeof TranslationGlossaryEntrySchema>;
export type TranslationQualityIssue = z.infer<typeof TranslationQualityIssueSchema>;
```

In `packages/shared/src/task.ts`, import `TranslationGlossaryEntrySchema` and add to `TranslationJobRequestSchema`:

```ts
  glossary: z.array(TranslationGlossaryEntrySchema).default([]),
```

- [ ] **Step 6: Run tests**

```powershell
python -m pytest worker/tests/schemas/test_subtitle.py -q
corepack pnpm --dir packages/shared test
```

Expected: Worker schema tests and shared package tests pass.

- [ ] **Step 7: Commit**

```powershell
git add worker/diplomat_worker/schemas/subtitle.py worker/diplomat_worker/api/schemas.py packages/shared/src/subtitle.ts packages/shared/src/task.ts worker/tests/schemas/test_subtitle.py packages/shared/tests/subtitle.test.ts packages/shared/tests/task.test.ts
git commit -m "feat(translation): add glossary quality schemas"
```

## Task 2: Persist Glossary In Translation Settings

**Files:**
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/storage/test_project_store.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing storage and API tests**

Add to `worker/tests/storage/test_project_store.py`:

```python
def test_translation_settings_persist_glossary(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project("Demo", Path("demo.mp4"), 60_000, "en", "zh")

    saved = store.save_translation_settings(
        project.project_id,
        provider="ct2-marian",
        source_language="en",
        target_language="zh",
        mode="missing_only",
        glossary=[
            {
                "id": "term-1",
                "sourceText": "GPU",
                "targetText": "GPU",
                "sourceLanguage": "en",
                "targetLanguage": "zh",
                "caseSensitive": False,
            }
        ],
    )

    assert saved.glossary[0]["sourceText"] == "GPU"
    assert store.get_translation_settings(project.project_id).glossary[0]["targetText"] == "GPU"
```

Add to `worker/tests/api/test_app.py` in translation settings coverage:

```python
    assert saved["glossary"][0]["sourceText"] == "GPU"
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
```

Expected: `save_translation_settings` does not accept `glossary` and API responses do not include it.

- [ ] **Step 3: Add storage column and dataclass field**

In `TranslationSettingsRecord`, add:

```python
    glossary: list[dict]
```

Set `SCHEMA_VERSION = 7`.

In `_ensure_translation_settings_table`, add:

```sql
glossary_json TEXT NOT NULL DEFAULT '[]',
```

In `_ensure_translation_settings_columns`, add:

```python
"glossary_json": "ALTER TABLE translation_settings ADD COLUMN glossary_json TEXT NOT NULL DEFAULT '[]'",
```

- [ ] **Step 4: Save, load, backup, and restore glossary**

Update `get_translation_settings`, `save_translation_settings`, SQL selects/inserts, `_translation_settings_from_row`, backup writing, and backup import so glossary is serialized through `json.dumps(glossary, ensure_ascii=False, sort_keys=True)` and parsed with `json.loads(row["glossary_json"] or "[]")`.

- [ ] **Step 5: Thread glossary through API**

In `translation_settings_response`, set:

```python
        glossary=settings.glossary,
```

In `put_translation_settings` and `create_translation_job`, pass:

```python
glossary=[entry.model_dump(by_alias=True) for entry in request.glossary],
```

- [ ] **Step 6: Run tests**

```powershell
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
```

Expected: storage and API tests pass.

- [ ] **Step 7: Commit**

```powershell
git add worker/diplomat_worker/storage/project_store.py worker/diplomat_worker/api/app.py worker/tests/storage/test_project_store.py worker/tests/api/test_app.py
git commit -m "feat(translation): persist project glossary settings"
```

## Task 3: Add Deterministic Translation Quality Audit

**Files:**
- Create: `worker/diplomat_worker/translation/quality.py`
- Create: `worker/tests/translation/test_quality.py`

- [ ] **Step 1: Write failing quality tests**

Create `worker/tests/translation/test_quality.py`:

```python
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleLine, TranslationGlossaryEntry
from diplomat_worker.translation.quality import audit_translation_quality


def make_line(source_text: str, translated_text: str) -> SubtitleLine:
    return SubtitleLine(
        id="line-1",
        startMs=0,
        endMs=1000,
        speakerId=None,
        sourceLanguage="en",
        targetLanguage="zh",
        sourceText=source_text,
        translatedText=translated_text,
        words=[],
        styleOverrides={},
        reviewStatus="draft",
        aiOrigin=AiOrigin(engine="fixture", model="fixture"),
        translationStatus="translated",
        translationOrigin=None,
        translationError=None,
        notes="",
    )


def test_audit_flags_missing_glossary_target() -> None:
    glossary = [
        TranslationGlossaryEntry(
            id="term-1",
            sourceText="GPU",
            targetText="GPU",
            sourceLanguage="en",
            targetLanguage="zh",
            caseSensitive=False,
        )
    ]

    issues = audit_translation_quality(
        [make_line("GPU acceleration matters", "图形处理器加速很重要")],
        glossary,
        source_language="en",
        target_language="zh",
    )

    assert issues["line-1"][0].code == "glossary_term_missing"
    assert issues["line-1"][0].term_id == "term-1"


def test_audit_ignores_lines_with_required_target() -> None:
    glossary = [
        TranslationGlossaryEntry(
            id="term-1",
            sourceText="GPU",
            targetText="GPU",
            sourceLanguage="en",
            targetLanguage="zh",
            caseSensitive=False,
        )
    ]

    issues = audit_translation_quality(
        [make_line("GPU acceleration matters", "GPU 加速很重要")],
        glossary,
        source_language="en",
        target_language="zh",
    )

    assert issues == {}
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/translation/test_quality.py -q
```

Expected: quality module import fails.

- [ ] **Step 3: Implement quality audit**

Create `worker/diplomat_worker/translation/quality.py`:

```python
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
                    message=f'Expected translation for "{term.source_text}" to include "{term.target_text}".',
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
```

- [ ] **Step 4: Run tests**

```powershell
python -m pytest worker/tests/translation/test_quality.py -q
```

Expected: quality tests pass.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/translation/quality.py worker/tests/translation/test_quality.py
git commit -m "feat(translation): audit glossary quality"
```

## Task 4: Apply Quality Audit During Translation Jobs

**Files:**
- Modify: `worker/diplomat_worker/tasks/translation.py`
- Modify: `worker/tests/tasks/test_translation_jobs.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing translation job tests**

Add to `worker/tests/tasks/test_translation_jobs.py`:

```python
def test_translation_job_records_glossary_quality_issues(tmp_path: Path) -> None:
    runtime, project = make_runtime(tmp_path)
    seed_document(runtime.store, project.project_id)
    runtime.translation_provider_factory = lambda _config: StaticTranslationProvider("图形处理器加速")
    manager = TranslationJobManager(runtime, auto_start=False)

    task = manager.create_translation_job(
        project.project_id,
        source_language="zh",
        target_language="en",
        mode="overwrite_all",
        provider_config=TranslationProviderConfig(provider="fake"),
        glossary=[
            {
                "id": "term-1",
                "sourceText": "原始字幕文本",
                "targetText": "Original Subtitle",
                "sourceLanguage": "zh",
                "targetLanguage": "en",
                "caseSensitive": False,
            }
        ],
    )
    manager.run_pending_once()

    document = runtime.store.load_subtitle_document(project.project_id)
    assert document.lines[0].translation_quality_issues[0].code == "glossary_term_missing"
    assert document.lines[0].translation_quality_issues[0].term_id == "term-1"
    assert manager.get_task(task.task_id).status == "completed"
```

- [ ] **Step 2: Run test and confirm failure**

```powershell
python -m pytest worker/tests/tasks/test_translation_jobs.py::test_translation_job_records_glossary_quality_issues -q
```

Expected: `create_translation_job` does not accept `glossary` or no issues are recorded.

- [ ] **Step 3: Add glossary to job payload**

In `create_translation_job`, add parameter:

```python
        glossary: list[dict] | None = None,
```

Add to request payload:

```python
                "glossary": glossary or [],
```

In `retry_task`, pass:

```python
            glossary=payload.get("glossary", []),
```

- [ ] **Step 4: Apply quality audit after translation**

Import:

```python
from diplomat_worker.schemas.subtitle import TranslationGlossaryEntry
from diplomat_worker.translation.quality import apply_translation_quality
```

Before saving `next_document`, add:

```python
            glossary = [
                TranslationGlossaryEntry.model_validate(item)
                for item in payload.get("glossary", [])
            ]
            audited_lines = apply_translation_quality(
                next_lines,
                glossary,
                source_language=source_language,
                target_language=target_language,
            )
```

Use `audited_lines` as the saved document lines.

- [ ] **Step 5: Thread glossary from API**

In `worker/diplomat_worker/api/app.py`, pass request glossary into `create_translation_job`:

```python
                glossary=[entry.model_dump(by_alias=True) for entry in request.glossary],
```

- [ ] **Step 6: Run tests**

```powershell
python -m pytest worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py -q
```

Expected: translation task and API tests pass.

- [ ] **Step 7: Commit**

```powershell
git add worker/diplomat_worker/tasks/translation.py worker/tests/tasks/test_translation_jobs.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat(translation): audit glossary terms after jobs"
```

## Task 5: Add Frontend Glossary Editor And Quality Visibility

**Files:**
- Create: `apps/web/src/lib/glossaryText.ts`
- Create: `apps/web/src/lib/glossaryText.test.ts`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.test.tsx`
- Modify: `apps/web/src/components/inspectors/LineInspector.tsx`
- Modify: `apps/web/src/components/inspectors/LineInspector.test.tsx`
- Modify: `apps/web/src/components/SubtitleGrid.tsx`
- Modify: `apps/web/src/components/SubtitleGrid.test.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/test/fixtures.ts`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write failing glossary text tests**

Create `apps/web/src/lib/glossaryText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatGlossaryText, parseGlossaryText } from "./glossaryText";

describe("glossaryText", () => {
  it("parses source target pairs into glossary entries", () => {
    expect(parseGlossaryText("GPU => GPU", "en", "zh")).toEqual([
      {
        id: "term-1",
        sourceText: "GPU",
        targetText: "GPU",
        sourceLanguage: "en",
        targetLanguage: "zh",
        caseSensitive: false
      }
    ]);
  });

  it("formats glossary entries as editable text", () => {
    expect(
      formatGlossaryText([
        {
          id: "term-1",
          sourceText: "GPU",
          targetText: "GPU",
          sourceLanguage: "en",
          targetLanguage: "zh",
          caseSensitive: false
        }
      ])
    ).toBe("GPU => GPU");
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

```powershell
.\apps\web\node_modules\.bin\vitest.cmd run src/lib/glossaryText.test.ts
```

Expected: `glossaryText` module does not exist.

- [ ] **Step 3: Implement glossary text helpers**

Create `apps/web/src/lib/glossaryText.ts`:

```ts
import type { TranslationGlossaryEntry } from "@diplomat/shared";

export function parseGlossaryText(
  value: string,
  sourceLanguage: string,
  targetLanguage: string
): TranslationGlossaryEntry[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [source, target] = line.split("=>").map((part) => part.trim());
      return {
        id: `term-${index + 1}`,
        sourceText: source || line,
        targetText: target || source || line,
        sourceLanguage,
        targetLanguage,
        caseSensitive: false
      };
    })
    .filter((entry) => entry.sourceText.length > 0 && entry.targetText.length > 0);
}

export function formatGlossaryText(entries: TranslationGlossaryEntry[]) {
  return entries.map((entry) => `${entry.sourceText} => ${entry.targetText}`).join("\n");
}
```

- [ ] **Step 4: Add inspector and grid failing tests**

In `TranslationInspector.test.tsx`, assert editing glossary calls `onConfigChange` with a parsed entry. In `LineInspector.test.tsx`, assert an issue message renders. In `SubtitleGrid.test.tsx`, assert a line with issues shows a warning badge.

- [ ] **Step 5: Implement UI changes**

Add `Textarea` in `TranslationInspector` with label `fields.glossary`, value from `formatGlossaryText(config.glossary)`, and on change:

```ts
updateConfig(
  "glossary",
  parseGlossaryText(event.currentTarget.value, config.sourceLanguage, config.targetLanguage)
);
```

In `LineInspector`, render:

```tsx
{line.translationQualityIssues.length > 0 ? (
  <Stack gap={4}>
    {line.translationQualityIssues.map((issue) => (
      <Text key={`${issue.code}-${issue.termId ?? issue.message}`} size="xs" c="orange">
        {issue.message}
      </Text>
    ))}
  </Stack>
) : null}
```

In `SubtitleGrid`, render a warning badge when `line.translationQualityIssues.length > 0`.

Add i18n:

```ts
fields: {
  glossary: "Glossary"
}
```

Chinese:

```ts
fields: {
  glossary: "术语表"
}
```

- [ ] **Step 6: Run frontend tests**

```powershell
.\apps\web\node_modules\.bin\vitest.cmd run src/lib/glossaryText.test.ts src/components/inspectors/TranslationInspector.test.tsx src/components/inspectors/LineInspector.test.tsx src/components/SubtitleGrid.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

Expected: focused frontend tests and typecheck pass.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/lib/glossaryText.ts apps/web/src/lib/glossaryText.test.ts apps/web/src/components/inspectors/TranslationInspector.tsx apps/web/src/components/inspectors/TranslationInspector.test.tsx apps/web/src/components/inspectors/LineInspector.tsx apps/web/src/components/inspectors/LineInspector.test.tsx apps/web/src/components/SubtitleGrid.tsx apps/web/src/components/SubtitleGrid.test.tsx apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx apps/web/src/test/fixtures.ts apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): surface translation glossary quality"
```

## Task 6: Full Verification And 0.34 Stage Gate

**Files:**
- Create: `docs/development/0-34-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

```powershell
python -m pytest worker/tests/schemas/test_subtitle.py worker/tests/storage/test_project_store.py worker/tests/translation/test_quality.py worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py -q
.\apps\web\node_modules\.bin\vitest.cmd run src/lib/glossaryText.test.ts src/components/inspectors/TranslationInspector.test.tsx src/components/inspectors/LineInspector.test.tsx src/components/SubtitleGrid.test.tsx src/pages/WorkbenchPage.test.tsx
```

Expected: all focused Worker and web tests pass.

- [ ] **Step 2: Run full repository verification**

```powershell
$env:PATH='C:\Users\Drew\AppData\Local\Programs\Python\Python312;' + $env:PATH; .\scripts\check.ps1
```

Expected: JavaScript, Rust, TypeScript, and Python checks pass.

- [ ] **Step 3: Write stage gate review**

Create `docs/development/0-34-stage-gate-review.md` recording glossary persistence, job payload propagation, quality audit behavior, frontend visibility, focused verification, full verification, and manual long-video translation smoke status.

- [ ] **Step 4: Commit stage gate**

```powershell
git add docs/development/0-34-stage-gate-review.md
git commit -m "docs: record 0.34 stage gate review"
```

- [ ] **Step 5: Merge and push after acceptance**

```powershell
git switch main
git merge --no-ff codex/0.34-translation-quality -m "merge: complete 0.34 translation quality"
git push origin main
```

Expected: merge and push succeed. Start 0.35 planning only after the push succeeds.

## Self-Review

- Spec coverage: glossary persistence, deterministic terminology audit, long-video translation consistency visibility, frontend editing, and stage gate verification are mapped to tasks.
- Placeholder scan: no task uses unresolved placeholder markers, vague test instructions, or undefined later-only names.
- Type consistency: `TranslationGlossaryEntry`, `TranslationQualityIssue`, `translationQualityIssues`, `glossary`, and `audit_translation_quality` are introduced before use and reused consistently.
