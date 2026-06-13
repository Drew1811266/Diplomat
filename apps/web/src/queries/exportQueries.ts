import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SrtExportMode } from "@diplomat/shared";
import { exportSrt } from "../api";
import { queryKeys } from "./queryKeys";

export function useExportSrtMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode: SrtExportMode) => {
      if (!projectId) {
        throw new Error("Project id is required to export SRT.");
      }
      return exportSrt(projectId, mode);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
