import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  backupProject,
  cleanupProjectCache,
  cleanupProjectExports,
  createProject,
  deleteProject,
  deleteProjectMediaAsset,
  fetchTranslationSettings,
  fetchProject,
  importProject,
  listProjects,
  saveTranslationSettings,
  updateProjectSourceMedia,
  type CreateProjectInput
} from "../api";
import type {
  ProjectImportRequest,
  ProjectSourceMediaRequest,
  TranslationJobRequestInput
} from "@diplomat/shared";
import { queryKeys } from "./queryKeys";

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => listProjects()
  });
}

export function useProjectQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.project(projectId) : queryKeys.project(""),
    queryFn: () => fetchProject(projectId ?? ""),
    enabled: Boolean(projectId)
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.project(project.projectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useUpdateProjectSourceMediaMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProjectSourceMediaRequest) => {
      if (!projectId) {
        throw new Error("No active project selected");
      }
      return updateProjectSourceMedia(projectId, input);
    },
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.project(project.projectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.waveform(project.projectId) });
    }
  });
}

export function useDeleteProjectMediaAssetMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => {
      if (!projectId) {
        throw new Error("No active project selected");
      }
      return deleteProjectMediaAsset(projectId, assetId);
    },
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.project(project.projectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.waveform(project.projectId) });
    }
  });
}

export function useTranslationSettingsQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.translationSettings(projectId) : queryKeys.translationSettings(""),
    queryFn: () => fetchTranslationSettings(projectId ?? ""),
    enabled: Boolean(projectId)
  });
}

export function useSaveTranslationSettingsMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TranslationJobRequestInput) => {
      if (!projectId) {
        throw new Error("Project id is required to save translation settings.");
      }
      return saveTranslationSettings(projectId, input);
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.translationSettings(settings.projectId), settings);
    }
  });
}

export function useCleanupProjectCacheMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => cleanupProjectCache(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useCleanupProjectExportsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => cleanupProjectExports(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useBackupProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => backupProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useImportProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProjectImportRequest) => importProject(input),
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.project(project.projectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, deleteFiles }: { projectId: string; deleteFiles: boolean }) =>
      deleteProject(projectId, deleteFiles),
    onSuccess: (_result, variables) => {
      queryClient.removeQueries({ queryKey: queryKeys.project(variables.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
