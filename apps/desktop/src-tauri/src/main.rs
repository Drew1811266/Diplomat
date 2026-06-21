#![cfg_attr(test, allow(dead_code))]

use std::{
    env,
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

const WORKER_ENDPOINT: &str = "http://127.0.0.1:8765";
const WORKER_HOST: &str = "127.0.0.1:8765";

#[derive(Default)]
struct WorkerProcessState {
    child: Option<Child>,
    launcher: Option<String>,
}

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
        let development_model_root = development_model_root(&repo_root);
        env.push(("DIPLOMAT_FFMPEG_PATH".to_string(), ffmpeg_path));
        env.push(("DIPLOMAT_FFPROBE_PATH".to_string(), ffprobe_path));
        env.push((
            "DIPLOMAT_DEVELOPMENT_MODEL_ROOT".to_string(),
            development_model_root.clone(),
        ));
        env.push((
            "DIPLOMAT_MODELS_DIR".to_string(),
            development_models_dir(&development_model_root),
        ));
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

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkerStatus {
    status: String,
    endpoint: String,
    owner: String,
    message: String,
}

impl WorkerStatus {
    fn new(status: &str, owner: &str, message: &str) -> Self {
        Self {
            status: status.to_string(),
            endpoint: WORKER_ENDPOINT.to_string(),
            owner: owner.to_string(),
            message: message.to_string(),
        }
    }
}

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

    fn for_worker_launch_config(&self, launch_config: &WorkerLaunchConfig) -> Self {
        let mut directories = self.clone();
        if launch_config.mode == "development" {
            if let Some((_, models_dir)) = launch_config
                .env
                .iter()
                .find(|(key, _)| key == "DIPLOMAT_MODELS_DIR")
            {
                directories.models = models_dir.clone();
            }
        }
        directories
    }

    fn for_worker_launcher(
        &self,
        worker_launcher: &str,
        ffmpeg_path: &str,
        ffprobe_path: &str,
    ) -> Self {
        if worker_launcher != "development" {
            return self.clone();
        }

        find_repo_root()
            .map(|repo_root| {
                WorkerLaunchConfig::development(
                    repo_root,
                    self,
                    ffmpeg_path.to_string(),
                    ffprobe_path.to_string(),
                )
            })
            .map(|launch_config| self.for_worker_launch_config(&launch_config))
            .unwrap_or_else(|_| self.clone())
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
            fs::create_dir_all(Path::new(path))
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

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolStatus {
    status: String,
    path: String,
    version: Option<String>,
    message: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatus {
    mode: String,
    worker_launcher: String,
    worker: WorkerStatus,
    directories: RuntimeDirectories,
    ffmpeg: ToolStatus,
    ffprobe: ToolStatus,
    diagnostics: RuntimeDiagnostics,
}

impl RuntimeStatus {
    fn new(
        worker: WorkerStatus,
        worker_launcher: &str,
        directories: RuntimeDirectories,
        ffmpeg: ToolStatus,
        ffprobe: ToolStatus,
    ) -> Self {
        let diagnostics = RuntimeDiagnostics::from_directories(&directories);
        Self {
            mode: "desktop".to_string(),
            worker_launcher: worker_launcher.to_string(),
            worker,
            directories,
            ffmpeg,
            ffprobe,
            diagnostics,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum ToolProbeError {
    Missing(String),
    CommandFailed(String),
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

fn development_model_root(repo_root: &Path) -> String {
    env::var("DIPLOMAT_DEVELOPMENT_MODEL_ROOT")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| path_to_string(&preferred_development_model_root(repo_root)))
}

fn development_models_dir(development_model_root: &str) -> String {
    env::var("DIPLOMAT_MODELS_DIR")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| path_to_string(&PathBuf::from(development_model_root).join("models")))
}

fn preferred_development_model_root(repo_root: &Path) -> PathBuf {
    if has_development_model_payload(repo_root) {
        return repo_root.to_path_buf();
    }
    if let Some(main_workspace) = parent_workspace_for_worktree(repo_root) {
        if has_development_model_payload(&main_workspace) {
            return main_workspace;
        }
    }
    repo_root.to_path_buf()
}

fn parent_workspace_for_worktree(repo_root: &Path) -> Option<PathBuf> {
    let worktrees_dir = repo_root.parent()?;
    if worktrees_dir.file_name().and_then(|name| name.to_str()) != Some(".worktrees") {
        return None;
    }
    worktrees_dir.parent().map(Path::to_path_buf)
}

fn has_development_model_payload(root: &Path) -> bool {
    contains_non_placeholder_file(&root.join("models").join("dev"), 8)
}

fn contains_non_placeholder_file(path: &Path, remaining_depth: usize) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    for entry in entries.flatten() {
        let child = entry.path();
        if child.is_file() {
            if child.file_name().and_then(|name| name.to_str()) != Some(".gitkeep") {
                return true;
            }
        } else if remaining_depth > 0
            && child.is_dir()
            && contains_non_placeholder_file(&child, remaining_depth - 1)
        {
            return true;
        }
    }
    false
}

fn packaged_resource_candidate(name: &str) -> Option<PathBuf> {
    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .map(|dir| dir.join("resources").join(name))
        .filter(|path| path.exists())
}

fn packaged_worker_candidate() -> Option<PathBuf> {
    if debug_build_should_use_development_worker() {
        return None;
    }
    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .and_then(|dir| {
            packaged_worker_candidates(&dir)
                .into_iter()
                .find(|path| path.exists())
        })
}

fn debug_build_should_use_development_worker() -> bool {
    cfg!(debug_assertions) && !debug_packaged_worker_override_enabled()
}

fn debug_packaged_worker_override_enabled() -> bool {
    env::var("DIPLOMAT_USE_PACKAGED_WORKER")
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            )
        })
        .unwrap_or(false)
}

fn packaged_worker_candidates(exe_dir: &Path) -> Vec<PathBuf> {
    vec![
        exe_dir.join("diplomat-worker.exe"),
        exe_dir.join("diplomat-worker-x86_64-pc-windows-msvc.exe"),
    ]
}

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

fn worker_launch_config_from_candidates(
    packaged_worker: Option<PathBuf>,
    repo_root: Result<PathBuf, String>,
    directories: &RuntimeDirectories,
    ffmpeg_path: String,
    ffprobe_path: String,
) -> Result<WorkerLaunchConfig, String> {
    if let Some(worker_path) = packaged_worker {
        return Ok(WorkerLaunchConfig::packaged(
            worker_path,
            directories,
            ffmpeg_path,
            ffprobe_path,
        ));
    }
    Ok(WorkerLaunchConfig::development(
        repo_root?,
        directories,
        ffmpeg_path,
        ffprobe_path,
    ))
}

fn probe_cli_tool(path: &str) -> Result<String, ToolProbeError> {
    let output = Command::new(path)
        .arg("-version")
        .output()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                ToolProbeError::Missing(format!(
                    "{path} was not found. Install FFmpeg or configure the bundled runtime path."
                ))
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
                version: if version.is_empty() {
                    None
                } else {
                    Some(version)
                },
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
    let path = packaged_or_configured_tool_path(
        env::var("DIPLOMAT_FFMPEG_PATH").ok().as_deref(),
        packaged_resource_candidate("ffmpeg.exe"),
        "ffmpeg",
    );
    tool_status_from_probe(&path, probe_cli_tool(&path))
}

fn ffprobe_status() -> ToolStatus {
    let path = packaged_or_configured_tool_path(
        env::var("DIPLOMAT_FFPROBE_PATH").ok().as_deref(),
        packaged_resource_candidate("ffprobe.exe"),
        "ffprobe",
    );
    tool_status_from_probe(&path, probe_cli_tool(&path))
}

#[tauri::command]
fn worker_endpoint() -> &'static str {
    WORKER_ENDPOINT
}

#[tauri::command]
fn pick_video_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Video", &["mp4", "mov", "mkv", "webm", "avi", "m4v"])
        .blocking_pick_file();

    selected
        .map(|path| {
            path.into_path()
                .map(|path| path.to_string_lossy().to_string())
                .map_err(|error| error.to_string())
        })
        .transpose()
}

#[tauri::command]
fn pick_video_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Video", &["mp4", "mov", "mkv", "webm", "avi", "m4v"])
        .blocking_pick_files();

    selected
        .unwrap_or_default()
        .into_iter()
        .map(|path| {
            path.into_path()
                .map(|path| path.to_string_lossy().to_string())
                .map_err(|error| error.to_string())
        })
        .collect()
}

#[tauri::command]
fn pick_project_backup_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Diplomat project backup", &["zip"])
        .blocking_pick_file();

    selected
        .map(|path| {
            path.into_path()
                .map(|path| path.to_string_lossy().to_string())
                .map_err(|error| error.to_string())
        })
        .transpose()
}

#[tauri::command]
fn worker_status(state: State<'_, Mutex<WorkerProcessState>>) -> Result<WorkerStatus, String> {
    let mut guard = state
        .lock()
        .map_err(|_| "Worker process state lock is poisoned".to_string())?;
    clear_exited_child(&mut guard);
    if guard.child.is_some() {
        return Ok(worker_status_from_state(&guard));
    }
    drop(guard);

    Ok(classify_worker_probe(probe_worker_health()))
}

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
    let worker_launcher = {
        let guard = state
            .lock()
            .map_err(|_| "Worker process state lock is poisoned".to_string())?;
        guard.launcher.clone().unwrap_or_else(|| {
            if worker.status == "running" && worker.owner == "diplomat" {
                "external".to_string()
            } else {
                "none".to_string()
            }
        })
    };

    let ffmpeg = ffmpeg_status();
    let ffprobe = ffprobe_status();
    let status_directories =
        directories.for_worker_launcher(&worker_launcher, &ffmpeg.path, &ffprobe.path);

    Ok(RuntimeStatus::new(
        worker,
        &worker_launcher,
        status_directories,
        ffmpeg,
        ffprobe,
    ))
}

#[tauri::command]
fn start_worker(state: State<'_, Mutex<WorkerProcessState>>) -> Result<WorkerStatus, String> {
    let external_status = classify_worker_probe(probe_worker_health());
    if external_status.status == "running" && external_status.owner == "diplomat" {
        return Ok(external_status);
    }
    if external_status.status == "blocked" {
        return Err(
            "Port 8765 is already in use by another service. Stop that service before starting Diplomat Worker."
                .to_string(),
        );
    }

    let mut guard = state
        .lock()
        .map_err(|_| "Worker process state lock is poisoned".to_string())?;
    clear_exited_child(&mut guard);
    if guard.child.is_some() {
        return Ok(WorkerStatus::new(
            "running",
            "diplomat",
            "Worker process is already managed by this desktop session.",
        ));
    }

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
    let launch_config = worker_launch_config_from_candidates(
        packaged_worker_candidate(),
        find_repo_root(),
        &directories,
        ffmpeg_path,
        ffprobe_path,
    )?;
    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(Path::new(&diagnostics.worker_stdout_log))
        .map_err(|error| format!("Unable to open Worker stdout log: {error}"))?;
    let stderr = OpenOptions::new()
        .create(true)
        .append(true)
        .open(Path::new(&diagnostics.worker_stderr_log))
        .map_err(|error| format!("Unable to open Worker stderr log: {error}"))?;

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
    let child = command
        .spawn()
        .map_err(|error| format!("Unable to start Diplomat Worker: {error}"))?;

    guard.child = Some(child);
    guard.launcher = Some(launch_config.mode.clone());
    drop(guard);

    for _ in 0..10 {
        thread::sleep(Duration::from_millis(200));
        let status = classify_worker_probe(probe_worker_health());
        if status.status == "running" && status.owner == "diplomat" {
            return Ok(status);
        }
    }

    Ok(WorkerStatus::new(
        "starting",
        "diplomat",
        "Worker process started; health check is still warming up.",
    ))
}

#[tauri::command]
fn stop_worker(state: State<'_, Mutex<WorkerProcessState>>) -> Result<WorkerStatus, String> {
    let mut guard = state
        .lock()
        .map_err(|_| "Worker process state lock is poisoned".to_string())?;
    if let Some(mut child) = guard.child.take() {
        child
            .kill()
            .map_err(|error| format!("Unable to stop Worker process: {error}"))?;
        let _ = child.wait();
    }
    guard.launcher = None;

    Ok(WorkerStatus::new(
        "stopped",
        "none",
        "Worker process managed by this desktop session is stopped.",
    ))
}

#[tauri::command]
fn open_path_in_file_manager(path: String) -> Result<(), String> {
    open_path_with_file_manager(Path::new(&path))
}

fn worker_status_from_state(state: &WorkerProcessState) -> WorkerStatus {
    if state.child.is_some() {
        WorkerStatus::new(
            "running",
            "diplomat",
            "Worker process is managed by this desktop session.",
        )
    } else {
        WorkerStatus::new("stopped", "none", "Worker process is not running.")
    }
}

fn classify_worker_probe(result: Result<String, String>) -> WorkerStatus {
    match result {
        Ok(payload) if payload.contains("diplomat-worker") => {
            WorkerStatus::new("running", "diplomat", "Diplomat Worker is reachable.")
        }
        Ok(_) => WorkerStatus::new(
            "blocked",
            "other",
            "Port 8765 is occupied by a service that is not Diplomat Worker.",
        ),
        Err(message) => WorkerStatus::new("stopped", "none", &message),
    }
}

fn probe_worker_health() -> Result<String, String> {
    let address: SocketAddr = WORKER_HOST
        .parse()
        .map_err(|error| format!("Invalid Worker address: {error}"))?;
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_millis(400))
        .map_err(|error| format!("Worker is not reachable: {error}"))?;
    stream
        .set_read_timeout(Some(Duration::from_millis(800)))
        .map_err(|error| format!("Unable to set Worker read timeout: {error}"))?;
    stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .map_err(|error| format!("Unable to write Worker health request: {error}"))?;

    let mut payload = String::new();
    stream
        .read_to_string(&mut payload)
        .map_err(|error| format!("Unable to read Worker health response: {error}"))?;
    Ok(payload)
}

fn clear_exited_child(state: &mut WorkerProcessState) {
    let Some(child) = state.child.as_mut() else {
        return;
    };
    if matches!(child.try_wait(), Ok(Some(_))) {
        state.child = None;
        state.launcher = None;
    }
}

fn find_repo_root() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if let Ok(current) = env::current_dir() {
        candidates.push(current);
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")));

    for candidate in candidates {
        for ancestor in candidate.ancestors() {
            if ancestor.join("worker").join("diplomat_worker").is_dir()
                && ancestor.join("package.json").is_file()
            {
                return Ok(ancestor.to_path_buf());
            }
        }
    }

    Err("Unable to locate Diplomat repository root for Worker startup.".to_string())
}

fn open_path_with_file_manager(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let argument = if path.is_file() {
            format!("/select,{}", path.display())
        } else {
            path.display().to_string()
        };
        Command::new("explorer")
            .arg(argument)
            .spawn()
            .map_err(|error| format!("Unable to open path in File Explorer: {error}"))?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|error| format!("Unable to open path in Finder: {error}"))?;
        Ok(())
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| format!("Unable to open path in file manager: {error}"))?;
        Ok(())
    }
}

#[cfg(not(test))]
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(WorkerProcessState::default()))
        .invoke_handler(tauri::generate_handler![
            worker_endpoint,
            pick_video_file,
            pick_video_files,
            pick_project_backup_file,
            start_worker,
            stop_worker,
            worker_status,
            runtime_status,
            open_path_in_file_manager
        ])
        .run(tauri::generate_context!())
        .expect("error while running Diplomat");
}

#[cfg(test)]
fn main() {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worker_status_reports_stopped_for_empty_state() {
        let state = WorkerProcessState::default();
        let status = worker_status_from_state(&state);

        assert_eq!(status.status, "stopped");
        assert_eq!(status.endpoint, "http://127.0.0.1:8765");
        assert_eq!(status.owner, "none");
    }

    #[test]
    fn classifies_diplomat_worker_health_payload() {
        let status = classify_worker_probe(Ok(
            "{\"name\":\"diplomat-worker\",\"status\":\"ok\",\"version\":\"0.2.0\"}".to_string(),
        ));

        assert_eq!(status.status, "running");
        assert_eq!(status.owner, "diplomat");
    }

    #[test]
    fn classifies_other_port_occupant() {
        let status =
            classify_worker_probe(Ok("HTTP/1.1 200 OK\r\n\r\n{\"name\":\"other\"}".to_string()));

        assert_eq!(status.status, "blocked");
        assert_eq!(status.owner, "other");
    }

    #[test]
    fn classifies_unreachable_worker_as_stopped() {
        let status = classify_worker_probe(Err("connection refused".to_string()));

        assert_eq!(status.status, "stopped");
        assert_eq!(status.owner, "none");
    }

    #[test]
    fn runtime_directories_are_derived_from_base_path() {
        let base = PathBuf::from(r"C:\Users\Drew\AppData\Local\Diplomat");
        let directories = RuntimeDirectories::from_base(&base);

        assert_eq!(
            directories.data,
            r"C:\Users\Drew\AppData\Local\Diplomat\data"
        );
        assert_eq!(
            directories.projects,
            r"C:\Users\Drew\AppData\Local\Diplomat\data\projects"
        );
        assert_eq!(
            directories.models,
            r"C:\Users\Drew\AppData\Local\Diplomat\models"
        );
        assert_eq!(
            directories.downloads,
            r"C:\Users\Drew\AppData\Local\Diplomat\downloads"
        );
        assert_eq!(
            directories.exports,
            r"C:\Users\Drew\AppData\Local\Diplomat\exports"
        );
        assert_eq!(
            directories.cache,
            r"C:\Users\Drew\AppData\Local\Diplomat\cache"
        );
        assert_eq!(
            directories.logs,
            r"C:\Users\Drew\AppData\Local\Diplomat\logs"
        );
        assert_eq!(
            directories.diagnostics,
            r"C:\Users\Drew\AppData\Local\Diplomat\diagnostics"
        );
    }

    #[test]
    fn runtime_diagnostics_paths_use_log_directory() {
        let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
        let diagnostics = RuntimeDiagnostics::from_directories(&directories);

        assert_eq!(
            diagnostics.worker_stdout_log,
            r"C:\Diplomat\logs\worker.stdout.log"
        );
        assert_eq!(
            diagnostics.worker_stderr_log,
            r"C:\Diplomat\logs\worker.stderr.log"
        );
    }

    #[test]
    fn worker_environment_sets_data_directory() {
        let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
        let environment = worker_environment(&directories);

        assert_eq!(
            environment,
            vec![(
                "DIPLOMAT_DATA_DIR".to_string(),
                r"C:\Diplomat\data".to_string()
            )]
        );
    }

    #[test]
    fn packaged_worker_command_uses_sidecar_path_and_app_dirs() {
        let directories =
            RuntimeDirectories::from_base(&PathBuf::from(r"C:\Users\Drew\AppData\Local\Diplomat"));
        let config = WorkerLaunchConfig::packaged(
            PathBuf::from(r"C:\Program Files\Diplomat\diplomat-worker.exe"),
            &directories,
            r"C:\Program Files\Diplomat\resources\ffmpeg.exe".to_string(),
            r"C:\Program Files\Diplomat\resources\ffprobe.exe".to_string(),
        );

        assert_eq!(
            config.program,
            PathBuf::from(r"C:\Program Files\Diplomat\diplomat-worker.exe")
        );
        assert_eq!(config.args, Vec::<String>::new());
        assert!(config.env.iter().any(|(key, value)| {
            key == "DIPLOMAT_DATA_DIR" && value.ends_with(r"Diplomat\data")
        }));
        assert!(config.env.iter().any(|(key, value)| {
            key == "DIPLOMAT_FFMPEG_PATH" && value.ends_with("ffmpeg.exe")
        }));
        assert!(config.env.iter().any(|(key, value)| {
            key == "DIPLOMAT_FFPROBE_PATH" && value.ends_with("ffprobe.exe")
        }));
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
        assert_eq!(
            config.current_dir,
            Some(PathBuf::from(r"D:\Software Project\Diplomat"))
        );
        assert!(config.env.iter().any(|(key, value)| {
            key == "DIPLOMAT_DEVELOPMENT_MODEL_ROOT" && value == r"D:\Software Project\Diplomat"
        }));
        assert!(config.env.iter().any(|(key, value)| {
            key == "DIPLOMAT_MODELS_DIR" && value == r"D:\Software Project\Diplomat\models"
        }));
        assert_eq!(config.mode, "development");
    }

    #[test]
    fn development_runtime_status_uses_project_models_directory() {
        let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
        let config = WorkerLaunchConfig::development(
            PathBuf::from(r"D:\Software Project\Diplomat"),
            &directories,
            "ffmpeg".to_string(),
            "ffprobe".to_string(),
        );
        let status_directories = directories.for_worker_launch_config(&config);

        assert_eq!(
            status_directories.models,
            r"D:\Software Project\Diplomat\models"
        );
        assert_eq!(status_directories.data, r"C:\Diplomat\data");
    }

    #[test]
    fn packaged_runtime_status_keeps_app_models_directory() {
        let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
        let config = WorkerLaunchConfig::packaged(
            PathBuf::from(r"C:\Program Files\Diplomat\diplomat-worker.exe"),
            &directories,
            "ffmpeg".to_string(),
            "ffprobe".to_string(),
        );
        let status_directories = directories.for_worker_launch_config(&config);

        assert_eq!(status_directories.models, r"C:\Diplomat\models");
    }

    #[test]
    fn packaged_launch_config_does_not_require_repo_root() {
        let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
        let config = worker_launch_config_from_candidates(
            Some(PathBuf::from(
                r"C:\Program Files\Diplomat\diplomat-worker.exe",
            )),
            Err("repo root unavailable".to_string()),
            &directories,
            "ffmpeg".to_string(),
            "ffprobe".to_string(),
        )
        .expect("packaged launch should not require a repo root");

        assert_eq!(config.mode, "packaged");
        assert_eq!(
            config.program,
            PathBuf::from(r"C:\Program Files\Diplomat\diplomat-worker.exe")
        );
    }

    #[test]
    fn development_launch_config_uses_repo_when_no_packaged_worker() {
        let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
        let config = worker_launch_config_from_candidates(
            None,
            Ok(PathBuf::from(r"D:\Software Project\Diplomat")),
            &directories,
            "ffmpeg".to_string(),
            "ffprobe".to_string(),
        )
        .expect("development launch should use repo root");

        assert_eq!(config.mode, "development");
        assert_eq!(
            config.current_dir,
            Some(PathBuf::from(r"D:\Software Project\Diplomat"))
        );
    }

    #[test]
    fn launch_config_returns_repo_error_without_packaged_worker() {
        let directories = RuntimeDirectories::from_base(&PathBuf::from(r"C:\Diplomat"));
        let error = worker_launch_config_from_candidates(
            None,
            Err("Unable to locate Diplomat repository root for Worker startup.".to_string()),
            &directories,
            "ffmpeg".to_string(),
            "ffprobe".to_string(),
        )
        .expect_err("missing packaged worker and repo root should fail");

        assert!(error.contains("Unable to locate Diplomat repository root"));
    }

    #[test]
    fn packaged_worker_candidates_include_tauri_windows_sidecar_name() {
        let candidates = packaged_worker_candidates(&PathBuf::from(r"C:\Program Files\Diplomat"));

        assert_eq!(
            candidates,
            vec![
                PathBuf::from(r"C:\Program Files\Diplomat\diplomat-worker.exe"),
                PathBuf::from(
                    r"C:\Program Files\Diplomat\diplomat-worker-x86_64-pc-windows-msvc.exe"
                ),
            ]
        );
    }

    #[test]
    fn tool_status_available_uses_first_version_line() {
        let status = tool_status_from_probe(
            "ffmpeg",
            Ok("ffmpeg version 7.1-full_build\nconfiguration: --enable-gpl".to_string()),
        );

        assert_eq!(status.status, "available");
        assert_eq!(status.path, "ffmpeg");
        assert_eq!(
            status.version,
            Some("ffmpeg version 7.1-full_build".to_string())
        );
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
    fn packaged_resource_path_prefers_env_override() {
        let path = packaged_or_configured_tool_path(
            Some("C:/Tools/ffmpeg.exe"),
            Some(PathBuf::from(
                r"C:\Program Files\Diplomat\resources\ffmpeg.exe",
            )),
            "ffmpeg",
        );

        assert_eq!(path, "C:/Tools/ffmpeg.exe");
    }

    #[test]
    fn packaged_resource_path_uses_resource_when_env_missing() {
        let path = packaged_or_configured_tool_path(
            None,
            Some(PathBuf::from(
                r"C:\Program Files\Diplomat\resources\ffprobe.exe",
            )),
            "ffprobe",
        );

        assert_eq!(path, r"C:\Program Files\Diplomat\resources\ffprobe.exe");
    }

    #[test]
    fn packaged_resource_path_falls_back_to_path_name() {
        let path = packaged_or_configured_tool_path(None, None, "ffmpeg");

        assert_eq!(path, "ffmpeg");
    }

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

        let status = RuntimeStatus::new(worker, "development", directories, ffmpeg, ffprobe);

        assert_eq!(status.mode, "desktop");
        assert_eq!(status.worker_launcher, "development");
        assert_eq!(status.worker.status, "stopped");
        assert_eq!(status.directories.data, r"C:\Diplomat\data");
        assert_eq!(status.ffmpeg.status, "available");
        assert_eq!(status.ffprobe.status, "missing");
        assert_eq!(
            status.diagnostics.worker_stdout_log,
            r"C:\Diplomat\logs\worker.stdout.log"
        );
    }
}
