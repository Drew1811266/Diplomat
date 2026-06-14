# Diplomat 0.21 Desktop Runtime Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the desktop runtime foundation for Diplomat 0.21: stable app directories, richer runtime status, FFmpeg/FFprobe detection, Worker lifecycle environment wiring, and Settings-page diagnostics.

**Architecture:** Keep OS-specific privileges in the Tauri Rust layer and expose one stable runtime status command to the React app. The Worker remains the durable project owner; the desktop shell supplies runtime directories and process lifecycle, and the Web app renders diagnostics without reconstructing paths.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, TanStack Query, Mantine, Vitest, pytest.

---

## File Structure

- Modify `apps/desktop/src-tauri/src/main.rs`
  - Add runtime directory structs and helpers.
  - Add FFmpeg/FFprobe probe helpers.
  - Add `runtime_status` command.
  - Start Worker with `DIPLOMAT_DATA_DIR`.
  - Write Worker logs under the runtime logs directory.
- Modify `apps/web/src/desktop.ts`
  - Add `DesktopRuntimeStatus` types.
  - Add `runtimeStatus()` bridge.
- Modify `apps/web/src/queries/queryKeys.ts`
  - Add a runtime status query key.
- Modify `apps/web/src/queries/workerQueries.ts`
  - Add `useDesktopRuntimeStatusQuery`.
  - Keep `useWorkerHealthQuery` unchanged for HTTP Worker health.
- Modify `apps/web/src/pages/SettingsPage.tsx`
  - Render runtime diagnostics in desktop mode.
  - Keep browser-mode Worker URL fallback.
  - Add Start Worker and Stop Worker controls.
- Modify `apps/web/src/pages/SettingsPage.test.tsx`
  - Cover browser fallback and desktop runtime diagnostics.
- Modify `apps/web/src/i18n/en.ts`
  - Add runtime diagnostics strings.
- Modify `apps/web/src/i18n/zh.ts`
  - Add matching Chinese strings.
- Modify `docs/development/0-21-desktop-runtime-foundation.md`
  - Add final verification notes if implementation changes the stage contract.

## Task 1: Rust Runtime Directory Contract

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add failing Rust tests for runtime directories**

Add these tests inside the existing `#[cfg(test)] mod tests` in `apps/desktop/src-tauri/src/main.rs`:

```rust
#[test]
fn runtime_directories_are_derived_from_base_path() {
    let base = PathBuf::from(r"C:\Users\Drew\AppData\Local\Diplomat");
    let directories = RuntimeDirectories::from_base(&base);

    assert_eq!(directories.data, r"C:\Users\Drew\AppData\Local\Diplomat\data");
    assert_eq!(directories.projects, r"C:\Users\Drew\AppData\Local\Diplomat\data\projects");
    assert_eq!(directories.models, r"C:\Users\Drew\AppData\Local\Diplomat\models");
    assert_eq!(directories.downloads, r"C:\Users\Drew\AppData\Local\Diplomat\downloads");
    assert_eq!(directories.exports, r"C:\Users\Drew\AppData\Local\Diplomat\exports");
    assert_eq!(directories.cache, r"C:\Users\Drew\AppData\Local\Diplomat\cache");
    assert_eq!(directories.logs, r"C:\Users\Drew\AppData\Local\Diplomat\logs");
    assert_eq!(directories.diagnostics, r"C:\Users\Drew\AppData\Local\Diplomat\diagnostics");
}

#[test]
fn runtime_diagnostics_paths_use_log_directory() {
    let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
    let diagnostics = RuntimeDiagnostics::from_directories(&directories);

    assert_eq!(diagnostics.worker_stdout_log, r"C:\Diplomat\logs\worker.stdout.log");
    assert_eq!(diagnostics.worker_stderr_log, r"C:\Diplomat\logs\worker.stderr.log");
}

#[test]
fn worker_environment_sets_data_directory() {
    let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
    let environment = worker_environment(&directories);

    assert_eq!(
        environment,
        vec![("DIPLOMAT_DATA_DIR".to_string(), r"C:\Diplomat\data".to_string())]
    );
}
```

- [ ] **Step 2: Run the failing Rust tests**

Run:

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: FAIL because `RuntimeDirectories`, `RuntimeDiagnostics`, and `worker_environment` do not exist.

- [ ] **Step 3: Add runtime directory structs and helpers**

Add these definitions near the existing `WorkerStatus` type in `apps/desktop/src-tauri/src/main.rs`:

```rust
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeDirectories {
    data: String,
    projects: String,
    models: String,
    downloads: String,
    exports: String,
    cache: String,
    logs: String,
    diagnostics: String,
}

impl RuntimeDirectories {
    fn from_base(base: &Path) -> Self {
        let data = base.join("data");
        Self {
            data: path_to_string(&data),
            projects: path_to_string(&data.join("projects")),
            models: path_to_string(&base.join("models")),
            downloads: path_to_string(&base.join("downloads")),
            exports: path_to_string(&base.join("exports")),
            cache: path_to_string(&base.join("cache")),
            logs: path_to_string(&base.join("logs")),
            diagnostics: path_to_string(&base.join("diagnostics")),
        }
    }

    fn ensure_created(&self) -> Result<(), String> {
        for path in [
            &self.data,
            &self.projects,
            &self.models,
            &self.downloads,
            &self.exports,
            &self.cache,
            &self.logs,
            &self.diagnostics,
        ] {
            fs::create_dir_all(path)
                .map_err(|error| format!("Unable to create runtime directory {path}: {error}"))?;
        }
        Ok(())
    }

    fn logs_path(&self) -> PathBuf {
        PathBuf::from(&self.logs)
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeDiagnostics {
    worker_stdout_log: String,
    worker_stderr_log: String,
}

impl RuntimeDiagnostics {
    fn from_directories(directories: &RuntimeDirectories) -> Self {
        let logs = directories.logs_path();
        Self {
            worker_stdout_log: path_to_string(&logs.join("worker.stdout.log")),
            worker_stderr_log: path_to_string(&logs.join("worker.stderr.log")),
        }
    }
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn app_base_dir() -> PathBuf {
    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
        .join("Diplomat")
}

fn runtime_directories() -> Result<RuntimeDirectories, String> {
    let directories = RuntimeDirectories::from_base(&app_base_dir());
    directories.ensure_created()?;
    Ok(directories)
}

fn worker_environment(directories: &RuntimeDirectories) -> Vec<(String, String)> {
    vec![("DIPLOMAT_DATA_DIR".to_string(), directories.data.clone())]
}
```

- [ ] **Step 4: Run the Rust tests**

Run:

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: PASS for the new directory tests and existing Worker status tests.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): add runtime directory contract"
```

## Task 2: FFmpeg And FFprobe Runtime Probes

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add failing Rust tests for tool status classification**

Add these tests inside the existing `#[cfg(test)] mod tests`:

```rust
#[test]
fn tool_status_available_uses_first_version_line() {
    let status = tool_status_from_probe(
        "ffmpeg",
        Ok("ffmpeg version 7.1-full_build\nconfiguration: --enable-gpl".to_string()),
    );

    assert_eq!(status.status, "available");
    assert_eq!(status.path, "ffmpeg");
    assert_eq!(status.version, Some("ffmpeg version 7.1-full_build".to_string()));
    assert_eq!(status.message, "ffmpeg is available.");
}

#[test]
fn tool_status_missing_reports_missing() {
    let status = tool_status_from_probe(
        "ffmpeg",
        Err(ToolProbeError::Missing("program not found".to_string())),
    );

    assert_eq!(status.status, "missing");
    assert_eq!(status.path, "ffmpeg");
    assert_eq!(status.version, None);
    assert_eq!(status.message, "program not found");
}

#[test]
fn tool_status_error_reports_command_failure() {
    let status = tool_status_from_probe(
        "ffprobe",
        Err(ToolProbeError::CommandFailed("exit code 1".to_string())),
    );

    assert_eq!(status.status, "error");
    assert_eq!(status.path, "ffprobe");
    assert_eq!(status.version, None);
    assert_eq!(status.message, "exit code 1");
}

#[test]
fn configured_tool_path_uses_environment_before_default() {
    let path = configured_tool_path(Some("C:/Tools/ffmpeg.exe"), "ffmpeg");

    assert_eq!(path, "C:/Tools/ffmpeg.exe");
}

#[test]
fn configured_tool_path_uses_default_when_environment_is_empty() {
    let path = configured_tool_path(Some("  "), "ffmpeg");

    assert_eq!(path, "ffmpeg");
}
```

- [ ] **Step 2: Run the failing Rust tests**

Run:

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: FAIL because `ToolStatus`, `ToolProbeError`, `tool_status_from_probe`, and `configured_tool_path` do not exist.

- [ ] **Step 3: Add tool status types and probe helpers**

Add these definitions near the runtime directory structs:

```rust
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolStatus {
    status: String,
    path: String,
    version: Option<String>,
    message: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum ToolProbeError {
    Missing(String),
    CommandFailed(String),
}

fn configured_tool_path(configured: Option<&str>, fallback: &str) -> String {
    configured
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn probe_cli_tool(path: &str) -> Result<String, ToolProbeError> {
    let output = Command::new(path).arg("-version").output().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            ToolProbeError::Missing(format!("{path} was not found. Install FFmpeg or configure the bundled runtime path."))
        } else {
            ToolProbeError::CommandFailed(format!("Unable to run {path}: {error}"))
        }
    })?;

    if !output.status.success() {
        return Err(ToolProbeError::CommandFailed(format!(
            "{path} -version exited with status {}",
            output.status
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn tool_status_from_probe(path: &str, result: Result<String, ToolProbeError>) -> ToolStatus {
    match result {
        Ok(output) => {
            let version = output.lines().next().unwrap_or("").trim().to_string();
            ToolStatus {
                status: "available".to_string(),
                path: path.to_string(),
                version: if version.is_empty() { None } else { Some(version) },
                message: format!("{path} is available."),
            }
        }
        Err(ToolProbeError::Missing(message)) => ToolStatus {
            status: "missing".to_string(),
            path: path.to_string(),
            version: None,
            message,
        },
        Err(ToolProbeError::CommandFailed(message)) => ToolStatus {
            status: "error".to_string(),
            path: path.to_string(),
            version: None,
            message,
        },
    }
}

fn ffmpeg_status() -> ToolStatus {
    let path = configured_tool_path(env::var("DIPLOMAT_FFMPEG_PATH").ok().as_deref(), "ffmpeg");
    tool_status_from_probe(&path, probe_cli_tool(&path))
}

fn ffprobe_status() -> ToolStatus {
    let path = configured_tool_path(env::var("DIPLOMAT_FFPROBE_PATH").ok().as_deref(), "ffprobe");
    tool_status_from_probe(&path, probe_cli_tool(&path))
}
```

- [ ] **Step 4: Run the Rust tests**

Run:

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): report ffmpeg runtime tools"
```

## Task 3: Runtime Status Command And Worker Environment

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add failing Rust tests for runtime status composition**

Add these tests inside `#[cfg(test)] mod tests`:

```rust
#[test]
fn runtime_status_contains_worker_directories_tools_and_diagnostics() {
    let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
    let worker = WorkerStatus::new("stopped", "none", "Worker process is not running.");
    let ffmpeg = ToolStatus {
        status: "available".to_string(),
        path: "ffmpeg".to_string(),
        version: Some("ffmpeg version test".to_string()),
        message: "ffmpeg is available.".to_string(),
    };
    let ffprobe = ToolStatus {
        status: "missing".to_string(),
        path: "ffprobe".to_string(),
        version: None,
        message: "ffprobe was not found.".to_string(),
    };

    let status = RuntimeStatus::new(worker, directories, ffmpeg, ffprobe);

    assert_eq!(status.mode, "desktop");
    assert_eq!(status.worker.status, "stopped");
    assert_eq!(status.directories.data, r"C:\Diplomat\data");
    assert_eq!(status.ffmpeg.status, "available");
    assert_eq!(status.ffprobe.status, "missing");
    assert_eq!(status.diagnostics.worker_stdout_log, r"C:\Diplomat\logs\worker.stdout.log");
}
```

- [ ] **Step 2: Run the failing Rust tests**

Run:

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: FAIL because `RuntimeStatus` does not exist.

- [ ] **Step 3: Add RuntimeStatus and the runtime_status Tauri command**

Add this type near the other serializable structs:

```rust
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatus {
    mode: String,
    worker: WorkerStatus,
    directories: RuntimeDirectories,
    ffmpeg: ToolStatus,
    ffprobe: ToolStatus,
    diagnostics: RuntimeDiagnostics,
}

impl RuntimeStatus {
    fn new(
        worker: WorkerStatus,
        directories: RuntimeDirectories,
        ffmpeg: ToolStatus,
        ffprobe: ToolStatus,
    ) -> Self {
        let diagnostics = RuntimeDiagnostics::from_directories(&directories);
        Self {
            mode: "desktop".to_string(),
            worker,
            directories,
            ffmpeg,
            ffprobe,
            diagnostics,
        }
    }
}
```

Add this Tauri command near `worker_status`:

```rust
#[tauri::command]
fn runtime_status(state: State<'_, Mutex<WorkerProcessState>>) -> Result<RuntimeStatus, String> {
    let directories = runtime_directories()?;
    let worker = {
        let mut guard = state
            .lock()
            .map_err(|_| "Worker process state lock is poisoned".to_string())?;
        clear_exited_child(&mut guard);
        if guard.child.is_some() {
            worker_status_from_state(&guard)
        } else {
            drop(guard);
            classify_worker_probe(probe_worker_health())
        }
    };

    Ok(RuntimeStatus::new(
        worker,
        directories,
        ffmpeg_status(),
        ffprobe_status(),
    ))
}
```

Register the command in the `invoke_handler!` list:

```rust
runtime_status,
```

- [ ] **Step 4: Wire Worker logs and DIPLOMAT_DATA_DIR into start_worker**

In `start_worker`, replace the `diagnostics_log_dir()?` call with:

```rust
let directories = runtime_directories()?;
let diagnostics = RuntimeDiagnostics::from_directories(&directories);
let stdout = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&diagnostics.worker_stdout_log)
    .map_err(|error| format!("Unable to open Worker stdout log: {error}"))?;
let stderr = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&diagnostics.worker_stderr_log)
    .map_err(|error| format!("Unable to open Worker stderr log: {error}"))?;

let mut command = Command::new("python");
command
    .args([
        "-m",
        "uvicorn",
        "diplomat_worker.api.app:app",
        "--app-dir",
        "worker",
        "--host",
        "127.0.0.1",
        "--port",
        "8765",
    ])
    .current_dir(repo_root)
    .stdin(Stdio::null())
    .stdout(Stdio::from(stdout))
    .stderr(Stdio::from(stderr));
for (key, value) in worker_environment(&directories) {
    command.env(key, value);
}
let child = command
    .spawn()
    .map_err(|error| format!("Unable to start Diplomat Worker: {error}"))?;
```

Remove `diagnostics_log_dir` after all callers are gone.

- [ ] **Step 5: Run Rust formatting and tests**

Run:

```powershell
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml
corepack pnpm --dir apps/desktop test
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```powershell
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): expose runtime status"
```

## Task 4: Web Desktop Runtime Bridge

**Files:**
- Modify: `apps/web/src/desktop.ts`
- Modify: `apps/web/src/queries/queryKeys.ts`
- Modify: `apps/web/src/queries/workerQueries.ts`
- Test: `apps/web/src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Add failing SettingsPage tests for desktop runtime diagnostics**

Add this mock near the imports in `apps/web/src/pages/SettingsPage.test.tsx`:

```ts
vi.mock("../desktop", async () => {
  const actual = await vi.importActual<typeof import("../desktop")>("../desktop");
  return {
    ...actual,
    isDesktopRuntime: vi.fn(() => false),
    runtimeStatus: vi.fn(async () => null),
    startWorker: vi.fn(async () => null),
    stopWorker: vi.fn(async () => null),
    openPathInFileManager: vi.fn(async () => undefined)
  };
});
```

Add these imports:

```ts
import {
  isDesktopRuntime,
  openPathInFileManager,
  runtimeStatus,
  startWorker,
  stopWorker
} from "../desktop";
```

Add this runtime status fixture:

```ts
const desktopRuntimeStatus = {
  mode: "desktop",
  worker: {
    status: "running",
    endpoint: "http://127.0.0.1:8765",
    owner: "diplomat",
    message: "Diplomat Worker is reachable."
  },
  directories: {
    data: "C:/Users/Drew/AppData/Local/Diplomat/data",
    projects: "C:/Users/Drew/AppData/Local/Diplomat/data/projects",
    models: "C:/Users/Drew/AppData/Local/Diplomat/models",
    downloads: "C:/Users/Drew/AppData/Local/Diplomat/downloads",
    exports: "C:/Users/Drew/AppData/Local/Diplomat/exports",
    cache: "C:/Users/Drew/AppData/Local/Diplomat/cache",
    logs: "C:/Users/Drew/AppData/Local/Diplomat/logs",
    diagnostics: "C:/Users/Drew/AppData/Local/Diplomat/diagnostics"
  },
  ffmpeg: {
    status: "available",
    path: "ffmpeg",
    version: "ffmpeg version 7.1",
    message: "ffmpeg is available."
  },
  ffprobe: {
    status: "missing",
    path: "ffprobe",
    version: null,
    message: "ffprobe was not found."
  },
  diagnostics: {
    workerStdoutLog: "C:/Users/Drew/AppData/Local/Diplomat/logs/worker.stdout.log",
    workerStderrLog: "C:/Users/Drew/AppData/Local/Diplomat/logs/worker.stderr.log"
  }
};
```

Add these tests:

```ts
it("renders browser-mode runtime fallback when Tauri is unavailable", () => {
  vi.mocked(isDesktopRuntime).mockReturnValue(false);

  renderWithProviders(<SettingsPage />);

  expect(screen.getByText("Desktop runtime controls are unavailable in browser mode.")).toBeInTheDocument();
  expect(screen.getByLabelText("Worker URL")).toHaveValue("http://127.0.0.1:8765");
});

it("renders desktop runtime diagnostics and controls", async () => {
  vi.mocked(isDesktopRuntime).mockReturnValue(true);
  vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);

  renderWithProviders(<SettingsPage />);

  expect(await screen.findByLabelText("Worker endpoint")).toHaveValue("http://127.0.0.1:8765");
  expect(screen.getByLabelText("Worker status")).toHaveValue("running");
  expect(screen.getByLabelText("FFmpeg status")).toHaveValue("available");
  expect(screen.getByLabelText("FFprobe status")).toHaveValue("missing");
  expect(screen.getByLabelText("Data directory")).toHaveValue("C:/Users/Drew/AppData/Local/Diplomat/data");
  expect(screen.getByRole("button", { name: "Start Worker" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Stop Worker" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open logs" })).toBeInTheDocument();
});

it("starts and stops the worker from settings", async () => {
  const user = userEvent.setup();
  vi.mocked(isDesktopRuntime).mockReturnValue(true);
  vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);
  vi.mocked(startWorker).mockResolvedValue(desktopRuntimeStatus.worker);
  vi.mocked(stopWorker).mockResolvedValue({
    ...desktopRuntimeStatus.worker,
    status: "stopped",
    owner: "none",
    message: "Worker process managed by this desktop session is stopped."
  });

  renderWithProviders(<SettingsPage />);

  await user.click(await screen.findByRole("button", { name: "Start Worker" }));
  await user.click(screen.getByRole("button", { name: "Stop Worker" }));

  expect(startWorker).toHaveBeenCalledTimes(1);
  expect(stopWorker).toHaveBeenCalledTimes(1);
});

it("opens the log directory from settings", async () => {
  const user = userEvent.setup();
  vi.mocked(isDesktopRuntime).mockReturnValue(true);
  vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);

  renderWithProviders(<SettingsPage />);

  await user.click(await screen.findByRole("button", { name: "Open logs" }));

  expect(openPathInFileManager).toHaveBeenCalledWith("C:/Users/Drew/AppData/Local/Diplomat/logs");
});
```

- [ ] **Step 2: Run failing focused Web tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx
```

Expected: FAIL because `runtimeStatus` and runtime UI do not exist.

- [ ] **Step 3: Add desktop runtime types and bridge**

In `apps/web/src/desktop.ts`, add:

```ts
export type DesktopRuntimeDirectories = {
  data: string;
  projects: string;
  models: string;
  downloads: string;
  exports: string;
  cache: string;
  logs: string;
  diagnostics: string;
};

export type DesktopToolStatus = {
  status: "available" | "missing" | "error" | string;
  path: string;
  version: string | null;
  message: string;
};

export type DesktopRuntimeDiagnostics = {
  workerStdoutLog: string;
  workerStderrLog: string;
};

export type DesktopRuntimeStatus = {
  mode: string;
  worker: DesktopWorkerStatus;
  directories: DesktopRuntimeDirectories;
  ffmpeg: DesktopToolStatus;
  ffprobe: DesktopToolStatus;
  diagnostics: DesktopRuntimeDiagnostics;
};
```

Add:

```ts
export async function runtimeStatus(): Promise<DesktopRuntimeStatus | null> {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invokeDesktop<DesktopRuntimeStatus>("runtime_status");
}
```

- [ ] **Step 4: Add query key and query hook**

In `apps/web/src/queries/queryKeys.ts`, add:

```ts
desktopRuntimeStatus: ["desktop", "runtime-status"] as const,
```

In `apps/web/src/queries/workerQueries.ts`, import `runtimeStatus` and add:

```ts
export function useDesktopRuntimeStatusQuery() {
  return useQuery({
    queryKey: queryKeys.desktopRuntimeStatus,
    queryFn: () => runtimeStatus(),
    enabled: isDesktopRuntime()
  });
}
```

Remove the older duplicate `useDesktopWorkerStatusQuery` only after no component uses it.

- [ ] **Step 5: Run focused Web tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx
```

Expected: tests still fail until Settings UI is updated.

- [ ] **Step 6: Commit bridge changes after Settings UI is complete in Task 5**

Do not commit Task 4 alone; it is intentionally paired with Task 5 because the new bridge is unused until the UI renders it.

## Task 5: Settings Runtime Diagnostics UI

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`
- Modify: `apps/web/src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Update SettingsPage imports**

In `apps/web/src/pages/SettingsPage.tsx`, replace the Mantine import with:

```ts
import {
  Badge,
  Box,
  Button,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title
} from "@mantine/core";
```

Add:

```ts
import { IconFolderOpen, IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { openPathInFileManager, startWorker, stopWorker } from "../desktop";
import { useDesktopRuntimeStatusQuery } from "../queries/workerQueries";
```

- [ ] **Step 2: Add runtime helper components**

Add these helpers above `SettingsPage`:

```tsx
function ReadonlyField({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return <TextInput label={label} value={value} readOnly />;
}

function RuntimePathField({
  label,
  value,
  openLabel
}: {
  label: string;
  value: string;
  openLabel: string;
}) {
  return (
    <Group align="flex-end" gap="xs">
      <Box style={{ flex: 1 }}>
        <ReadonlyField label={label} value={value} />
      </Box>
      <Button
        type="button"
        variant="default"
        leftSection={<IconFolderOpen size={16} />}
        onClick={() => void openPathInFileManager(value)}
      >
        {openLabel}
      </Button>
    </Group>
  );
}
```

- [ ] **Step 3: Render desktop runtime status**

Inside `SettingsPage`, add:

```tsx
const runtime = useDesktopRuntimeStatusQuery();
const runtimeStatus = runtime.data;
```

Replace the current Worker settings section with:

```tsx
<SettingsSection title={t("settings.runtime")}>
  {runtimeStatus ? (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color={runtimeStatus.worker.status === "running" ? "teal" : "gray"}>
          {runtimeStatus.worker.status}
        </Badge>
        <Text size="sm" c="dimmed">
          {runtimeStatus.worker.message}
        </Text>
      </Group>
      <Group grow align="flex-start">
        <ReadonlyField label={t("settings.workerEndpoint")} value={runtimeStatus.worker.endpoint} />
        <ReadonlyField label={t("settings.workerStatus")} value={runtimeStatus.worker.status} />
      </Group>
      <Group grow align="flex-start">
        <ReadonlyField label={t("settings.ffmpegStatus")} value={runtimeStatus.ffmpeg.status} />
        <ReadonlyField label={t("settings.ffprobeStatus")} value={runtimeStatus.ffprobe.status} />
      </Group>
      <ReadonlyField label={t("settings.ffmpegVersion")} value={runtimeStatus.ffmpeg.version ?? runtimeStatus.ffmpeg.message} />
      <ReadonlyField label={t("settings.ffprobeVersion")} value={runtimeStatus.ffprobe.version ?? runtimeStatus.ffprobe.message} />
      <Group gap="xs">
        <Button
          type="button"
          leftSection={<IconPlayerPlay size={16} />}
          onClick={() => void startWorker().then(() => runtime.refetch())}
        >
          {t("settings.startWorker")}
        </Button>
        <Button
          type="button"
          variant="default"
          leftSection={<IconPlayerStop size={16} />}
          onClick={() => void stopWorker().then(() => runtime.refetch())}
        >
          {t("settings.stopWorker")}
        </Button>
      </Group>
      <RuntimePathField
        label={t("settings.dataDirectory")}
        value={runtimeStatus.directories.data}
        openLabel={t("settings.openData")}
      />
      <RuntimePathField
        label={t("settings.modelsDirectory")}
        value={runtimeStatus.directories.models}
        openLabel={t("settings.openModels")}
      />
      <RuntimePathField
        label={t("settings.logsDirectory")}
        value={runtimeStatus.directories.logs}
        openLabel={t("settings.openLogs")}
      />
    </Stack>
  ) : (
    <Stack gap="xs">
      <ReadonlyField label={t("settings.workerUrl")} value={workerBaseUrl()} />
      <Text size="sm" c="dimmed">
        {t("settings.desktopRuntimeUnavailable")}
      </Text>
    </Stack>
  )}
</SettingsSection>
```

- [ ] **Step 4: Add i18n keys**

In both `apps/web/src/i18n/en.ts` and `apps/web/src/i18n/zh.ts`, extend `settings`.

English:

```ts
runtime: "Runtime",
desktopRuntimeUnavailable: "Desktop runtime controls are unavailable in browser mode.",
workerEndpoint: "Worker endpoint",
workerStatus: "Worker status",
ffmpegStatus: "FFmpeg status",
ffprobeStatus: "FFprobe status",
ffmpegVersion: "FFmpeg version",
ffprobeVersion: "FFprobe version",
startWorker: "Start Worker",
stopWorker: "Stop Worker",
dataDirectory: "Data directory",
modelsDirectory: "Models directory",
logsDirectory: "Logs directory",
openData: "Open data",
openModels: "Open models",
openLogs: "Open logs",
```

Chinese:

```ts
runtime: "运行时",
desktopRuntimeUnavailable: "浏览器模式下无法使用桌面运行时控制。",
workerEndpoint: "Worker 地址",
workerStatus: "Worker 状态",
ffmpegStatus: "FFmpeg 状态",
ffprobeStatus: "FFprobe 状态",
ffmpegVersion: "FFmpeg 版本",
ffprobeVersion: "FFprobe 版本",
startWorker: "启动 Worker",
stopWorker: "停止 Worker",
dataDirectory: "数据目录",
modelsDirectory: "模型目录",
logsDirectory: "日志目录",
openData: "打开数据",
openModels: "打开模型",
openLogs: "打开日志",
```

- [ ] **Step 5: Run focused Web tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx src/i18n/i18n.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run Web typecheck**

Run:

```powershell
corepack pnpm --dir apps/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Tasks 4 and 5**

Run:

```powershell
git add apps/web/src/desktop.ts apps/web/src/queries/queryKeys.ts apps/web/src/queries/workerQueries.ts apps/web/src/pages/SettingsPage.tsx apps/web/src/pages/SettingsPage.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): show desktop runtime diagnostics"
```

## Task 6: Runtime Documentation And Stage Verification Notes

**Files:**
- Modify: `docs/development/0-21-desktop-runtime-foundation.md`

- [ ] **Step 1: Update the manual verification section with implemented command names**

Append this subsection under `## Testing Requirements`:

````markdown
### Focused Verification Commands

```powershell
corepack pnpm --dir apps/desktop test
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx src/i18n/i18n.test.ts
corepack pnpm --dir apps/web typecheck
```

### Stage Gate Evidence To Capture

The 0.21 stage gate review must record:

- `runtime_status` JSON from a desktop development run.
- Worker log paths under `%LOCALAPPDATA%\Diplomat\logs`.
- FFmpeg and FFprobe status shown in Settings.
- Whether FFmpeg and FFprobe were found through `PATH` or environment variables.
- Project creation storage path after Worker starts from the desktop shell.
```
````

- [ ] **Step 2: Run markdown diff check**

Run:

```powershell
git diff --check
```

Expected: PASS with no whitespace errors.

- [ ] **Step 3: Commit documentation update**

Run:

```powershell
git add docs/development/0-21-desktop-runtime-foundation.md
git commit -m "docs: document 0.21 runtime verification"
```

## Task 7: Full Stage Verification

**Files:**
- No code edits.

- [ ] **Step 1: Run full repository verification**

Run:

```powershell
.\scripts\check.ps1
```

Expected: PASS.

- [ ] **Step 2: Run desktop Rust check if full verification did not already show Cargo test details clearly**

Run:

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: PASS.

- [ ] **Step 3: Run manual desktop verification**

Run:

```powershell
corepack pnpm --filter @diplomat/desktop dev
```

Manual checks:

1. Open Settings.
2. Confirm Runtime section appears.
3. Click Start Worker.
4. Confirm Worker status becomes `running`.
5. Confirm FFmpeg and FFprobe statuses are visible.
6. Click Open logs and confirm File Explorer opens the logs directory.
7. Import a local video from Project Center.
8. Create a project.
9. Confirm the project appears in the project list.
10. Click Stop Worker and confirm the status refreshes after returning to Settings.

- [ ] **Step 4: Create the 0.21 stage gate review document**

Create `docs/development/0-21-stage-gate-review.md` with:

````markdown
# Diplomat 0.21 Stage Gate Review

## Gate Decision

Status: accepted on 2026-06-14.

## Scope Reviewed

- Desktop runtime directories.
- Worker lifecycle environment.
- Runtime status command.
- FFmpeg and FFprobe detection.
- Settings runtime diagnostics UI.
- Browser-mode fallback.

## Automated Verification Evidence

```powershell
.\scripts\check.ps1
corepack pnpm --dir apps/desktop test
```

Results:

- `.\scripts\check.ps1`: passed.
- `corepack pnpm --dir apps/desktop test`: passed.

## Manual Verification Evidence

1. Started the Tauri development app.
2. Opened Settings.
3. Started Worker from Settings.
4. Confirmed Worker status reached `running`.
5. Confirmed FFmpeg and FFprobe statuses were visible.
6. Opened the logs directory from Settings.
7. Created a project from a local video through the desktop picker.
8. Confirmed the project appeared in the project list.
9. Stopped Worker from Settings.

## Remaining Limitations

- 0.21 does not bundle an FFmpeg binary.
- 0.21 does not package a Python Worker sidecar.
- The fixed Worker port remains `8765`.

## Acceptance

0.21 is accepted because the desktop app now owns runtime directories, Worker lifecycle environment, runtime diagnostics, and FFmpeg/FFprobe visibility while preserving the existing project workflow.
````

- [ ] **Step 5: Commit the stage gate review**

Run:

```powershell
git add docs/development/0-21-stage-gate-review.md
git commit -m "docs: accept 0.21 stage gate"
```

## Task 8: Merge And Push Accepted 0.21

**Files:**
- No code edits.

- [ ] **Step 1: Confirm branch status**

Run:

```powershell
git status --short --branch
```

Expected: clean branch `codex/0.21-desktop-runtime-foundation`.

- [ ] **Step 2: Switch to main**

Run:

```powershell
git switch main
```

Expected: switched to `main`.

- [ ] **Step 3: Merge the accepted branch**

Run:

```powershell
git merge --no-ff codex/0.21-desktop-runtime-foundation -m "merge: complete 0.21 desktop runtime foundation"
```

Expected: merge succeeds with no conflicts.

- [ ] **Step 4: Push main to GitHub**

Run:

```powershell
git push origin main
```

Expected: `main` is pushed to `origin`.

- [ ] **Step 5: Confirm remote state**

Run:

```powershell
git status --short --branch
```

Expected: `## main...origin/main` with no ahead/behind count and no working tree changes.

## Self-Review Checklist

- Spec coverage:
  - Stable runtime directories are covered by Task 1.
  - Runtime status command is covered by Task 3.
  - Worker `DIPLOMAT_DATA_DIR` environment is covered by Task 3.
  - FFmpeg and FFprobe detection are covered by Task 2.
  - Settings diagnostics are covered by Tasks 4 and 5.
  - Verification and stage gate are covered by Tasks 6 and 7.
  - Merge and GitHub push are covered by Task 8.
- Red-flag scan:
  - The plan contains no open-ended implementation steps.
- Type consistency:
  - Rust uses camelCase serialization.
  - TypeScript runtime fields match Rust serialized names.
  - Settings labels match English i18n test expectations.
