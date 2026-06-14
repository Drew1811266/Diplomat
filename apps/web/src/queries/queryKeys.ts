export const queryKeys = {
  workerHealth: ["worker", "health"] as const,
  desktopWorkerStatus: ["desktop", "worker-status"] as const,
  desktopRuntimeStatus: ["desktop", "runtime-status"] as const,
  models: ["models"] as const,
  model: (modelId: string) => ["models", modelId] as const,
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  subtitle: (projectId: string) => ["projects", projectId, "subtitle"] as const,
  subtitleDraft: (projectId: string) => ["projects", projectId, "subtitle", "draft"] as const,
  subtitleSnapshots: (projectId: string) =>
    ["projects", projectId, "subtitle", "snapshots"] as const,
  waveform: (projectId: string) => ["projects", projectId, "waveform"] as const,
  translationSettings: (projectId: string) =>
    ["projects", projectId, "translation-settings"] as const,
  task: (taskId: string) => ["tasks", taskId] as const
};
