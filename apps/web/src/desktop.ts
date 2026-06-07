type DesktopInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type DesktopGlobal = typeof globalThis & {
  __TAURI_INTERNALS__?: {
    invoke?: DesktopInvoke;
  };
  __TAURI__?: {
    core?: {
      invoke?: DesktopInvoke;
    };
  };
};

export type DesktopWorkerStatus = {
  status: string;
  endpoint: string;
  owner: string;
  message: string;
};

function desktopGlobal(): DesktopGlobal {
  return globalThis as DesktopGlobal;
}

export function isDesktopRuntime(): boolean {
  const runtime = desktopGlobal();
  return Boolean(runtime.__TAURI_INTERNALS__ || runtime.__TAURI__);
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const runtime = desktopGlobal();
  const directInvoke = runtime.__TAURI_INTERNALS__?.invoke ?? runtime.__TAURI__?.core?.invoke;
  if (directInvoke) {
    return directInvoke<T>(command, args);
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function pickVideoFile(): Promise<string | null> {
  if (!isDesktopRuntime()) {
    return null;
  }

  const selected = await invokeDesktop<string | null>("pick_video_file");
  return typeof selected === "string" && selected.trim() ? selected : null;
}

export async function workerStatus(): Promise<DesktopWorkerStatus | null> {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invokeDesktop<DesktopWorkerStatus>("worker_status");
}

export async function startWorker(): Promise<DesktopWorkerStatus | null> {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invokeDesktop<DesktopWorkerStatus>("start_worker");
}

export async function stopWorker(): Promise<DesktopWorkerStatus | null> {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invokeDesktop<DesktopWorkerStatus>("stop_worker");
}

export async function openPathInFileManager(path: string): Promise<void> {
  if (!isDesktopRuntime()) {
    return;
  }

  await invokeDesktop<void>("open_path_in_file_manager", { path });
}
