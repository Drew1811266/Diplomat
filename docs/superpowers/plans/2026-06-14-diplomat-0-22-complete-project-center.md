# Diplomat 0.22 Complete Project Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete local project library with search, status filtering, diagnostics, safe cleanup/delete, backup, and import/restore.

**Architecture:** The Worker owns project maintenance because it owns SQLite project data and project directories. The shared package defines the API contract, while the React Project Center renders dense desktop-style management controls and calls Worker mutations. The Tauri desktop layer is reused only for safe path opening through `open_path_in_file_manager`.

**Tech Stack:** Python 3.12, FastAPI, SQLite, zipfile, React 19, TypeScript, Zod, TanStack Query, Mantine, Vitest, pytest.

---

## File Structure

- Modify `packages/shared/src/project.ts`
  - Add project status, diagnostics, warning, maintenance, backup, and import schemas.
  - Extend `ProjectResponseSchema` with `diagnostics`.
- Modify `packages/shared/tests/project.test.ts`
  - Add schema tests for project diagnostics and maintenance responses.
- Modify `worker/diplomat_worker/storage/project_store.py`
  - Add project diagnostics derivation.
  - Add safe path helpers.
  - Add project delete, cache cleanup, export cleanup, backup, and import methods.
  - Add project task listing helpers.
- Modify `worker/diplomat_worker/api/schemas.py`
  - Add Pydantic models matching the shared schemas.
- Modify `worker/diplomat_worker/api/app.py`
  - Include diagnostics in `ProjectResponse`.
  - Add project maintenance endpoints.
  - Return clear migration failure errors.
- Modify `worker/tests/storage/test_project_store.py`
  - Add diagnostics, cleanup, delete, backup, and import tests.
- Modify `worker/tests/api/test_app.py`
  - Add project maintenance endpoint tests.
- Modify `apps/web/src/api.ts`
  - Add project maintenance API functions.
- Modify `apps/web/src/queries/projectQueries.ts`
  - Add mutations and invalidation for cleanup, delete, backup, and import.
- Modify `apps/web/src/pages/ProjectCenterPage.tsx`
  - Add search/filter controls, status badges, diagnostics columns, row actions, import backup form, and delete confirmation.
- Modify `apps/web/src/pages/ProjectCenterPage.test.tsx`
  - Add UI tests for search, filter, actions, confirmation, and error states.
- Modify `apps/web/src/i18n/en.ts`
  - Add Project Center management strings.
- Modify `apps/web/src/i18n/zh.ts`
  - Add matching Chinese strings.
- Create `docs/development/0-22-stage-gate-review.md`
  - Record verification after implementation.

## Task 1: Shared Project Management Contract

**Files:**
- Modify: `packages/shared/src/project.ts`
- Modify: `packages/shared/tests/project.test.ts`

- [ ] **Step 1: Add failing shared schema tests**

Add tests to `packages/shared/tests/project.test.ts`:

```ts
import {
  ProjectBackupResponseSchema,
  ProjectImportRequestSchema,
  ProjectListResponseSchema,
  ProjectMaintenanceResponseSchema,
  ProjectStatusSchema
} from "../src/project";

test("project response parses diagnostics", () => {
  const parsed = ProjectListResponseSchema.parse({
    projects: [
      {
        projectId: "project-1",
        name: "Demo",
        sourceVideoPath: "D:/media/demo.mp4",
        projectDir: "D:/Diplomat/data/projects/project-1",
        durationMs: 12000,
        sourceLanguage: "zh",
        targetLanguage: "en",
        createdAt: "2026-06-14T00:00:00+00:00",
        updatedAt: "2026-06-14T00:00:01+00:00",
        hasSubtitleDocument: true,
        diagnostics: {
          status: "translated",
          warnings: [],
          sourceVideoExists: true,
          projectDirExists: true,
          diskUsageBytes: 4096,
          cacheUsageBytes: 128,
          exportUsageBytes: 2048,
          exportCount: 1,
          subtitleLineCount: 10,
          translatedLineCount: 10,
          activeTaskCount: 0,
          failedTaskCount: 0,
          latestTaskStatus: "completed",
          exportsDir: "D:/Diplomat/data/projects/project-1/exports",
          cacheDir: "D:/Diplomat/data/projects/project-1/cache",
          logsDir: "D:/Diplomat/data/projects/project-1/logs",
          backupsDir: "D:/Diplomat/data/projects/project-1/backups"
        }
      }
    ]
  });

  expect(parsed.projects[0].diagnostics.status).toBe("translated");
  expect(parsed.projects[0].diagnostics.exportCount).toBe(1);
});

test("project status rejects unsupported values", () => {
  expect(ProjectStatusSchema.parse("failed")).toBe("failed");
  expect(() => ProjectStatusSchema.parse("unknown")).toThrow();
});

test("project maintenance responses parse bytes and paths", () => {
  expect(
    ProjectMaintenanceResponseSchema.parse({
      projectId: "project-1",
      action: "cleanup_exports",
      filesAffected: 2,
      bytesAffected: 200,
      message: "Cleaned exports."
    }).bytesAffected
  ).toBe(200);

  expect(
    ProjectBackupResponseSchema.parse({
      projectId: "project-1",
      packagePath: "D:/Diplomat/data/projects/project-1/backups/demo.diplomat-project.zip",
      bytesWritten: 1024,
      message: "Backup created."
    }).bytesWritten
  ).toBe(1024);
});

test("project import request parses package path", () => {
  expect(
    ProjectImportRequestSchema.parse({
      packagePath: "D:/backups/demo.diplomat-project.zip",
      restoreName: "Restored Demo"
    }).restoreName
  ).toBe("Restored Demo");
});
```

- [ ] **Step 2: Run failing shared tests**

Run:

```powershell
corepack pnpm --dir packages/shared test
```

Expected: FAIL because the new schemas do not exist.

- [ ] **Step 3: Add shared schemas**

In `packages/shared/src/project.ts`, add:

```ts
export const ProjectStatusSchema = z.enum([
  "not_transcribed",
  "transcribed",
  "translated",
  "dirty_draft",
  "exported",
  "failed",
  "corrupted",
  "migration_failed"
]);

export const ProjectWarningCodeSchema = z.enum([
  "source_missing",
  "project_dir_missing",
  "subtitle_corrupted",
  "unsafe_project_path",
  "migration_failed"
]);

export const ProjectWarningSchema = z.object({
  code: ProjectWarningCodeSchema,
  message: z.string().min(1)
});

export const ProjectDiagnosticsSchema = z.object({
  status: ProjectStatusSchema,
  warnings: z.array(ProjectWarningSchema),
  sourceVideoExists: z.boolean(),
  projectDirExists: z.boolean(),
  diskUsageBytes: z.number().int().nonnegative(),
  cacheUsageBytes: z.number().int().nonnegative(),
  exportUsageBytes: z.number().int().nonnegative(),
  exportCount: z.number().int().nonnegative(),
  subtitleLineCount: z.number().int().nonnegative(),
  translatedLineCount: z.number().int().nonnegative(),
  activeTaskCount: z.number().int().nonnegative(),
  failedTaskCount: z.number().int().nonnegative(),
  latestTaskStatus: z.string().nullable(),
  exportsDir: z.string().min(1),
  cacheDir: z.string().min(1),
  logsDir: z.string().min(1),
  backupsDir: z.string().min(1)
});
```

Extend `ProjectResponseSchema`:

```ts
diagnostics: ProjectDiagnosticsSchema
```

Add maintenance schemas:

```ts
export const ProjectMaintenanceActionSchema = z.enum([
  "delete",
  "cleanup_cache",
  "cleanup_exports",
  "import"
]);

export const ProjectMaintenanceResponseSchema = z.object({
  projectId: z.string().min(1),
  action: ProjectMaintenanceActionSchema,
  filesAffected: z.number().int().nonnegative(),
  bytesAffected: z.number().int().nonnegative(),
  message: z.string().min(1)
});

export const ProjectBackupResponseSchema = z.object({
  projectId: z.string().min(1),
  packagePath: z.string().min(1),
  bytesWritten: z.number().int().nonnegative(),
  message: z.string().min(1)
});

export const ProjectImportRequestSchema = z.object({
  packagePath: z.string().min(1),
  restoreName: z.string().min(1).nullable().default(null)
});
```

Export inferred types for each new schema.

- [ ] **Step 4: Run shared tests**

Run:

```powershell
corepack pnpm --dir packages/shared test
```

Expected: PASS.

- [ ] **Step 5: Commit shared contract**

Run:

```powershell
git add packages/shared/src/project.ts packages/shared/tests/project.test.ts
git commit -m "feat(shared): add project management contract"
```

## Task 2: Worker Project Diagnostics And Safe Maintenance

**Files:**
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Modify: `worker/tests/storage/test_project_store.py`

- [ ] **Step 1: Add failing store diagnostics tests**

Add tests covering:

```python
def test_project_store_diagnostics_track_not_transcribed_and_disk_usage(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project("Demo", source, 1000, "zh", "en")
    (project.project_dir / "cache").mkdir()
    (project.project_dir / "cache" / "waveform.bin").write_bytes(b"cache")

    diagnostics = store.project_diagnostics(project)

    assert diagnostics.status == "not_transcribed"
    assert diagnostics.source_video_exists is True
    assert diagnostics.cache_usage_bytes == 5
    assert diagnostics.disk_usage_bytes >= 5
```

```python
def test_project_store_diagnostics_track_translated_exported_failed_and_corrupted(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project("Demo", source, 1000, "zh", "en")

    store.save_subtitle_document(project.project_id, translated_document(project.project_id))
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))
    assert diagnostics.status == "translated"

    exports = project.project_dir / "exports"
    exports.mkdir()
    (exports / "subtitle.srt").write_text("1", encoding="utf-8")
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))
    assert diagnostics.status == "exported"
    assert diagnostics.export_count == 1

    store.create_task(project.project_id, "analysis", "queued", {})
    task = store.list_tasks_for_project(project.project_id)[0]
    store.update_task(task.task_id, status="failed", completed=True, error_code="TEST", error_message="failed")
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))
    assert diagnostics.status == "failed"

    (project.project_dir / "subtitle.diplomat.json").write_text("{broken", encoding="utf-8")
    diagnostics = store.project_diagnostics(store.get_project(project.project_id))
    assert diagnostics.status == "corrupted"
```

Expected helper `translated_document(project_id)` can mirror existing subtitle fixture style.

- [ ] **Step 2: Run failing store tests**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: FAIL because diagnostics helpers do not exist.

- [ ] **Step 3: Implement diagnostics dataclasses and helpers**

In `project_store.py`, add dataclasses:

```python
@dataclass(frozen=True)
class ProjectWarning:
    code: str
    message: str


@dataclass(frozen=True)
class ProjectDiagnostics:
    status: str
    warnings: list[ProjectWarning]
    source_video_exists: bool
    project_dir_exists: bool
    disk_usage_bytes: int
    cache_usage_bytes: int
    export_usage_bytes: int
    export_count: int
    subtitle_line_count: int
    translated_line_count: int
    active_task_count: int
    failed_task_count: int
    latest_task_status: str | None
    exports_dir: Path
    cache_dir: Path
    logs_dir: Path
    backups_dir: Path
```

Add methods:

```python
def project_child_dir(self, project: ProjectRecord, name: str) -> Path:
    if name not in {"cache", "exports", "logs", "backups"}:
        raise ValueError(f"Unsupported project directory: {name}")
    return project.project_dir / name
```

Add `project_diagnostics(self, project: ProjectRecord) -> ProjectDiagnostics` using the exact status precedence below and the recursive size helper in this step.

Derive status precedence:

1. `corrupted` if subtitle JSON exists but cannot load.
2. `failed` if any latest or historical task failed.
3. `dirty_draft` if `draft.diplomat.json` exists.
4. `exported` if export count is greater than 0.
5. `translated` if translated line count is greater than 0.
6. `transcribed` if subtitle line count is greater than 0.
7. `not_transcribed`.

Add helpers for recursive size:

```python
def _directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())
```

Add `list_tasks_for_project(project_id)` ordered newest first.

- [ ] **Step 4: Run store diagnostics tests**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: PASS for diagnostics tests after implementation.

- [ ] **Step 5: Add failing maintenance tests**

Add tests:

```python
def test_project_store_cleans_cache_and_exports_only(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project("Demo", source, 1000, "zh", "en")
    cache_file = project.project_dir / "cache" / "waveform.bin"
    export_file = project.project_dir / "exports" / "subtitle.srt"
    cache_file.parent.mkdir()
    export_file.parent.mkdir()
    cache_file.write_bytes(b"cache")
    export_file.write_bytes(b"export")

    cache_result = store.cleanup_project_cache(project.project_id)
    assert cache_result.files_affected == 1
    assert not cache_file.exists()
    assert export_file.exists()

    export_result = store.cleanup_project_exports(project.project_id)
    assert export_result.files_affected == 1
    assert not export_file.exists()
```

```python
def test_project_store_delete_removes_rows_and_safe_project_directory(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project("Demo", source, 1000, "zh", "en")
    (project.project_dir / "cache").mkdir()
    (project.project_dir / "cache" / "item.bin").write_bytes(b"x")

    result = store.delete_project(project.project_id, delete_files=True)

    assert result.action == "delete"
    assert result.files_affected >= 1
    assert not project.project_dir.exists()
    with pytest.raises(KeyError):
        store.get_project(project.project_id)
```

```python
def test_project_store_delete_refuses_unsafe_project_directory(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project("Unsafe", tmp_path / "source.mp4", 1000, "zh", "en")
    with store._connect() as connection:
        connection.execute(
            "UPDATE projects SET project_dir = ? WHERE project_id = ?",
            (str(tmp_path.parent), project.project_id),
        )
        connection.commit()

    with pytest.raises(ValueError, match="unsafe"):
        store.delete_project(project.project_id, delete_files=True)
    assert store.get_project(project.project_id).project_id == project.project_id
```

- [ ] **Step 6: Implement maintenance helpers**

Add:

```python
@dataclass(frozen=True)
class ProjectMaintenanceResult:
    project_id: str
    action: str
    files_affected: int
    bytes_affected: int
    message: str
```

Implement safe cleanup/delete with:

- `_safe_child_dir(project, name)`.
- `_remove_directory_contents(path)`.
- `_assert_safe_project_directory(project_dir)`.
- `cleanup_project_cache(project_id)`.
- `cleanup_project_exports(project_id)`.
- `delete_project(project_id, delete_files=True)`.

Use `shutil.rmtree` only after resolving the absolute path and verifying it is inside the store root.

- [ ] **Step 7: Add failing backup/import tests**

Add tests:

```python
def test_project_store_backup_and_import_round_trip(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = store.create_project("Demo", source, 1000, "zh", "en")
    store.save_subtitle_document(project.project_id, translated_document(project.project_id))
    (project.project_dir / "exports").mkdir(exist_ok=True)
    (project.project_dir / "exports" / "subtitle.srt").write_text("subtitle", encoding="utf-8")

    backup = store.backup_project(project.project_id)
    imported = store.import_project_backup(backup.package_path, restore_name="Restored Demo")

    assert backup.package_path.exists()
    assert imported.name == "Restored Demo"
    assert imported.project_id != project.project_id
    assert store.has_subtitle_document(imported.project_id) is True
    assert (imported.project_dir / "exports" / "subtitle.srt").exists()
```

- [ ] **Step 8: Implement backup/import**

Add:

```python
@dataclass(frozen=True)
class ProjectBackupResult:
    project_id: str
    package_path: Path
    bytes_written: int
    message: str
```

Implement:

- `backup_project(project_id)`.
- `import_project_backup(package_path, restore_name=None)`.
- private `_create_project_from_backup_manifest`.

The backup manifest must include:

```json
{
  "schemaVersion": "diplomat.project-backup.v1",
  "project": {
    "name": "Demo",
    "sourceVideoPath": "D:/media/demo.mp4",
    "durationMs": 1000,
    "sourceLanguage": "zh",
    "targetLanguage": "en"
  }
}
```

Use Python `zipfile.ZipFile` and validate `schemaVersion` before import.

- [ ] **Step 9: Run store tests and commit**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/storage/project_store.py worker/tests/storage/test_project_store.py
git commit -m "feat(worker): add project diagnostics and maintenance"
```

## Task 3: Worker Project Maintenance API

**Files:**
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Add failing API tests**

Add tests to `worker/tests/api/test_app.py`:

```python
def test_project_list_includes_diagnostics(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    client = TestClient(app_module.create_app(runtime))
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    project = client.post("/projects", json={
        "name": "Demo",
        "sourceVideoPath": str(source),
        "sourceLanguage": "zh",
        "targetLanguage": "en",
    }).json()

    response = client.get("/projects")

    assert response.status_code == 200
    diagnostics = response.json()["projects"][0]["diagnostics"]
    assert diagnostics["status"] == "not_transcribed"
    assert diagnostics["sourceVideoExists"] is True
    assert diagnostics["cacheDir"]
```

Add endpoint tests for:

- `POST /projects/{project_id}/cleanup/cache`.
- `POST /projects/{project_id}/cleanup/exports`.
- `POST /projects/{project_id}/backup`.
- `POST /projects/import`.
- `DELETE /projects/{project_id}?deleteFiles=true`.

- [ ] **Step 2: Run failing API tests**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: FAIL because schemas and routes do not exist.

- [ ] **Step 3: Add API schemas**

In `worker/diplomat_worker/api/schemas.py`, add Pydantic models for:

- `ProjectWarningResponse`.
- `ProjectDiagnosticsResponse`.
- `ProjectMaintenanceResponse`.
- `ProjectBackupResponse`.
- `ProjectImportRequest`.

Extend `ProjectResponse` with:

```python
diagnostics: ProjectDiagnosticsResponse
```

- [ ] **Step 4: Add API response helpers and routes**

In `app.py`:

- Update `project_response(project, runtime)` to include `runtime.store.project_diagnostics(project)`.
- Add conversion helpers for diagnostics and maintenance results.
- Add routes:

```python
@app.delete("/projects/{project_id}", response_model=ProjectMaintenanceResponse)
def delete_project(project_id: str, delete_files: bool = True) -> ProjectMaintenanceResponse:
    result = get_runtime().store.delete_project(project_id, delete_files=delete_files)
    return maintenance_response(result)

@app.post("/projects/{project_id}/cleanup/cache", response_model=ProjectMaintenanceResponse)
def cleanup_project_cache(project_id: str) -> ProjectMaintenanceResponse:
    result = get_runtime().store.cleanup_project_cache(project_id)
    return maintenance_response(result)

@app.post("/projects/{project_id}/cleanup/exports", response_model=ProjectMaintenanceResponse)
def cleanup_project_exports(project_id: str) -> ProjectMaintenanceResponse:
    result = get_runtime().store.cleanup_project_exports(project_id)
    return maintenance_response(result)

@app.post("/projects/{project_id}/backup", response_model=ProjectBackupResponse)
def backup_project(project_id: str) -> ProjectBackupResponse:
    result = get_runtime().store.backup_project(project_id)
    return backup_response(result)

@app.post("/projects/import", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def import_project(request: ProjectImportRequest) -> ProjectResponse:
    runtime = get_runtime()
    project = runtime.store.import_project_backup(
        request.package_path,
        restore_name=request.restore_name,
    )
    return project_response(project, runtime)
```

Map:

- `KeyError` to 404.
- `ValueError` to 400.
- `StorageMigrationError` to 503 with a migration-failed message.

- [ ] **Step 5: Run API tests and commit**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat(worker): expose project maintenance api"
```

## Task 4: Web API And Query Mutations

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/queries/projectQueries.ts`
- Modify: `apps/web/src/pages/ProjectCenterPage.test.tsx`

- [ ] **Step 1: Add failing Web API-driven tests**

In `ProjectCenterPage.test.tsx`, add tests that expect:

- clicking cleanup cache sends `POST /projects/project-demo/cleanup/cache`.
- clicking backup sends `POST /projects/project-demo/backup`.
- confirming delete sends `DELETE /projects/project-demo?deleteFiles=true`.
- import backup sends `POST /projects/import`.

Expected route names can be verified through fetch mock calls.

- [ ] **Step 2: Add API functions**

In `apps/web/src/api.ts`, import new schemas and add:

```ts
export async function cleanupProjectCache(projectId: string, baseUrl = defaultWorkerBaseUrl()) {
  return requestJson(
    `${baseUrl}/projects/${projectId}/cleanup/cache`,
    { method: "POST" },
    (payload) => ProjectMaintenanceResponseSchema.parse(payload)
  );
}

export async function cleanupProjectExports(projectId: string, baseUrl = defaultWorkerBaseUrl()) {
  return requestJson(
    `${baseUrl}/projects/${projectId}/cleanup/exports`,
    { method: "POST" },
    (payload) => ProjectMaintenanceResponseSchema.parse(payload)
  );
}

export async function deleteProject(projectId: string, deleteFiles = true, baseUrl = defaultWorkerBaseUrl()) {
  return requestJson(
    `${baseUrl}/projects/${projectId}?deleteFiles=${deleteFiles ? "true" : "false"}`,
    { method: "DELETE" },
    (payload) => ProjectMaintenanceResponseSchema.parse(payload)
  );
}

export async function backupProject(projectId: string, baseUrl = defaultWorkerBaseUrl()) {
  return requestJson(
    `${baseUrl}/projects/${projectId}/backup`,
    { method: "POST" },
    (payload) => ProjectBackupResponseSchema.parse(payload)
  );
}

export async function importProject(input: ProjectImportRequest, baseUrl = defaultWorkerBaseUrl()) {
  const request = ProjectImportRequestSchema.parse(input);
  return requestJson(
    `${baseUrl}/projects/import`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    (payload) => ProjectResponseSchema.parse(payload)
  );
}
```

Use the shared response schemas for parsing.

- [ ] **Step 3: Add query mutations**

In `projectQueries.ts`, add:

- `useCleanupProjectCacheMutation`.
- `useCleanupProjectExportsMutation`.
- `useDeleteProjectMutation`.
- `useBackupProjectMutation`.
- `useImportProjectMutation`.

Each successful mutation invalidates `queryKeys.projects`; delete also removes `queryKeys.project(projectId)`.

- [ ] **Step 4: Run focused Web tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/ProjectCenterPage.test.tsx
```

Expected: still fail until the UI actions are implemented in Task 5.

Do not commit until Task 5 completes.

## Task 5: Project Center Search, Filters, Actions, And Confirmation

**Files:**
- Modify: `apps/web/src/pages/ProjectCenterPage.tsx`
- Modify: `apps/web/src/pages/ProjectCenterPage.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Add i18n strings**

Add English and Chinese strings for:

- search label and empty-field helper text.
- status filter.
- all statuses.
- disk usage.
- cache usage.
- export usage.
- actions menu.
- open project folder.
- open export folder.
- open log folder.
- clean cache.
- clean exports.
- backup project.
- import backup.
- delete project.
- delete confirmation title.
- delete confirmation body.
- delete files checkbox.
- backup package path.
- no filter matches.
- corrupted state.
- migration failed state.

- [ ] **Step 2: Implement status formatting helpers**

In `ProjectCenterPage.tsx`, add helpers:

```ts
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function projectMatchesSearch(project: ProjectResponse, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    project.projectId,
    project.name,
    project.sourceVideoPath,
    project.sourceLanguage,
    project.targetLanguage ?? ""
  ].some((value) => value.toLowerCase().includes(normalized));
}
```

- [ ] **Step 3: Render search and status filter**

Add a toolbar with:

- `TextInput` labelled `projectCenter.search`.
- `NativeSelect` labelled `projectCenter.statusFilter`.
- import/create buttons.

Filter projects in-memory:

```ts
const filteredProjects = recentProjects.filter(
  (project) =>
    projectMatchesSearch(project, searchQuery) &&
    (statusFilter === "all" || project.diagnostics.status === statusFilter)
);
```

- [ ] **Step 4: Render diagnostics columns**

Update the table to include:

- status badge.
- disk usage.
- updated time.
- warnings text.
- action menu.

Keep horizontal overflow contained in the existing table scroll box.

- [ ] **Step 5: Implement row actions**

Use Mantine `Menu`, `ActionIcon`, and `Modal`.

Actions:

- open project folder: `openPathInFileManager(project.projectDir)`.
- open exports folder: `openPathInFileManager(project.diagnostics.exportsDir)`.
- open logs folder: `openPathInFileManager(project.diagnostics.logsDir)`.
- clean cache: mutation.
- clean exports: mutation.
- backup: mutation and show package path in `TaskStatusSurface`.
- delete: open confirmation modal.

- [ ] **Step 6: Implement import backup form**

Add a compact import backup panel with:

- package path input.
- optional restore name input.
- import button.

On success, open the restored project.

- [ ] **Step 7: Implement delete confirmation**

The modal must show:

- project name.
- whether files will be deleted.
- a checkbox for deleting files.
- a confirmation button.
- a cancel button.

The delete mutation must only run after the modal confirm button is clicked.

- [ ] **Step 8: Run focused Web tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/ProjectCenterPage.test.tsx src/i18n/i18n.test.ts
corepack pnpm --dir apps/web typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit Web changes**

Run:

```powershell
git add apps/web/src/api.ts apps/web/src/queries/projectQueries.ts apps/web/src/pages/ProjectCenterPage.tsx apps/web/src/pages/ProjectCenterPage.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): complete project center management"
```

## Task 6: Documentation, Verification, And Stage Gate

**Files:**
- Modify: `docs/development/0-22-complete-project-center.md`
- Create: `docs/development/0-22-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
corepack pnpm --dir packages/shared test
corepack pnpm --dir apps/web exec vitest run src/pages/ProjectCenterPage.test.tsx src/i18n/i18n.test.ts
corepack pnpm --dir apps/web typecheck
```

Expected: PASS.

- [ ] **Step 2: Run full repository verification**

Run:

```powershell
.\scripts\check.ps1
```

Expected: PASS.

- [ ] **Step 3: Run browser Project Center smoke verification**

Run the Web app:

```powershell
corepack pnpm --dir apps/web dev --host 127.0.0.1
```

In the in-app browser:

1. Open `http://127.0.0.1:1420`.
2. Confirm Project Center renders.
3. Confirm search and status filter are visible.
4. Confirm no horizontal overflow at 1280x720.
5. Confirm the empty/unavailable state is readable when Worker is not running.

- [ ] **Step 4: Create stage gate review**

Create `docs/development/0-22-stage-gate-review.md` with:

- gate decision.
- commits reviewed.
- automated verification evidence.
- browser smoke evidence.
- manual limitations.
- known risks.
- acceptance checklist.

- [ ] **Step 5: Commit stage gate**

Run:

```powershell
git add docs/development/0-22-complete-project-center.md docs/development/0-22-stage-gate-review.md
git commit -m "docs: accept 0.22 stage gate"
```

## Task 7: Merge And Push Accepted 0.22

**Files:**
- No code edits.

- [ ] **Step 1: Confirm branch status**

Run:

```powershell
git status --short --branch
```

Expected: clean branch `codex/0.22-complete-project-center`.

- [ ] **Step 2: Switch to main and merge**

Run:

```powershell
git switch main
git merge --no-ff codex/0.22-complete-project-center -m "merge: complete 0.22 project center"
```

Expected: merge succeeds with no conflicts.

- [ ] **Step 3: Verify merged result**

Run:

```powershell
.\scripts\check.ps1
```

Expected: PASS.

- [ ] **Step 4: Push main**

Run:

```powershell
git push origin main
git status --short --branch
```

Expected: `main` is synchronized with `origin/main`.

## Self-Review Checklist

- Spec coverage:
  - Search/filter covered by Task 5.
  - Delete/cleanup/backup/import covered by Tasks 2, 3, 4, and 5.
  - Status derivation covered by Task 2.
  - Corrupted/migration states covered by Tasks 2, 3, and 5.
  - Stage verification and merge covered by Tasks 6 and 7.
- Placeholder scan:
  - No task uses deferred implementation markers.
- Type consistency:
  - Shared Zod schemas, Worker Pydantic schemas, and Web API parsing use the same camelCase fields.
  - Worker store dataclasses use snake_case and are converted at the API boundary.
