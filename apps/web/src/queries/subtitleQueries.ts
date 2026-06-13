import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubtitleDocument } from "@diplomat/shared";
import { fetchSubtitleDocument, saveSubtitleDocument } from "../api";
import { queryKeys } from "./queryKeys";

export function useSubtitleDocumentQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.subtitle(projectId) : queryKeys.subtitle(""),
    queryFn: () => fetchSubtitleDocument(projectId ?? ""),
    enabled: Boolean(projectId),
    retry: false
  });
}

export function useSaveSubtitleDocumentMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (document: SubtitleDocument) => {
      if (!projectId) {
        throw new Error("Project id is required to save subtitle document.");
      }
      return saveSubtitleDocument(projectId, document);
    },
    onSuccess: (document) => {
      queryClient.setQueryData(queryKeys.subtitle(document.projectId), document);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
