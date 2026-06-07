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

    let repo_root = find_repo_root()?;
    let log_dir = diagnostics_log_dir()?;
    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("worker.stdout.log"))
        .map_err(|error| format!("Unable to open Worker stdout log: {error}"))?;
    let stderr = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("worker.stderr.log"))
        .map_err(|error| format!("Unable to open Worker stderr log: {error}"))?;

    let child = Command::new("python")
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
        .stderr(Stdio::from(stderr))
        .spawn()
        .map_err(|error| format!("Unable to start Diplomat Worker: {error}"))?;

    guard.child = Some(child);
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
    }
}

fn diagnostics_log_dir() -> Result<PathBuf, String> {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir);
    let log_dir = base.join("Diplomat").join("logs");
    fs::create_dir_all(&log_dir)
        .map_err(|error| format!("Unable to create diagnostics log directory: {error}"))?;
    Ok(log_dir)
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
            start_worker,
            stop_worker,
            worker_status,
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
            "{\"name\":\"diplomat-worker\",\"status\":\"ok\",\"version\":\"0.1.0\"}".to_string(),
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
}
