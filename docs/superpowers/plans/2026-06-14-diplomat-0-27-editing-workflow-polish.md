# Diplomat 0.27 Editing Workflow Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production editing workflow safety: shortcuts, split/merge, batch timing, undo/redo, autosaved drafts, stable saves, and recovery snapshots.

**Architecture:** Keep `subtitle.diplomat.json` as the stable saved document, add `draft.diplomat.json` as the autosaved working copy, and add `snapshots/*.diplomat-snapshot.json` as recoverable versions. The Worker owns durable draft/snapshot persistence; the Web Workbench owns session editing history, shortcuts, autosave, and command UX.

**Tech Stack:** TypeScript/Zod/Vitest/React 19/Mantine/React Query, Python 3.12/FastAPI/Pydantic/pytest, existing Worker project store and Workbench draft patterns.

---

## File Structure

- Modify `packages/shared/src/project.ts`: draft/snapshot schemas and types.
- Modify `packages/shared/tests/project.test.ts`: shared schema tests.
- Modify `worker/diplomat_worker/storage/project_store.py`: draft and snapshot persistence, backup/import preservation, diagnostics interaction.
- Modify `worker/tests/storage/test_project_store.py`: storage tests.
- Modify `worker/diplomat_worker/api/schemas.py`: draft/snapshot request/response models.
- Modify `worker/diplomat_worker/api/app.py`: draft/snapshot endpoints and automatic risky-operation snapshots.
- Modify `worker/tests/api/test_app.py`: API endpoint and route tests.
- Modify `worker/tests/tasks/test_analysis_jobs.py`: analysis overwrite snapshot behavior when a stable subtitle exists.
- Modify `worker/tests/tasks/test_translation_jobs.py`: translation overwrite snapshot behavior when a stable subtitle exists.
- Modify `apps/web/src/api.ts`: draft/snapshot API helpers.
- Modify `apps/web/tests/api.test.ts`: API helper tests.
- Modify `apps/web/src/queries/queryKeys.ts`: draft/snapshot query keys.
- Modify `apps/web/src/queries/subtitleQueries.ts`: draft/snapshot hooks.
- Create `apps/web/src/lib/subtitleEditing.ts`: pure split/merge/offset/history/shortcut helpers.
- Create `apps/web/src/lib/subtitleEditing.test.ts`: editing helper tests.
- Create `apps/web/src/components/EditorCommandBar.tsx`: compact editing command bar.
- Create `apps/web/src/components/EditorCommandBar.test.tsx`: command bar tests.
- Create `apps/web/src/components/RecoveryPanel.tsx`: draft/snapshot recovery panel.
- Create `apps/web/src/components/RecoveryPanel.test.tsx`: recovery panel tests.
- Modify `apps/web/src/pages/WorkbenchPage.tsx`: integrate history, autosave, shortcuts, command bar, recovery, and export protection.
- Modify `apps/web/src/pages/WorkbenchPage.test.tsx`: integration tests.
- Modify `apps/web/src/i18n/en.ts`: 0.27 English copy.
- Modify `apps/web/src/i18n/zh.ts`: 0.27 Chinese copy.
- Create `docs/development/0-27-stage-gate-review.md`: after verification.

---

### Task 1: Shared Draft And Snapshot Contracts

**Files:**
- Modify: `packages/shared/src/project.ts`
- Test: `packages/shared/tests/project.test.ts`

- [ ] **Step 1: Write failing shared tests**

Add tests to `packages/shared/tests/project.test.ts`:

```ts
import {
  SubtitleDraftResponseSchema,
  SubtitleSnapshotCreateRequestSchema,
  SubtitleSnapshotListResponseSchema
} from "../src";

const subtitleDocument = {
  schemaVersion: "diplomat.subtitle.v1",
  projectId: "project-demo",
  mediaId: "media-1",
  durationMs: 1000,
  speakers: [],
  styles: [],
  lines: []
};

it("parses subtitle draft responses", () => {
  const draft = SubtitleDraftResponseSchema.parse({
    projectId: "project-demo",
    updatedAt: "2026-06-14T00:00:00+00:00",
    lineCount: 0,
    document: subtitleDocument
  });

  expect(draft.projectId).toBe("project-demo");
});

it("parses subtitle snapshot requests and lists", () => {
  const request = SubtitleSnapshotCreateRequestSchema.parse({
    reason: "batch_timing",
    label: "Before offset",
    document: subtitleDocument
  });

  const list = SubtitleSnapshotListResponseSchema.parse({
    projectId: "project-demo",
    snapshots: [
      {
        snapshotId: "snapshot-20260614",
        projectId: "project-demo",
        reason: request.reason,
        label: "Before offset",
        createdAt: "2026-06-14T00:00:00+00:00",
        lineCount: 0
      }
    ]
  });

  expect(list.snapshots[0].reason).toBe("batch_timing");
});
```

- [ ] **Step 2: Run shared tests and verify failure**

```powershell
corepack pnpm --dir packages/shared test
```

Expected: fails because draft/snapshot schemas are not exported yet.

- [ ] **Step 3: Implement shared schemas**

Add to `packages/shared/src/project.ts`:

```ts
export const SubtitleDraftResponseSchema = z.object({
  projectId: z.string().min(1),
  updatedAt: z.string().min(1),
  lineCount: z.number().int().nonnegative(),
  document: SubtitleDocumentSchema
});

export const SubtitleSnapshotReasonSchema = z.enum([
  "manual",
  "analysis_overwrite",
  "translation_overwrite",
  "batch_timing",
  "burn_in_export_preparation",
  "restore"
]);

export const SubtitleSnapshotSummarySchema = z.object({
  snapshotId: z.string().min(1),
  projectId: z.string().min(1),
  reason: SubtitleSnapshotReasonSchema,
  label: z.string().nullable(),
  createdAt: z.string().min(1),
  lineCount: z.number().int().nonnegative()
});

export const SubtitleSnapshotResponseSchema = SubtitleSnapshotSummarySchema.extend({
  document: SubtitleDocumentSchema
});

export const SubtitleSnapshotListResponseSchema = z.object({
  projectId: z.string().min(1),
  snapshots: z.array(SubtitleSnapshotSummarySchema)
});

export const SubtitleSnapshotCreateRequestSchema = z.object({
  reason: SubtitleSnapshotReasonSchema.default("manual"),
  label: z.string().min(1).nullable().default(null),
  document: SubtitleDocumentSchema.nullable().default(null)
});

export type SubtitleDraftResponse = z.infer<typeof SubtitleDraftResponseSchema>;
export type SubtitleSnapshotReason = z.infer<typeof SubtitleSnapshotReasonSchema>;
export type SubtitleSnapshotSummary = z.infer<typeof SubtitleSnapshotSummarySchema>;
export type SubtitleSnapshotResponse = z.infer<typeof SubtitleSnapshotResponseSchema>;
export type SubtitleSnapshotListResponse = z.infer<typeof SubtitleSnapshotListResponseSchema>;
export type SubtitleSnapshotCreateRequest = z.infer<typeof SubtitleSnapshotCreateRequestSchema>;
```

- [ ] **Step 4: Run shared tests and commit**

```powershell
corepack pnpm --dir packages/shared test
git add packages/shared/src/project.ts packages/shared/tests/project.test.ts
git commit -m "feat(shared): add draft snapshot contracts"
```

---

### Task 2: Worker Draft And Snapshot Storage

**Files:**
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Test: `worker/tests/storage/test_project_store.py`

- [ ] **Step 1: Write failing storage tests**

Add tests:

```python
def test_subtitle_draft_round_trips_and_marks_project_dirty(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project("Demo", tmp_path / "demo.mp4", 1000, "zh", "en")
    document = translated_document(project.project_id)

    draft = store.save_subtitle_draft(project.project_id, document)
    loaded = store.load_subtitle_draft(project.project_id)
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))

    assert draft.line_count == 1
    assert loaded.lines[0].source_text == "你好"
    assert diagnostics.status == "dirty_draft"

    store.delete_subtitle_draft(project.project_id)
    with pytest.raises(FileNotFoundError):
      store.load_subtitle_draft(project.project_id)


def test_stable_subtitle_save_clears_draft(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project("Demo", tmp_path / "demo.mp4", 1000, "zh", "en")
    document = translated_document(project.project_id)

    store.save_subtitle_draft(project.project_id, document)
    store.save_subtitle_document(project.project_id, document)

    assert not (project.project_dir / "draft.diplomat.json").exists()


def test_subtitle_snapshot_round_trips_and_restores(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project("Demo", tmp_path / "demo.mp4", 1000, "zh", "en")
    original = translated_document(project.project_id)
    store.save_subtitle_document(project.project_id, original)

    edited = original.model_copy(
        update={"lines": [original.lines[0].model_copy(update={"source_text": "修改"})]}
    )
    snapshot = store.create_subtitle_snapshot(
        project.project_id,
        reason="batch_timing",
        label="Before batch offset",
        document=edited,
    )
    summaries = store.list_subtitle_snapshots(project.project_id)

    assert summaries[0].snapshot_id == snapshot.snapshot_id
    assert summaries[0].reason == "batch_timing"

    restored = store.restore_subtitle_snapshot(project.project_id, snapshot.snapshot_id)
    assert restored.lines[0].source_text == "修改"
```

Also extend the backup/import test to assert that a draft and snapshot are preserved and rewritten to the imported project id.

- [ ] **Step 2: Run storage tests and verify failure**

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: fails because draft/snapshot methods do not exist.

- [ ] **Step 3: Implement storage records and methods**

In `project_store.py`, add dataclasses:

```python
@dataclass(frozen=True)
class SubtitleDraftRecord:
    project_id: str
    updated_at: str
    line_count: int
    document: SubtitleDocument


@dataclass(frozen=True)
class SubtitleSnapshotRecord:
    snapshot_id: str
    project_id: str
    reason: str
    label: str | None
    created_at: str
    line_count: int
    document: SubtitleDocument
```

Add methods:

- `save_subtitle_draft(project_id, document)`.
- `load_subtitle_draft(project_id)`.
- `delete_subtitle_draft(project_id)`.
- `create_subtitle_snapshot(project_id, reason="manual", label=None, document=None)`.
- `list_subtitle_snapshots(project_id)`.
- `load_subtitle_snapshot(project_id, snapshot_id)`.
- `restore_subtitle_snapshot(project_id, snapshot_id)`.

Implementation requirements:

- Validate `document.project_id == project_id`.
- Draft path is `project.project_dir / "draft.diplomat.json"`.
- Snapshot directory is `project.project_dir / "snapshots"`.
- Snapshot id format is `snapshot-<utc YYYYMMDDHHMMSSffffff>-<uuid8>`.
- Snapshot file schema is `diplomat.subtitle-snapshot.v1`.
- Restore writes the snapshot document as the stable document and deletes the draft.
- Stable subtitle save deletes draft after writing stable document.
- Backup writes draft as `draft.diplomat.json` and snapshots under `snapshots/`.
- Import rewrites `projectId` in subtitle, draft, and snapshot payloads.

- [ ] **Step 4: Run storage tests and commit**

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
git add worker/diplomat_worker/storage/project_store.py worker/tests/storage/test_project_store.py
git commit -m "feat(worker): persist subtitle drafts and snapshots"
```

---

### Task 3: Worker Draft/Snapshot API And Risky Operation Snapshots

**Files:**
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Test: `worker/tests/api/test_app.py`
- Test: `worker/tests/tasks/test_analysis_jobs.py`
- Test: `worker/tests/tasks/test_translation_jobs.py`

- [ ] **Step 1: Write failing API tests**

Extend route coverage to include:

```python
("GET", "/projects/{project_id}/subtitle/draft"),
("PUT", "/projects/{project_id}/subtitle/draft"),
("DELETE", "/projects/{project_id}/subtitle/draft"),
("GET", "/projects/{project_id}/subtitle/snapshots"),
("POST", "/projects/{project_id}/subtitle/snapshots"),
("POST", "/projects/{project_id}/subtitle/snapshots/{snapshot_id}/restore"),
```

Add endpoint tests:

```python
def test_subtitle_draft_routes_round_trip(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"][0]["sourceText"] = "Draft edit"

    missing = client.get(f"/projects/{project_id}/subtitle/draft")
    saved = client.put(f"/projects/{project_id}/subtitle/draft", json={"document": document})
    loaded = client.get(f"/projects/{project_id}/subtitle/draft")
    cleared = client.delete(f"/projects/{project_id}/subtitle/draft")

    assert missing.status_code == 404
    assert saved.status_code == 200
    assert loaded.json()["document"]["lines"][0]["sourceText"] == "Draft edit"
    assert cleared.status_code == 200


def test_subtitle_snapshot_routes_create_list_and_restore(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    document = client.get(f"/projects/{project_id}/subtitle").json()
    document["lines"][0]["sourceText"] = "Snapshot edit"

    created = client.post(
        f"/projects/{project_id}/subtitle/snapshots",
        json={"reason": "manual", "label": "Manual checkpoint", "document": document},
    )
    listed = client.get(f"/projects/{project_id}/subtitle/snapshots")
    restored = client.post(
        f"/projects/{project_id}/subtitle/snapshots/{created.json()['snapshotId']}/restore"
    )

    assert created.status_code == 201
    assert listed.json()["snapshots"][0]["label"] == "Manual checkpoint"
    assert restored.json()["lines"][0]["sourceText"] == "Snapshot edit"
```

Add tests for automatic snapshots:

- Creating an analysis job for a project with existing stable subtitles creates a snapshot with reason `analysis_overwrite`.
- Creating a translation job with `mode="overwrite_all"` creates a snapshot with reason `translation_overwrite`.
- Translation `missing_only` does not create an overwrite snapshot.

- [ ] **Step 2: Run worker tests and verify failure**

```powershell
python -m pytest worker/tests/api/test_app.py worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py -q
```

Expected: fails because schemas/endpoints/automatic snapshots do not exist.

- [ ] **Step 3: Implement schemas, endpoints, and automatic snapshots**

Add Pydantic models:

```python
SnapshotReason = Literal[
    "manual",
    "analysis_overwrite",
    "translation_overwrite",
    "batch_timing",
    "burn_in_export_preparation",
    "restore",
]

class SubtitleDraftResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    updated_at: str = Field(alias="updatedAt")
    line_count: int = Field(alias="lineCount", ge=0)
    document: SubtitleDocument

class SubtitleSnapshotCreateRequest(CamelModel):
    reason: SnapshotReason = "manual"
    label: str | None = None
    document: SubtitleDocument | None = None

class SubtitleSnapshotSummaryResponse(CamelModel):
    snapshot_id: str = Field(alias="snapshotId")
    project_id: str = Field(alias="projectId")
    reason: SnapshotReason
    label: str | None = None
    created_at: str = Field(alias="createdAt")
    line_count: int = Field(alias="lineCount", ge=0)

class SubtitleSnapshotResponse(SubtitleSnapshotSummaryResponse):
    document: SubtitleDocument

class SubtitleSnapshotListResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    snapshots: list[SubtitleSnapshotSummaryResponse]
```

Add API routes and helper response mappers. Update stable `put_subtitle` to rely on `save_subtitle_document`, which clears draft.

Add helper before risky jobs:

```python
def snapshot_existing_subtitle(project_id: str, reason: str, label: str) -> None:
    active_runtime = get_runtime()
    if active_runtime.store.has_subtitle_document(project_id):
        active_runtime.store.create_subtitle_snapshot(project_id, reason=reason, label=label)
```

Call it before successful analysis job creation and before translation job creation when `request.mode == "overwrite_all"`.

- [ ] **Step 4: Run worker tests and commit**

```powershell
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py -q
git add worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py
git commit -m "feat(worker): expose draft and snapshot APIs"
```

---

### Task 4: Web API, Queries, And Pure Editing Helpers

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/tests/api.test.ts`
- Modify: `apps/web/src/queries/queryKeys.ts`
- Modify: `apps/web/src/queries/subtitleQueries.ts`
- Create: `apps/web/src/lib/subtitleEditing.ts`
- Create: `apps/web/src/lib/subtitleEditing.test.ts`

- [ ] **Step 1: Write failing API and helper tests**

In `apps/web/tests/api.test.ts`, add tests for:

```ts
await saveSubtitleDraft("project-demo", analyzedDocumentFixture, "http://worker");
await fetchSubtitleDraft("project-demo", "http://worker");
await deleteSubtitleDraft("project-demo", "http://worker");
await createSubtitleSnapshot("project-demo", { reason: "manual", label: "Checkpoint", document: analyzedDocumentFixture }, "http://worker");
await listSubtitleSnapshots("project-demo", "http://worker");
await restoreSubtitleSnapshot("project-demo", "snapshot-demo", "http://worker");
```

Assert the URL and HTTP method for each helper.

Create `apps/web/src/lib/subtitleEditing.test.ts`:

```ts
it("splits the selected subtitle line at the playhead", () => {
  const next = splitSubtitleLine(documentFixture, "line-1", 1200);

  expect(next.lines).toHaveLength(2);
  expect(next.lines[0].endMs).toBe(1200);
  expect(next.lines[1].startMs).toBe(1200);
});

it("merges with the next line", () => {
  const next = mergeSubtitleLine(documentWithTwoLines, "line-1", "next");

  expect(next.lines).toHaveLength(1);
  expect(next.lines[0].endMs).toBe(documentWithTwoLines.lines[1].endMs);
});

it("offsets only lines after the playhead", () => {
  const next = offsetSubtitleLines(documentWithTwoLines, {
    scope: "after_playhead",
    selectedLineId: "line-1",
    currentTimeMs: 1500,
    offsetMs: 250
  });

  expect(next.lines[0].startMs).toBe(documentWithTwoLines.lines[0].startMs);
  expect(next.lines[1].startMs).toBe(documentWithTwoLines.lines[1].startMs + 250);
});

it("blocks shortcuts in editable targets", () => {
  const textarea = document.createElement("textarea");

  expect(isEditableShortcutTarget(textarea)).toBe(true);
});
```

- [ ] **Step 2: Run web tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleEditing.test.ts
```

Expected: fails because helpers do not exist.

- [ ] **Step 3: Implement API/query helpers and editing helpers**

API helpers:

- `fetchSubtitleDraft(projectId, baseUrl)`.
- `saveSubtitleDraft(projectId, document, baseUrl)`.
- `deleteSubtitleDraft(projectId, baseUrl)`.
- `listSubtitleSnapshots(projectId, baseUrl)`.
- `createSubtitleSnapshot(projectId, input, baseUrl)`.
- `restoreSubtitleSnapshot(projectId, snapshotId, baseUrl)`.

Query hooks:

- `useSubtitleDraftQuery(projectId)`.
- `useSaveSubtitleDraftMutation(projectId)`.
- `useDeleteSubtitleDraftMutation(projectId)`.
- `useSubtitleSnapshotsQuery(projectId)`.
- `useCreateSubtitleSnapshotMutation(projectId)`.
- `useRestoreSubtitleSnapshotMutation(projectId)`.

Editing helpers:

- `splitSubtitleLine(document, lineId, requestedSplitMs)`.
- `mergeSubtitleLine(document, lineId, direction)`.
- `offsetSubtitleLines(document, options)`.
- `createHistory(document)`.
- `pushHistory(history, document)`.
- `undoHistory(history)`.
- `redoHistory(history)`.
- `isEditableShortcutTarget(target)`.

Use `300ms` minimum duration and `50ms` snap/clamp behavior to match timeline expectations.

- [ ] **Step 4: Run tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleEditing.test.ts
corepack pnpm --dir apps/web typecheck
git add apps/web/src/api.ts apps/web/tests/api.test.ts apps/web/src/queries/queryKeys.ts apps/web/src/queries/subtitleQueries.ts apps/web/src/lib/subtitleEditing.ts apps/web/src/lib/subtitleEditing.test.ts
git commit -m "feat(web): add editing workflow helpers"
```

---

### Task 5: Editor Command Bar And Recovery Panel

**Files:**
- Create: `apps/web/src/components/EditorCommandBar.tsx`
- Create: `apps/web/src/components/EditorCommandBar.test.tsx`
- Create: `apps/web/src/components/RecoveryPanel.tsx`
- Create: `apps/web/src/components/RecoveryPanel.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write failing component tests**

`EditorCommandBar.test.tsx`:

```tsx
render(
  <EditorCommandBar
    canUndo
    canRedo={false}
    canEdit
    offsetMs={250}
    offsetScope="selected"
    onUndo={vi.fn()}
    onRedo={vi.fn()}
    onSplit={vi.fn()}
    onMergePrevious={vi.fn()}
    onMergeNext={vi.fn()}
    onOffsetMsChange={vi.fn()}
    onOffsetScopeChange={vi.fn()}
    onApplyOffset={vi.fn()}
    onOpenShortcuts={vi.fn()}
  />
);
expect(screen.getByRole("toolbar", { name: "Editor commands" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
expect(screen.getByRole("button", { name: "Split line" })).toBeEnabled();
```

`RecoveryPanel.test.tsx`:

```tsx
render(
  <RecoveryPanel
    draft={draftFixture}
    snapshots={[snapshotSummaryFixture]}
    busy={false}
    onRestoreDraft={vi.fn()}
    onDiscardDraft={vi.fn()}
    onCreateSnapshot={vi.fn()}
    onRestoreSnapshot={vi.fn()}
  />
);
expect(screen.getByRole("region", { name: "Recovery" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Restore draft" })).toBeEnabled();
expect(screen.getByRole("button", { name: "Restore snapshot Manual checkpoint" })).toBeEnabled();
```

- [ ] **Step 2: Run component tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/EditorCommandBar.test.tsx src/components/RecoveryPanel.test.tsx
```

Expected: fails because components do not exist.

- [ ] **Step 3: Implement components and i18n**

`EditorCommandBar` requirements:

- Use `role="toolbar"` and localized `aria-label`.
- Use icon buttons for undo/redo/split/merge/help with tooltips.
- Use numeric input for offset milliseconds.
- Use segmented control for `selected`, `all`, `after_playhead`.
- Disable editing commands when `canEdit` is false.
- Use stable compact height so Workbench layout does not jump.

`RecoveryPanel` requirements:

- Return `null` when no draft and no snapshots.
- Show draft line count and updated time.
- Show up to five snapshot summaries.
- Provide restore/discard draft buttons.
- Provide create manual snapshot button.
- Provide restore snapshot buttons.

Add English and Chinese strings under:

- `editorCommands`
- `recovery`
- `shortcuts`

- [ ] **Step 4: Run component tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/EditorCommandBar.test.tsx src/components/RecoveryPanel.test.tsx
corepack pnpm --dir apps/web typecheck
git add apps/web/src/components/EditorCommandBar.tsx apps/web/src/components/EditorCommandBar.test.tsx apps/web/src/components/RecoveryPanel.tsx apps/web/src/components/RecoveryPanel.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): add editor workflow panels"
```

---

### Task 6: Workbench Workflow Integration

**Files:**
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`

- [ ] **Step 1: Write failing Workbench tests**

Add tests:

- Restoring a server draft sets local draft text and enables Save.
- Editing text autosaves to `/subtitle/draft`.
- Stable Save persists `/subtitle` and clears draft state.
- Undo/redo works for text edits.
- Split selected line creates a second line.
- Merge next collapses two lines into one.
- Batch offset creates a snapshot with reason `batch_timing` and changes matching lines.
- Export remains disabled when a server draft exists but has not been restored/discarded.
- Pressing `S` outside editable fields splits; pressing `S` inside Source text does not split.
- `Ctrl+Z` and `Ctrl+Y` do undo/redo outside editable fields.

- [ ] **Step 2: Run Workbench tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
```

Expected: fails because Workbench does not use draft/snapshot hooks or editing commands yet.

- [ ] **Step 3: Implement Workbench integration**

Implementation requirements:

- Import `EditorCommandBar`, `RecoveryPanel`, and subtitle editing helpers.
- Query server draft and snapshots for the active project.
- Track `draftDocument`, `historyPast`, `historyFuture`, autosave status, shortcut help state, offset scope, and offset milliseconds.
- Replace direct `updateLine` mutations with a `commitDraftDocument(nextDocument)` helper that pushes history.
- Autosave debounced local draft documents through `useSaveSubtitleDraftMutation`.
- Save stable document through existing `useSaveSubtitleDocumentMutation`; on success clear local draft and invalidate draft/project queries.
- Restore draft by setting `draftDocument` to the server draft document.
- Discard draft through `useDeleteSubtitleDraftMutation`.
- Create manual snapshots through `useCreateSubtitleSnapshotMutation`.
- Restore snapshots through `useRestoreSubtitleSnapshotMutation`, then clear local draft and refetch subtitle/draft/snapshot/project data.
- Before batch timing, create a `batch_timing` snapshot using the current document, then apply offset.
- Before analysis/translation overwrite the Worker creates durable snapshots; the Workbench does not need to duplicate them.
- `canExport` must be false when local draft exists or server draft exists.
- Add document-level keydown listener for shortcuts and use `isEditableShortcutTarget(event.target)`.

- [ ] **Step 4: Run focused web tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleEditing.test.ts src/components/EditorCommandBar.test.tsx src/components/RecoveryPanel.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
git add apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx
git commit -m "feat(web): integrate editing workflow safety"
```

---

### Task 7: Stage Verification And Review

**Files:**
- Create: `docs/development/0-27-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py -q
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleEditing.test.ts src/components/EditorCommandBar.test.tsx src/components/RecoveryPanel.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

- [ ] **Step 2: Run full verification**

```powershell
.\scripts\check.ps1
```

- [ ] **Step 3: Run Browser smoke**

Manual smoke:

1. Start Worker on `127.0.0.1:8765` with isolated `DIPLOMAT_DATA_DIR`.
2. Start Web app on `127.0.0.1:1420`.
3. Seed a project with a stable subtitle document and cached waveform.
4. Open the project in the in-app Browser.
5. Edit source text and wait for autosave.
6. Confirm the recovery panel reports an autosaved draft.
7. Reload or reopen the project and restore the draft.
8. Use Undo and Redo from the command bar.
9. Use `S` outside editable fields to split a line.
10. Focus a textarea and press `S`; confirm no split occurs.
11. Merge the split line.
12. Apply batch offset and confirm snapshot count increases.
13. Restore a snapshot.
14. Confirm Export is disabled while draft recovery is pending.
15. Confirm browser console error log count is 0.

- [ ] **Step 4: Write stage gate review**

Document:

- commits reviewed.
- focused verification results.
- full verification results.
- Browser smoke result.
- known limitations around session-only undo and simple split heuristics.

- [ ] **Step 5: Commit stage gate**

```powershell
git add docs/development/0-27-stage-gate-review.md
git commit -m "docs: accept 0.27 stage gate"
```

---

## Self-Review

- Spec coverage: the plan covers shortcuts, help, split/merge, batch timing, undo/redo, autosave drafts, stable saves, snapshots, recovery UI, and export protection.
- Completeness scan: every planned behavior has a test target and verification command.
- Type consistency: draft and snapshot schema/type names match between shared, Worker, API helpers, and query hooks.
