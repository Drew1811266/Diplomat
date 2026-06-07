# Diplomat M2b Usability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the M2a developer loop into a usable early desktop workflow with project listing, project reopening, file picking, Worker lifecycle commands, safer storage migration, and clearer workbench states.

**Architecture:** Keep durable state and media access in the Python Worker, keep cross-boundary payload contracts in `packages/shared`, keep desktop-native file/process operations in Tauri, and keep the React workbench responsible for workflow state. M2b must not add real ASR, translation, timeline editing, waveform editing, or burn-in export.

**Tech Stack:** Python 3.12, FastAPI, SQLite, Pydantic, pytest, React, TypeScript, Zod, Vitest, Testing Library, Tauri 2, Rust.

---

## File Structure

- Modify `worker/diplomat_worker/storage/project_store.py`
  - Add schema-version storage, migration helpers, project timestamps, list support, subtitle existence checks, and `touch_project`.
- Modify `worker/diplomat_worker/api/schemas.py`
  - Add `createdAt`, `updatedAt`, `hasSubtitleDocument`, and project-list response schemas.
- Modify `worker/diplomat_worker/api/app.py`
  - Add `GET /projects`, return richer project metadata, and touch projects after subtitle save/export.
- Modify `worker/tests/storage/test_project_store.py`
  - Add migration, listing, subtitle existence, and timestamp tests.
- Modify `worker/tests/api/test_app.py`
  - Add route, list endpoint, reopen endpoint metadata, and updated timestamp tests.
- Modify `packages/shared/src/project.ts`
  - Add project list item/list response schemas and richer `ProjectResponseSchema`.
- Modify `packages/shared/tests/project.test.ts`
  - Add schema tests for project list and metadata.
- Modify `apps/web/src/api.ts`
  - Add `listProjects`, `fetchProject`, better connection errors, and parsing for new schemas.
- Modify `apps/web/tests/api.test.ts`
  - Add web API helper tests for list/reopen and connection error formatting.
- Create `apps/web/src/desktop.ts`
  - Add safe Tauri command wrappers with browser-only fallbacks.
- Create `apps/web/src/components/ProjectLibraryPanel.tsx`
  - Add compact recent-project list and reopen action.
- Modify `apps/web/src/components/ProjectImportPanel.tsx`
  - Add file picker button and improve disabled states while keeping manual path fallback.
- Modify `apps/web/src/App.tsx`
  - Load project list, create/reopen projects, optionally fetch existing subtitles, and keep list fresh after save/export.
- Modify `apps/web/src/App.css`
  - Add dense workbench layout for project library and import workflow.
- Modify `apps/web/tests/App.test.tsx`
  - Add reopen workflow and file picker fallback tests.
- Modify `apps/web/package.json`
  - Add `@tauri-apps/api` dependency for dynamic invoke calls.
- Modify `apps/desktop/src-tauri/Cargo.toml`
  - Add Tauri dialog/opener/process support dependencies as needed.
- Modify `apps/desktop/src-tauri/src/main.rs`
  - Add commands: `pick_video_file`, `start_worker`, `stop_worker`, `worker_status`, and `open_path_in_file_manager`.
- Modify `apps/desktop/package.json`
  - Replace placeholder desktop test script with `cargo test`.
- Modify `docs/development/m2a-workbench-loop.md`
  - Add M2b note pointing to the new usability workflow document.
- Create `docs/development/m2b-usability-foundation.md`
  - Document how to run M2b, manual test steps, storage behavior, and known limitations.
- Modify `README.md`
  - Add the M2b document link.

---

## Task 1: Worker Storage Migration And Project Listing

**Files:**
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Modify: `worker/tests/storage/test_project_store.py`

- [ ] **Step 1: Add failing storage tests**

Add tests that describe the M2b storage contract:

```python
def test_project_store_lists_projects_newest_first(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    first = store.create_project("First", tmp_path / "first.mp4", 1000, "zh", "en")
    second = store.create_project("Second", tmp_path / "second.mp4", 2000, "en", "zh")

    projects = store.list_projects()

    assert [project.project_id for project in projects] == [second.project_id, first.project_id]
    assert projects[0].created_at is not None
    assert projects[0].updated_at is not None
```

Add a subtitle existence and timestamp test:

```python
def test_project_store_tracks_subtitle_presence_and_updates_timestamp(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project("Demo", tmp_path / "demo.mp4", 1000, "zh", "en")
    before = project.updated_at

    assert store.has_subtitle_document(project.project_id) is False
    store.save_subtitle_document(project.project_id, SubtitleDocument(project_id=project.project_id, media_id="media-1", duration_ms=1000, lines=[]))

    after = store.get_project(project.project_id).updated_at
    assert store.has_subtitle_document(project.project_id) is True
    assert after >= before
```

Add a migration test for an M2a database without `updated_at`:

```python
def test_project_store_migrates_m2a_database_without_rewriting_subtitle(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
    project_dir = tmp_path / "projects" / "project-old"
    project_dir.mkdir(parents=True)
    subtitle_path = project_dir / "subtitle.diplomat.json"
    subtitle_path.write_text("{\"kept\": true}", encoding="utf-8")
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE projects (
                project_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_video_path TEXT NOT NULL,
                project_dir TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                source_language TEXT NOT NULL,
                target_language TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("project-old", "Old", str(tmp_path / "old.mp4"), str(project_dir), 1000, "zh", "en", "2026-06-01T00:00:00+00:00"),
        )

    store = ProjectStore(database_path)
    project = store.get_project("project-old")

    assert project.updated_at == "2026-06-01T00:00:00+00:00"
    assert subtitle_path.read_text(encoding="utf-8") == "{\"kept\": true}"
```

Add a minimal old-schema migration test:

```python
def test_project_store_migrates_minimal_old_project_rows(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute("CREATE TABLE projects (project_id TEXT PRIMARY KEY, name TEXT NOT NULL)")
        connection.execute("INSERT INTO projects (project_id, name) VALUES (?, ?)", ("project-minimal", "Minimal"))

    store = ProjectStore(database_path)
    project = store.get_project("project-minimal")

    assert project.project_dir == tmp_path / "projects" / "project-minimal"
    assert project.duration_ms == 0
    assert project.source_language == "und"
```

- [ ] **Step 2: Run storage tests and verify they fail**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: new tests fail because `ProjectRecord` does not expose timestamps and `ProjectStore` has no `list_projects`, `has_subtitle_document`, migration, or touch support.

- [ ] **Step 3: Implement storage migration and listing**

Implementation details:

- Add `created_at: str` and `updated_at: str` to `ProjectRecord`.
- Add a `StorageMigrationError(RuntimeError)` for unrecoverable databases.
- Add `SCHEMA_VERSION = 2`.
- Create `app_metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL)`.
- Use `PRAGMA table_info(projects)` to detect missing columns.
- For a missing table, create the full M2b table.
- For existing tables, add missing nullable/defaulted columns and backfill:
  - `source_video_path` -> `""`
  - `project_dir` -> root `projects/<project_id>`
  - `duration_ms` -> `0`
  - `source_language` -> `"und"`
  - `target_language` -> `NULL`
  - `created_at` -> current UTC ISO string
  - `updated_at` -> `created_at`
- Add `list_projects()` ordered by `updated_at DESC, created_at DESC, project_id DESC`.
- Add `has_subtitle_document(project_id)`.
- Add `touch_project(project_id)`.
- Call `touch_project` from `save_subtitle_document`.

- [ ] **Step 4: Run storage tests and verify they pass**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: all storage tests pass.

- [ ] **Step 5: Commit storage changes**

Run:

```powershell
git add worker/diplomat_worker/storage/project_store.py worker/tests/storage/test_project_store.py
git commit -m "feat(worker): add project listing storage"
```

---

## Task 2: Worker Project List API

**Files:**
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Add failing API tests**

Update route expectations to include `GET /projects`.

Add a list endpoint test:

```python
def test_project_list_endpoint_returns_recent_projects(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    first = client.post("/projects", json={"name": "First", "sourceVideoPath": str(source_video), "sourceLanguage": "zh", "targetLanguage": "en"}).json()
    second = client.post("/projects", json={"name": "Second", "sourceVideoPath": str(source_video), "sourceLanguage": "en", "targetLanguage": "zh"}).json()

    response = client.get("/projects")

    assert response.status_code == 200
    payload = response.json()
    assert [item["projectId"] for item in payload["projects"]] == [second["projectId"], first["projectId"]]
    assert payload["projects"][0]["createdAt"]
    assert payload["projects"][0]["updatedAt"]
    assert payload["projects"][0]["hasSubtitleDocument"] is False
```

Add reopen metadata test:

```python
def test_get_project_response_includes_m2b_metadata(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = client.post("/projects", json={"name": "Episode 1", "sourceVideoPath": str(source_video), "sourceLanguage": "zh", "targetLanguage": "en"}).json()["projectId"]

    response = client.get(f"/projects/{project_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["createdAt"]
    assert payload["updatedAt"]
    assert payload["hasSubtitleDocument"] is False
```

Add update-after-save/export test:

```python
def test_project_updated_at_changes_after_save_and_export(app_module, tmp_path: Path) -> None:
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    client = TestClient(app_module.create_app(make_test_runtime(tmp_path)))
    project_id = client.post("/projects", json={"name": "Episode 1", "sourceVideoPath": str(source_video), "sourceLanguage": "zh", "targetLanguage": "en"}).json()["projectId"]
    original = client.get(f"/projects/{project_id}").json()["updatedAt"]
    document = client.post(f"/projects/{project_id}/analyze").json()["document"]

    after_analyze = client.get(f"/projects/{project_id}").json()["updatedAt"]
    assert after_analyze >= original
    assert client.get(f"/projects/{project_id}").json()["hasSubtitleDocument"] is True

    client.post(f"/projects/{project_id}/exports/srt", json={"mode": "source"})
    after_export = client.get(f"/projects/{project_id}").json()["updatedAt"]
    assert after_export >= after_analyze
```

- [ ] **Step 2: Run API tests and verify they fail**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: new tests fail because `GET /projects` and metadata fields are missing.

- [ ] **Step 3: Implement API schemas and routes**

Implementation details:

- Extend `ProjectResponse` with:
  - `created_at: str = Field(alias="createdAt")`
  - `updated_at: str = Field(alias="updatedAt")`
  - `has_subtitle_document: bool = Field(alias="hasSubtitleDocument")`
- Add `ProjectListResponse` with `projects: list[ProjectResponse]`.
- Update `project_response(project, store)` to include subtitle existence.
- Add `GET /projects`.
- Call `active_runtime.store.touch_project(project_id)` after SRT export writes successfully.

- [ ] **Step 4: Run API tests and verify they pass**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: all API tests pass.

- [ ] **Step 5: Commit API changes**

Run:

```powershell
git add worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat(worker): expose project list api"
```

---

## Task 3: Shared Schemas And Web API Helpers

**Files:**
- Modify: `packages/shared/src/project.ts`
- Modify: `packages/shared/tests/project.test.ts`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/tests/api.test.ts`

- [ ] **Step 1: Add failing shared schema tests**

Add expectations for `createdAt`, `updatedAt`, `hasSubtitleDocument`, and `ProjectListResponseSchema`.

```typescript
it("accepts a project list response", () => {
  const response = ProjectListResponseSchema.parse({
    projects: [
      {
        projectId: "project-1",
        name: "Launch interview",
        sourceVideoPath: "D:/media/interview.mp4",
        projectDir: "D:/Diplomat/projects/project-1",
        durationMs: 124_000,
        sourceLanguage: "zh",
        targetLanguage: "en",
        createdAt: "2026-06-07T00:00:00+00:00",
        updatedAt: "2026-06-07T00:01:00+00:00",
        hasSubtitleDocument: true
      }
    ]
  });

  expect(response.projects[0]?.hasSubtitleDocument).toBe(true);
});
```

- [ ] **Step 2: Run shared project schema tests and verify they fail**

Run:

```powershell
corepack pnpm --filter @diplomat/shared test -- project.test.ts
```

Expected: tests fail because the schema fields do not exist.

- [ ] **Step 3: Implement shared schemas**

Implementation details:

- Extend `ProjectResponseSchema` with `createdAt`, `updatedAt`, and `hasSubtitleDocument`.
- Add `ProjectListResponseSchema`.
- Export `ProjectListResponse` type.

- [ ] **Step 4: Add failing web API helper tests**

Add `listProjects` and `fetchProject` tests:

```typescript
it("listProjects gets and parses recent projects", async () => {
  const response = { projects: [projectResponse] };
  const fetchMock = stubJsonResponse(response);

  await expect(listProjects(baseUrl)).resolves.toEqual(response);
  expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects`, undefined);
});

it("fetchProject gets and parses one project", async () => {
  const fetchMock = stubJsonResponse(projectResponse);

  await expect(fetchProject("project-1", baseUrl)).resolves.toEqual(projectResponse);
  expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1`, undefined);
});
```

Add a connection failure test:

```typescript
it("formats network failures as worker connection errors", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => {
    throw new TypeError("Failed to fetch");
  }));

  await expect(listProjects(baseUrl)).rejects.toThrow("Worker is not reachable");
});
```

- [ ] **Step 5: Run web API tests and verify they fail**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- api.test.ts
```

Expected: tests fail because helper functions and improved network error formatting are missing.

- [ ] **Step 6: Implement web API helpers**

Implementation details:

- Import `ProjectListResponseSchema`.
- Add `listProjects(baseUrl?)`.
- Add `fetchProject(projectId, baseUrl?)`.
- Wrap `fetch` failures in `requestJson` and throw `Worker is not reachable at <baseUrl>. Start the Worker or use the desktop Start Worker action.`

- [ ] **Step 7: Run shared and web API tests**

Run:

```powershell
corepack pnpm --filter @diplomat/shared test -- project.test.ts
corepack pnpm --filter @diplomat/web test -- api.test.ts
```

Expected: targeted TypeScript tests pass.

- [ ] **Step 8: Commit shared and API helper changes**

Run:

```powershell
git add packages/shared/src/project.ts packages/shared/tests/project.test.ts apps/web/src/api.ts apps/web/tests/api.test.ts
git commit -m "feat(web): add project list client contracts"
```

---

## Task 4: Desktop Native Commands

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/main.rs`
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Add failing Rust tests for lifecycle state helpers**

Create testable helper functions in `main.rs` before exposing them as commands:

```rust
#[test]
fn worker_status_reports_stopped_for_empty_state() {
    let state = WorkerProcessState::default();
    let status = worker_status_from_state(&state);

    assert_eq!(status.status, "stopped");
    assert_eq!(status.endpoint, "http://127.0.0.1:8765");
}
```

Add a test for occupied-port classification using an injectable probe function:

```rust
#[test]
fn classifies_diplomat_worker_health_payload() {
    let status = classify_worker_probe(Ok("{\"name\":\"diplomat-worker\",\"status\":\"ok\",\"version\":\"0.1.0\"}".to_string()));

    assert_eq!(status.status, "running");
    assert_eq!(status.owner, "diplomat");
}
```

- [ ] **Step 2: Run desktop tests and verify they fail**

Run:

```powershell
corepack pnpm --filter @diplomat/desktop test
```

Expected: tests fail until the Rust test script and helper code exist.

- [ ] **Step 3: Add Tauri dependencies and command implementations**

Implementation details:

- Add Tauri features for dialogs and shell/opener where required by Tauri 2.
- Add command return types:
  - `WorkerStatus { status, endpoint, owner, message }`
- Implement:
  - `pick_video_file() -> Result<Option<String>, String>`
  - `worker_status() -> WorkerStatus`
  - `start_worker() -> Result<WorkerStatus, String>`
  - `stop_worker() -> Result<WorkerStatus, String>`
  - `open_path_in_file_manager(path: String) -> Result<(), String>`
- In `start_worker`, first probe `http://127.0.0.1:8765/health`.
  - If payload identifies Diplomat Worker, return running.
  - If another service responds, return a clear error.
  - If unavailable, spawn `python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765` from the repository root when available.
- Write logs under a stable diagnostics directory such as `%LOCALAPPDATA%/Diplomat/logs` when environment variables are available.
- Stop only the child process started by this app instance.

- [ ] **Step 4: Run desktop tests**

Run:

```powershell
corepack pnpm --filter @diplomat/desktop test
```

Expected: Rust tests pass.

- [ ] **Step 5: Commit desktop command changes**

Run:

```powershell
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/main.rs apps/desktop/package.json
git commit -m "feat(desktop): add worker lifecycle commands"
```

---

## Task 5: Web Project Library, Reopen Workflow, And File Picker

**Files:**
- Create: `apps/web/src/desktop.ts`
- Create: `apps/web/src/components/ProjectLibraryPanel.tsx`
- Modify: `apps/web/src/components/ProjectImportPanel.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/tests/App.test.tsx`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add failing App tests for project list and reopen**

Extend `stubWorkbenchFetch` to support `GET /projects`, `GET /projects/project-demo`, and `GET /projects/project-demo/subtitle`.

Add a reopen test:

```typescript
it("loads recent projects and reopens a project with saved subtitles", async () => {
  stubWorkbenchFetch({ includeRecentProject: true, includeSubtitleFetch: true });
  render(<App />);

  expect(await screen.findByText("Recent Projects")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Reopen Demo/ }));

  expect(await screen.findByText(/Project: Demo/)).toBeInTheDocument();
  expect((await screen.findAllByText("原始字幕文本")).length).toBeGreaterThan(0);
});
```

Add a browser fallback test:

```typescript
it("keeps manual path entry available when desktop file picker is unavailable", async () => {
  stubWorkbenchFetch();
  render(<App />);

  expect(await screen.findByLabelText("Source video path")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Pick Video" })).not.toBeInTheDocument();
});
```

Add a desktop picker test by stubbing a Tauri-like runtime:

```typescript
it("uses desktop file picker when Tauri runtime is available", async () => {
  vi.stubGlobal("__TAURI_INTERNALS__", {});
  vi.doMock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(async (command: string) => command === "pick_video_file" ? "D:/media/picked.mp4" : null)
  }));
  stubWorkbenchFetch();
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Pick Video" }));
  expect(await screen.findByDisplayValue("D:/media/picked.mp4")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run App tests and verify they fail**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
```

Expected: tests fail because the project library, reopen logic, and desktop picker wrapper do not exist.

- [ ] **Step 3: Implement desktop wrapper**

Implementation details:

- `isDesktopRuntime()` returns true when `window.__TAURI_INTERNALS__` or `window.__TAURI__` exists.
- `pickVideoFile()` returns `null` in browser-only mode.
- In desktop mode, dynamically import `@tauri-apps/api/core` and call `invoke("pick_video_file")`.
- Add `startWorker`, `stopWorker`, and `workerStatus` wrappers for later UI actions.

- [ ] **Step 4: Implement project library component**

Component responsibilities:

- Render a `Recent Projects` heading and project count.
- Render one compact row per project with name, language pair, duration, subtitle availability, and updated time.
- Provide a `Reopen <name>` button per row.
- Render an operational empty state when there are no projects.

- [ ] **Step 5: Update import panel**

Implementation details:

- Add optional `canPickVideo` and `onPickVideo` props.
- Show `Pick Video` only when desktop runtime is available.
- Keep manual source path input in all modes.
- Disable create when busy or when `sourceVideoPath` is blank.

- [ ] **Step 6: Update App workflow**

Implementation details:

- After Worker health succeeds, call `listProjects`.
- After creating a project, refresh project list.
- Reopen flow:
  1. Call `fetchProject(projectId)`.
  2. Set current project.
  3. Try `fetchSubtitleDocument(projectId)`.
  4. If subtitle is missing, clear document and show `Project reopened`.
  5. If subtitle exists, load it and select the first line.
- After save/export, refresh the project list so `updatedAt` and subtitle status are visible.
- Use clearer messages:
  - `Project list loaded`
  - `Project reopened`
  - `Project reopened with subtitles`
  - `Video path selected`

- [ ] **Step 7: Update CSS**

Implementation details:

- Add a two-column `workspace-layout` for project library and main workflow on desktop.
- Keep cards at 8px radius.
- Keep buttons stable and compact.
- Use current teal/slate palette without turning the page into a one-hue theme.
- Preserve mobile layout with a single column below 980px.

- [ ] **Step 8: Run App tests**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
```

Expected: App tests pass.

- [ ] **Step 9: Commit web workflow changes**

Run:

```powershell
git add apps/web/package.json apps/web/src/desktop.ts apps/web/src/components/ProjectLibraryPanel.tsx apps/web/src/components/ProjectImportPanel.tsx apps/web/src/App.tsx apps/web/src/App.css apps/web/tests/App.test.tsx pnpm-lock.yaml
git commit -m "feat(web): add project reopen workflow"
```

---

## Task 6: Documentation, Full Verification, And Stage Review

**Files:**
- Create: `docs/development/m2b-usability-foundation.md`
- Modify: `docs/development/m2a-workbench-loop.md`
- Modify: `README.md`

- [ ] **Step 1: Write M2b development document**

Include:

- What M2b adds.
- What remains out of scope.
- How to run Worker, Web, and Desktop development modes.
- How the storage directory and migration behave.
- Manual M2b test workflow.
- Known limitations.

- [ ] **Step 2: Update README and M2a docs**

Add the M2b document link to README. Add a short note in M2a that M2b supersedes manual path entry for desktop testing.

- [ ] **Step 3: Run focused test suites**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
corepack pnpm --filter @diplomat/shared test -- project.test.ts
corepack pnpm --filter @diplomat/web test -- api.test.ts App.test.tsx
corepack pnpm --filter @diplomat/desktop test
```

Expected: all focused suites pass.

- [ ] **Step 4: Run full repository verification**

Run:

```powershell
.\scripts\check.ps1
```

Expected: full verification passes with no test failures.

- [ ] **Step 5: Run browser verification**

Start Worker and Web development servers from this worktree, open `http://localhost:1420`, and verify:

- Worker status is visible.
- Recent Projects panel appears.
- Manual path fallback appears in browser mode.
- Create Project is disabled until a source path is provided.
- Existing subtitle workbench panels still render.

- [ ] **Step 6: Stage gate review**

Review M2b against the roadmap:

- Developer can run desktop development app without manually starting Worker in a separate terminal.
- User can select a video through a file picker in desktop mode.
- Project can be reopened after app restart.
- Existing M2a databases still work.
- Older development databases migrate or fail with clear diagnostics.
- `.\scripts\check.ps1` passes.

- [ ] **Step 7: Commit docs**

Run:

```powershell
git add docs/development/m2b-usability-foundation.md docs/development/m2a-workbench-loop.md README.md docs/superpowers/plans/2026-06-07-diplomat-m2b-usability-foundation.md
git commit -m "docs: add m2b usability workflow guide"
```

