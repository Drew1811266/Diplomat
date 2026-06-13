import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, fetchProject, listProjects, type CreateProjectInput } from "../api";
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
