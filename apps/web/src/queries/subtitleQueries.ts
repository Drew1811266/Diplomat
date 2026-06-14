import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubtitleDocument, SubtitleSnapshotCreateRequest } from "@diplomat/shared";
import {
  createSubtitleSnapshot,
  deleteSubtitleDraft,
  fetchSubtitleDocument,
  fetchSubtitleDraft,
  listSubtitleSnapshots,
  restoreSubtitleSnapshot,
  saveSubtitleDocument,
  saveSubtitleDraft
} from "../api";
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
      queryClient.removeQueries({ queryKey: queryKeys.subtitleDraft(document.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useSubtitleDraftQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.subtitleDraft(projectId) : queryKeys.subtitleDraft(""),
    queryFn: () => fetchSubtitleDraft(projectId ?? ""),
    enabled: Boolean(projectId),
    retry: false
  });
}

export function useSaveSubtitleDraftMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (document: SubtitleDocument) => {
      if (!projectId) {
        throw new Error("Project id is required to save subtitle draft.");
      }
      return saveSubtitleDraft(projectId, document);
    },
    onSuccess: (draft) => {
      queryClient.setQueryData(queryKeys.subtitleDraft(draft.projectId), draft);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useDeleteSubtitleDraftMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!projectId) {
        throw new Error("Project id is required to delete subtitle draft.");
      }
      return deleteSubtitleDraft(projectId);
    },
    onSuccess: (result) => {
      queryClient.removeQueries({ queryKey: queryKeys.subtitleDraft(result.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(result.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useSubtitleSnapshotsQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.subtitleSnapshots(projectId) : queryKeys.subtitleSnapshots(""),
    queryFn: () => listSubtitleSnapshots(projectId ?? ""),
    enabled: Boolean(projectId),
    retry: false
  });
}

export function useCreateSubtitleSnapshotMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubtitleSnapshotCreateRequest) => {
      if (!projectId) {
        throw new Error("Project id is required to create subtitle snapshot.");
      }
      return createSubtitleSnapshot(projectId, input);
    },
    onSuccess: (snapshot) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.subtitleSnapshots(snapshot.projectId)
      });
    }
  });
}

export function useRestoreSubtitleSnapshotMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (snapshotId: string) => {
      if (!projectId) {
        throw new Error("Project id is required to restore subtitle snapshot.");
      }
      return restoreSubtitleSnapshot(projectId, snapshotId);
    },
    onSuccess: (document) => {
      queryClient.setQueryData(queryKeys.subtitle(document.projectId), document);
      queryClient.removeQueries({ queryKey: queryKeys.subtitleDraft(document.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(document.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.subtitleSnapshots(document.projectId)
      });
    }
  });
}
