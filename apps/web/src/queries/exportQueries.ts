import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SrtExportMode, SubtitleExportRequestInput } from "@diplomat/shared";
import { exportSrt, exportSubtitles } from "../api";
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

export function useSubtitleExportMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubtitleExportRequestInput) => {
      if (!projectId) {
        throw new Error("Project id is required to export subtitles.");
      }
      return exportSubtitles(projectId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      }
    }
  });
}
