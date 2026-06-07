fn main() {
    if std::env::var_os("DIPLOMAT_SKIP_TAURI_BUILD").is_some() {
        return;
    }

    tauri_build::build()
}
