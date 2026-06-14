export const queryKeys = {
  workerHealth: ["worker", "health"] as const,
  desktopWorkerStatus: ["desktop", "worker-status"] as const,
  desktopRuntimeStatus: ["desktop", "runtime-status"] as const,
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  subtitle: (projectId: string) => ["projects", projectId, "subtitle"] as const,
  translationSettings: (projectId: string) =>
    ["projects", projectId, "translation-settings"] as const,
  task: (taskId: string) => ["tasks", taskId] as const
};
