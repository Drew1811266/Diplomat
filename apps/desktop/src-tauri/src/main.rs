#[tauri::command]
fn worker_endpoint() -> &'static str {
    "http://127.0.0.1:8765"
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![worker_endpoint])
        .run(tauri::generate_context!())
        .expect("error while running Diplomat");
}
