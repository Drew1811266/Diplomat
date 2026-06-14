import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelModelDownload,
  deleteModel,
  downloadModel,
  fetchModel,
  listModels,
  retryModelDownload
} from "../api";
import { queryKeys } from "./queryKeys";

export function useModelsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.models,
    queryFn: () => listModels(),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.models.some((model) =>
        ["queued", "downloading", "verifying"].includes(model.installation.status)
      )
        ? 1000
        : false
  });
}

export function useModelQuery(modelId: string | null) {
  return useQuery({
    queryKey: modelId ? queryKeys.model(modelId) : queryKeys.model(""),
    queryFn: () => fetchModel(modelId ?? ""),
    enabled: Boolean(modelId)
  });
}

function invalidateModels(queryClient: ReturnType<typeof useQueryClient>, modelId?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.models });
  if (modelId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.model(modelId) });
  }
}

export function useDownloadModelMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: string) => downloadModel(modelId),
    onSuccess: (result) => invalidateModels(queryClient, result.modelId)
  });
}

export function useCancelModelDownloadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: string) => cancelModelDownload(modelId),
    onSuccess: (result) => invalidateModels(queryClient, result.modelId)
  });
}

export function useRetryModelDownloadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: string) => retryModelDownload(modelId),
    onSuccess: (result) => invalidateModels(queryClient, result.modelId)
  });
}

export function useDeleteModelMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: string) => deleteModel(modelId),
    onSuccess: (result) => invalidateModels(queryClient, result.modelId)
  });
}
