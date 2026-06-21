# Diplomat development desktop launcher

Use this entry whenever the current development desktop app needs to be opened.

```powershell
.\scripts\start-dev-desktop.ps1
```

Equivalent npm workspace command:

```powershell
corepack pnpm dev:desktop
```

## What the launcher does

- Resolves the repository from the script location, so it starts the current checkout or worktree.
- Stops stale Diplomat development processes on the fixed development ports:
  - Web dev server: `http://localhost:1420`
  - Worker: `http://127.0.0.1:8765`
- Starts the Python Worker from the current repository source.
- Sets development model paths before starting services:
  - `DIPLOMAT_DEVELOPMENT_MODEL_ROOT`
  - `DIPLOMAT_MODELS_DIR`
- Uses the local project model directory by default. If the launcher runs inside `.worktrees/<name>` and that worktree has no model payload, it falls back to the parent workspace model store.
- Starts Tauri desktop development mode, which starts the Vite web app from the same checkout.
- Waits for Worker `/health` and the web dev server before reporting readiness.
- Writes logs to `.dev/runtime-logs/`.

## Codex convention

When the user asks to start or open the software during development, use:

```powershell
Start-Process -WindowStyle Hidden powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PWD\scripts\start-dev-desktop.ps1`""
```

Then verify:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/health
Invoke-WebRequest -UseBasicParsing http://localhost:1420/
```

The expected Worker health payload contains:

```json
{"name":"diplomat-worker","status":"ok"}
```

The desktop app should open as the latest Tauri build from the current checkout.

## Options

```powershell
.\scripts\start-dev-desktop.ps1 --no-clean
.\scripts\start-dev-desktop.ps1 --timeout-ms=120000
.\scripts\start-dev-desktop.ps1 --repo "D:\Software Project\Diplomat\.worktrees\ui-v2-refactor"
```

Use `--no-clean` only when intentionally reusing already-running dev services.
Use `--repo` when the newest development build is still in a worktree rather than `main`.
