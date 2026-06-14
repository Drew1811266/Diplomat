import { useQuery } from "@tanstack/react-query";
import { fetchReleaseReadiness } from "../api";
import { queryKeys } from "./queryKeys";

export function useReleaseReadinessQuery() {
  return useQuery({
    queryKey: queryKeys.releaseReadiness,
    queryFn: () => fetchReleaseReadiness(),
    retry: 0
  });
}
