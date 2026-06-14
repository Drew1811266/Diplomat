import { useQuery } from "@tanstack/react-query";
import { fetchWorkerHealth } from "../api";
import { isDesktopRuntime, runtimeStatus, workerStatus } from "../desktop";
import { queryKeys } from "./queryKeys";

export function useWorkerHealthQuery() {
  return useQuery({
    queryKey: queryKeys.workerHealth,
    queryFn: () => fetchWorkerHealth(),
    retry: 0
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
