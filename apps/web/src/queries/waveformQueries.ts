import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createWaveformJob, fetchWaveform } from "../api";
import { queryKeys } from "./queryKeys";

export function useWaveformQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.waveform(projectId) : queryKeys.waveform(""),
    queryFn: () => fetchWaveform(projectId ?? ""),
    enabled: Boolean(projectId),
    retry: false
  });
}

export function useCreateWaveformJobMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!projectId) {
        throw new Error("Project id is required to create a waveform job.");
      }
      return createWaveformJob(projectId);
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.taskId), task);
    }
  });
}
