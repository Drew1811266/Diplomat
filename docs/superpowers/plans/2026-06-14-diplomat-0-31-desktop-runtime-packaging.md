# Diplomat 0.31 Desktop Runtime Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows desktop app launch a packaged Worker and packaged FFmpeg/FFprobe runtime without depending on a developer checkout.

**Architecture:** Keep the local HTTP Worker boundary. Split desktop runtime startup into explicit development and packaged launch modes. Use Tauri bundle metadata for sidecar/resource packaging and keep environment variable overrides for development and emergency support.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, FastAPI Worker, PowerShell release scripts, FFmpeg/FFprobe.

---

## Files

- Modify: `apps/desktop/src-tauri/src/main.rs`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/web/src/desktop.ts`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`
- Modify: `scripts/verify-release-assets.mjs`
- Create: `scripts/verify-0.31-desktop-runtime.ps1`
- Create: `docs/development/0-31-stage-gate-review.md` during stage review

## Task 0: Advance Version Metadata To 0.31.0

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/desktop/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/Cargo.lock`
- Modify: `worker/pyproject.toml`
- Modify: `README.md`
- Modify: `scripts/verify-version.mjs`

- [ ] **Step 1: Update version strings**

Set every package and release metadata value to `0.31.0`. In `scripts/verify-version.mjs`, set:

```js
const expectedVersion = "0.31.0";
```

In `README.md`, update the version section to:

```markdown
Current project version: **0.31.0**
Release tag: **v0.31**
```

- [ ] **Step 2: Regenerate lockfile metadata**

Run:

```powershell
corepack pnpm install --lockfile-only
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

This refreshes `Cargo.lock` metadata for the local desktop package after the `Cargo.toml` version changes.

- [ ] **Step 3: Verify version metadata**

Run:

```powershell
node .\scripts\verify-version.mjs
```

Expected: `All release version metadata matches 0.31.0.`

- [ ] **Step 4: Commit**

```powershell
git add package.json apps/web/package.json apps/desktop/package.json packages/shared/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock worker/pyproject.toml README.md scripts/verify-version.mjs pnpm-lock.yaml
git commit -m "chore(release): advance version to 0.31.0"
```

## Task 1: Model Desktop Worker Launch Modes

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Write failing Rust tests**

Add tests to `apps/desktop/src-tauri/src/main.rs` inside the existing `#[cfg(test)] mod tests` block:

```rust
#[test]
fn packaged_worker_command_uses_sidecar_path_and_app_dirs() {
    let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Users\Drew\AppData\Local\Diplomat"));
    let config = WorkerLaunchConfig::packaged(
        PathBuf::from(r"C:\Program Files\Diplomat\diplomat-worker.exe"),
        &directories,
        "C:\\Program Files\\Diplomat\\resources\\ffmpeg.exe".to_string(),
        "C:\\Program Files\\Diplomat\\resources\\ffprobe.exe".to_string(),
    );

    assert_eq!(config.program, PathBuf::from(r"C:\Program Files\Diplomat\diplomat-worker.exe"));
    assert_eq!(config.args, Vec::<String>::new());
    assert!(config.env.iter().any(|(key, value)| key == "DIPLOMAT_DATA_DIR" && value.ends_with(r"Diplomat\data")));
    assert!(config.env.iter().any(|(key, value)| key == "DIPLOMAT_FFMPEG_PATH" && value.ends_with("ffmpeg.exe")));
    assert!(config.env.iter().any(|(key, value)| key == "DIPLOMAT_FFPROBE_PATH" && value.ends_with("ffprobe.exe")));
    assert_eq!(config.mode, "packaged");
}

#[test]
fn development_worker_command_keeps_repo_app_dir() {
    let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
    let config = WorkerLaunchConfig::development(
        PathBuf::from(r"D:\Software Project\Diplomat"),
        &directories,
        "ffmpeg".to_string(),
        "ffprobe".to_string(),
    );

    assert_eq!(config.program, PathBuf::from("python"));
    assert_eq!(
        config.args,
        vec![
            "-m",
            "uvicorn",
            "diplomat_worker.api.app:app",
            "--app-dir",
            "worker",
            "--host",
            "127.0.0.1",
            "--port",
            "8765",
        ]
    );
    assert_eq!(config.current_dir, Some(PathBuf::from(r"D:\Software Project\Diplomat")));
    assert_eq!(config.mode, "development");
}
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: Rust compilation fails because `WorkerLaunchConfig` does not exist.

- [ ] **Step 3: Implement `WorkerLaunchConfig`**

Add near the runtime structs in `apps/desktop/src-tauri/src/main.rs`:

```rust
#[derive(Clone, Debug, Eq, PartialEq)]
struct WorkerLaunchConfig {
    mode: String,
    program: PathBuf,
    args: Vec<String>,
    current_dir: Option<PathBuf>,
    env: Vec<(String, String)>,
}

impl WorkerLaunchConfig {
    fn packaged(
        worker_path: PathBuf,
        directories: &RuntimeDirectories,
        ffmpeg_path: String,
        ffprobe_path: String,
    ) -> Self {
        let mut env = worker_environment(directories);
        env.push(("DIPLOMAT_FFMPEG_PATH".to_string(), ffmpeg_path));
        env.push(("DIPLOMAT_FFPROBE_PATH".to_string(), ffprobe_path));
        Self {
            mode: "packaged".to_string(),
            program: worker_path,
            args: Vec::new(),
            current_dir: None,
            env,
        }
    }

    fn development(
        repo_root: PathBuf,
        directories: &RuntimeDirectories,
        ffmpeg_path: String,
        ffprobe_path: String,
    ) -> Self {
        let mut env = worker_environment(directories);
        env.push(("DIPLOMAT_FFMPEG_PATH".to_string(), ffmpeg_path));
        env.push(("DIPLOMAT_FFPROBE_PATH".to_string(), ffprobe_path));
        Self {
            mode: "development".to_string(),
            program: PathBuf::from("python"),
            args: vec![
                "-m".to_string(),
                "uvicorn".to_string(),
                "diplomat_worker.api.app:app".to_string(),
                "--app-dir".to_string(),
                "worker".to_string(),
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                "8765".to_string(),
            ],
            current_dir: Some(repo_root),
            env,
        }
    }
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run:

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: Rust tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): model worker launch modes"
```

## Task 2: Resolve Packaged Worker And Tool Paths

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add failing tests for runtime path resolution**

Add tests:

```rust
#[test]
fn packaged_resource_path_prefers_env_override() {
    let path = packaged_or_configured_tool_path(
        Some("C:/Tools/ffmpeg.exe"),
        Some(PathBuf::from(r"C:\Program Files\Diplomat\resources\ffmpeg.exe")),
        "ffmpeg",
    );

    assert_eq!(path, "C:/Tools/ffmpeg.exe");
}

#[test]
fn packaged_resource_path_uses_resource_when_env_missing() {
    let path = packaged_or_configured_tool_path(
        None,
        Some(PathBuf::from(r"C:\Program Files\Diplomat\resources\ffprobe.exe")),
        "ffprobe",
    );

    assert_eq!(path, r"C:\Program Files\Diplomat\resources\ffprobe.exe");
}

#[test]
fn packaged_resource_path_falls_back_to_path_name() {
    let path = packaged_or_configured_tool_path(None, None, "ffmpeg");

    assert_eq!(path, "ffmpeg");
}
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: compile failure because `packaged_or_configured_tool_path` does not exist.

- [ ] **Step 3: Implement resolver**

Add:

```rust
fn packaged_or_configured_tool_path(
    configured: Option<&str>,
    packaged: Option<PathBuf>,
    fallback: &str,
) -> String {
    if let Some(value) = configured.map(str::trim).filter(|value| !value.is_empty()) {
        return value.to_string();
    }
    if let Some(path) = packaged {
        return path_to_string(&path);
    }
    fallback.to_string()
}
```

Then update `ffmpeg_status()` and `ffprobe_status()` to call the new helper with a packaged path function. Add this simple function first:

```rust
fn packaged_resource_candidate(name: &str) -> Option<PathBuf> {
    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .map(|dir| dir.join("resources").join(name))
        .filter(|path| path.exists())
}
```

- [ ] **Step 4: Run tests**

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: Rust tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): resolve packaged runtime tools"
```

## Task 3: Use Launch Config In `start_worker`

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Replace direct command construction**

In `start_worker`, replace the direct `Command::new("python")` setup with:

```rust
    let directories = runtime_directories()?;
    let diagnostics = RuntimeDiagnostics::from_directories(&directories);
    let ffmpeg_path = packaged_or_configured_tool_path(
        env::var("DIPLOMAT_FFMPEG_PATH").ok().as_deref(),
        packaged_resource_candidate("ffmpeg.exe"),
        "ffmpeg",
    );
    let ffprobe_path = packaged_or_configured_tool_path(
        env::var("DIPLOMAT_FFPROBE_PATH").ok().as_deref(),
        packaged_resource_candidate("ffprobe.exe"),
        "ffprobe",
    );
    let launch_config = match packaged_worker_candidate() {
        Some(worker_path) => WorkerLaunchConfig::packaged(worker_path, &directories, ffmpeg_path, ffprobe_path),
        None => WorkerLaunchConfig::development(find_repo_root()?, &directories, ffmpeg_path, ffprobe_path),
    };
```

Add the candidate helper:

```rust
fn packaged_worker_candidate() -> Option<PathBuf> {
    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .map(|dir| dir.join("diplomat-worker.exe"))
        .filter(|path| path.exists())
}
```

Then build the command from `launch_config`:

```rust
    let mut command = Command::new(&launch_config.program);
    command
        .args(&launch_config.args)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    if let Some(current_dir) = &launch_config.current_dir {
        command.current_dir(current_dir);
    }
    for (key, value) in &launch_config.env {
        command.env(key, value);
    }
```

- [ ] **Step 2: Run desktop tests**

```powershell
corepack pnpm --dir apps/desktop test
```

Expected: Rust tests pass.

- [ ] **Step 3: Commit**

```powershell
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): launch worker from packaged config"
```

## Task 4: Expose Launcher Mode In Runtime Status

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`
- Modify: `apps/web/src/desktop.ts`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Add Rust field and tests**

Add `worker_launcher: String` to `RuntimeStatus` with serde camelCase. Update constructor to accept launcher mode. Add a test assertion:

```rust
assert_eq!(status.worker_launcher, "development");
```

- [ ] **Step 2: Update TypeScript desktop schema**

In `apps/web/src/desktop.ts`, add:

```ts
workerLauncher: string;
```

to the `DesktopRuntimeStatus` type.

- [ ] **Step 3: Render in Settings**

In `SettingsPage.tsx`, add a runtime detail row using the existing Settings layout pattern:

```tsx
<RuntimeDetail label={t("settings.runtime.workerLauncher")} value={runtimeStatus.workerLauncher} />
```

- [ ] **Step 4: Add translations**

In `en.ts`:

```ts
workerLauncher: "Worker launcher"
```

In `zh.ts`:

```ts
workerLauncher: "Worker 启动方式"
```

- [ ] **Step 5: Run tests**

```powershell
corepack pnpm --dir apps/desktop test
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx src/i18n/i18n.test.ts
corepack pnpm --dir apps/web typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/desktop/src-tauri/src/main.rs apps/web/src/desktop.ts apps/web/src/pages/SettingsPage.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(runtime): surface worker launcher mode"
```

## Task 5: Add Bundle Metadata And Release Asset Checks

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `scripts/verify-release-assets.mjs`

- [ ] **Step 1: Update Tauri bundle config**

Add planned package entries under `bundle`:

```json
"externalBin": ["binaries/diplomat-worker"],
"resources": ["resources/ffmpeg.exe", "resources/ffprobe.exe"]
```

The stage may use planned package-path entries in the verifier only if missing release artifacts are reported as blockers outside development mode. Do not commit third-party binaries without license approval.

- [ ] **Step 2: Update release asset verifier**

In `scripts/verify-release-assets.mjs`, assert:

```js
assertArrayIncludes(config.bundle.externalBin, "binaries/diplomat-worker", "Tauri bundle externalBin must include the Worker sidecar");
assertArrayIncludes(config.bundle.resources, "resources/ffmpeg.exe", "Tauri bundle resources must include ffmpeg.exe");
assertArrayIncludes(config.bundle.resources, "resources/ffprobe.exe", "Tauri bundle resources must include ffprobe.exe");
```

Add helper:

```js
function assertArrayIncludes(value, expected, message) {
  if (!Array.isArray(value) || !value.includes(expected)) {
    fail(message);
  }
}
```

- [ ] **Step 3: Run verifier**

```powershell
node .\scripts\verify-release-assets.mjs
```

Expected: pass after config is updated.

- [ ] **Step 4: Commit**

```powershell
git add apps/desktop/src-tauri/tauri.conf.json scripts/verify-release-assets.mjs
git commit -m "chore(release): verify packaged runtime metadata"
```

## Task 6: Add 0.31 Desktop Runtime Smoke Script

**Files:**
- Create: `scripts/verify-0.31-desktop-runtime.ps1`

- [ ] **Step 1: Create smoke script**

Create:

```powershell
$ErrorActionPreference = "Stop"

Write-Host "Verifying release metadata"
node .\scripts\verify-release-assets.mjs

Write-Host "Building web app"
corepack pnpm --dir apps/web build

Write-Host "Building desktop installer"
corepack pnpm --dir apps/desktop build

$installer = Get-ChildItem .\apps\desktop\src-tauri\target\release\bundle\nsis\*0.31*.exe -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -eq $installer) {
  throw "No NSIS installer was produced."
}

Write-Host "Produced installer: $($installer.FullName)"
```

- [ ] **Step 2: Run smoke script**

```powershell
.\scripts\verify-0.31-desktop-runtime.ps1
```

Expected: build completes and prints installer path.

- [ ] **Step 3: Commit**

```powershell
git add scripts/verify-0.31-desktop-runtime.ps1
git commit -m "chore(release): add desktop runtime smoke script"
```

## Task 7: Full Verification And Stage Gate

**Files:**
- Create: `docs/development/0-31-stage-gate-review.md`

- [ ] **Step 1: Run full verification**

```powershell
.\scripts\check.ps1
.\scripts\verify-0.31-desktop-runtime.ps1
```

Expected: both pass.

- [ ] **Step 2: Write stage gate review**

Create `docs/development/0-31-stage-gate-review.md` with:

```markdown
# Diplomat 0.31 Stage Gate Review

Date: 2026-06-14

Stage: 0.31 Desktop Runtime Packaging

## Scope Accepted

- Packaged and development Worker launch modes are modeled.
- Runtime status reports Worker launcher mode.
- Release asset verifier covers Worker and media runtime metadata.
- Desktop runtime smoke script builds the installer.

## Verification

- `.\scripts\check.ps1`: passed.
- `.\scripts\verify-0.31-desktop-runtime.ps1`: passed.

## Known Limitations

- Full clean-VM installation must be recorded before final 0.35 acceptance.
- Model weights remain downloaded by the user and are not bundled.

## Decision

0.31 is accepted for merge to `main`.
```

- [ ] **Step 3: Commit stage gate**

```powershell
git add docs/development/0-31-stage-gate-review.md
git commit -m "docs: accept 0.31 desktop runtime packaging"
```

- [ ] **Step 4: Merge and push after acceptance**

```powershell
git switch main
git merge --no-ff codex/0.31-desktop-runtime-packaging
git push origin main
```

Expected: merge and push succeed. If push fails, record the failure and do not start 0.32.
