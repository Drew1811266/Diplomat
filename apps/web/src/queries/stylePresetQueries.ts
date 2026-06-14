import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StylePresetCreateRequest, StylePresetUpdateRequest } from "@diplomat/shared";
import {
  applyStylePreset,
  createStylePreset,
  deleteStylePreset,
  listStylePresets,
  updateStylePreset
} from "../api";
import { queryKeys } from "./queryKeys";

export function useStylePresetsQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.stylePresets(projectId) : queryKeys.stylePresets(""),
    queryFn: () => listStylePresets(projectId ?? ""),
    enabled: Boolean(projectId),
    retry: false
  });
}

export function useCreateStylePresetMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: StylePresetCreateRequest) => {
      if (!projectId) {
        throw new Error("Project id is required to create style preset.");
      }
      return createStylePreset(projectId, input);
    },
    onSuccess: (preset) => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.stylePresets(projectId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      }
      return preset;
    }
  });
}

export function useUpdateStylePresetMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ presetId, input }: { presetId: string; input: StylePresetUpdateRequest }) => {
      if (!projectId) {
        throw new Error("Project id is required to update style preset.");
      }
      return updateStylePreset(projectId, presetId, input);
    },
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.stylePresets(projectId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.subtitle(projectId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      }
    }
  });
}

export function useDeleteStylePresetMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (presetId: string) => {
      if (!projectId) {
        throw new Error("Project id is required to delete style preset.");
      }
      return deleteStylePreset(projectId, presetId);
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stylePresets(response.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(response.projectId) });
    }
  });
}

export function useApplyStylePresetMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (presetId: string) => {
      if (!projectId) {
        throw new Error("Project id is required to apply style preset.");
      }
      return applyStylePreset(projectId, presetId);
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stylePresets(response.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.subtitle(response.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(response.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
