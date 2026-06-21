import { useQuery } from "@tanstack/react-query";
import { fetchWorkerHealth } from "../api";
import { isDesktopRuntime, runtimeStatus, workerStatus } from "../desktop";
import { queryKeys } from "./queryKeys";

const WORKER_HEALTH_RETRY_MS = 2000;
const WORKER_HEALTH_READY_REFRESH_MS = 15000;

export function useWorkerHealthQuery() {
  return useQuery({
    queryKey: queryKeys.workerHealth,
    queryFn: () => fetchWorkerHealth(),
    retry: 0,
    refetchInterval: (query) =>
      query.state.data?.status === "ok"
        ? WORKER_HEALTH_READY_REFRESH_MS
        : WORKER_HEALTH_RETRY_MS
  });
}

export function useDesktopWorkerStatusQuery() {
  return useQuery({
    queryKey: queryKeys.desktopWorkerStatus,
    queryFn: () => workerStatus(),
    enabled: isDesktopRuntime()
  });
}

export function useDesktopRuntimeStatusQuery() {
  return useQuery({
    queryKey: queryKeys.desktopRuntimeStatus,
    queryFn: () => runtimeStatus(),
    enabled: isDesktopRuntime()
  });
}
