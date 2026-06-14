import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  backupProject,
  cleanupProjectCache,
  cleanupProjectExports,
  createProject,
  deleteProject,
  fetchProject,
  importProject,
  listProjects,
  type CreateProjectInput
} from "../api";
import type { ProjectImportRequest } from "@diplomat/shared";
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
