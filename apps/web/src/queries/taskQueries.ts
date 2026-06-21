import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalysisJobRequestInput,
  BurnInExportRequestInput,
  TaskResponse,
  TranslationJobRequestInput
} from "@diplomat/shared";
import {
  cancelTask,
  createAnalysisJob,
  createBurnInExportJob,
  createTranslationJob,
  fetchTask,
  listTasks,
  retryTask
} from "../api";
import { queryKeys } from "./queryKeys";

export function isTaskActive(task: TaskResponse | null | undefined): boolean {
  return task?.status === "queued" || task?.status === "running" || task?.status === "canceling";
}

export function useTaskQuery(taskId: string | null) {
  return useQuery({
    queryKey: taskId ? queryKeys.task(taskId) : queryKeys.task(""),
    queryFn: () => fetchTask(taskId ?? ""),
    enabled: Boolean(taskId),
    refetchInterval: (query) => (isTaskActive(query.state.data) ? 500 : false)
  });
}

export function useTasksQuery() {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => listTasks(),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.tasks.some((task) => isTaskActive(task)) ? 500 : false
  });
}

export function useCreateAnalysisJobMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnalysisJobRequestInput) => {
      if (!projectId) {
        throw new Error("Project id is required to create an analysis job.");
      }
      return createAnalysisJob(projectId, input);
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.taskId), task);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks, exact: true });
    }
  });
}

export function useCreateTranslationJobMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TranslationJobRequestInput) => {
      if (!projectId) {
        throw new Error("Project id is required to create a translation job.");
      }
      return createTranslationJob(projectId, input);
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.taskId), task);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks, exact: true });
    }
  });
}

export function useCreateBurnInExportJobMutation(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BurnInExportRequestInput) => {
      if (!projectId) {
        throw new Error("Project id is required to create a burn-in export job.");
      }
      return createBurnInExportJob(projectId, input);
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.taskId), task);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks, exact: true });
    }
  });
}

export function useCancelTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => cancelTask(taskId),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.taskId), task);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks, exact: true });
    }
  });
}

export function useRetryTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      config
    }: {
      taskId: string;
      config?: AnalysisJobRequestInput | TranslationJobRequestInput | BurnInExportRequestInput;
    }) => retryTask(taskId, config),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.taskId), task);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks, exact: true });
    }
  });
}
