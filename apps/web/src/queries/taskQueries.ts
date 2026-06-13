import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalysisJobRequestInput,
  TaskResponse,
  TranslationJobRequestInput
} from "@diplomat/shared";
import {
  cancelTask,
  createAnalysisJob,
  createTranslationJob,
  fetchTask,
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

export function useCreateAnalysisJobMutation(projectId: string | null) {
  return useMutation({
    mutationFn: (input: AnalysisJobRequestInput) => {
      if (!projectId) {
        throw new Error("Project id is required to create an analysis job.");
      }
      return createAnalysisJob(projectId, input);
    }
  });
}

export function useCreateTranslationJobMutation(projectId: string | null) {
  return useMutation({
    mutationFn: (input: TranslationJobRequestInput) => {
      if (!projectId) {
        throw new Error("Project id is required to create a translation job.");
      }
      return createTranslationJob(projectId, input);
    }
  });
}

export function useCancelTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => cancelTask(taskId),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.taskId), task);
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
      config?: AnalysisJobRequestInput | TranslationJobRequestInput;
    }) => retryTask(taskId, config),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.taskId), task);
    }
  });
}
