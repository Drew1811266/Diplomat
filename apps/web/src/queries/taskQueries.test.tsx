import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTaskActive,
  useCancelTaskMutation,
  useCreateAnalysisJobMutation,
  useCreateTranslationJobMutation,
  useTaskQuery
} from "./taskQueries";
import { queryKeys } from "./queryKeys";
import {
  completedAnalysisTaskFixture,
  runningAnalysisTaskFixture
} from "../test/fixtures";
import { stubFetchWithRoutes } from "../test/serverMocks";
import { createTestQueryClient, createQueryWrapper } from "./queryTestUtils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("task queries", () => {
  it("identifies active task statuses", () => {
    expect(isTaskActive({ ...completedAnalysisTaskFixture, status: "queued" })).toBe(true);
    expect(isTaskActive({ ...completedAnalysisTaskFixture, status: "running" })).toBe(true);
    expect(isTaskActive({ ...completedAnalysisTaskFixture, status: "canceling" })).toBe(true);
    expect(isTaskActive({ ...completedAnalysisTaskFixture, status: "completed" })).toBe(false);
    expect(isTaskActive({ ...completedAnalysisTaskFixture, status: "failed" })).toBe(false);
    expect(isTaskActive({ ...completedAnalysisTaskFixture, status: "canceled" })).toBe(false);
  });

  it("loads a task by id through fetch", async () => {
    const fetchMock = stubFetchWithRoutes([
      {
        match: (url, init) => url.endsWith("/tasks/task-1") && init?.method === undefined,
        response: completedAnalysisTaskFixture
      }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskQuery("task-1"), {
      wrapper: createQueryWrapper()
    });

    await waitFor(() => expect(result.current.data).toEqual(completedAnalysisTaskFixture));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancel task mutation writes the response into the task cache", async () => {
    const canceledTask = {
      ...runningAnalysisTaskFixture,
      status: "canceled" as const,
      message: "Analysis canceled",
      completedAt: "2026-06-07T00:00:02+00:00"
    };
    const fetchMock = stubFetchWithRoutes([
      {
        match: (url, init) => url.endsWith("/tasks/task-1/cancel") && init?.method === "POST",
        response: canceledTask
      }
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCancelTaskMutation(), {
      wrapper: createQueryWrapper(queryClient)
    });

    await result.current.mutateAsync("task-1");

    expect(queryClient.getQueryData(queryKeys.task("task-1"))).toEqual(canceledTask);
  });

  it("analysis and translation job mutations reject before fetch when project id is missing", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const { result: analysisResult } = renderHook(() => useCreateAnalysisJobMutation(null), {
      wrapper: createQueryWrapper()
    });
    const { result: translationResult } = renderHook(() => useCreateTranslationJobMutation(null), {
      wrapper: createQueryWrapper()
    });

    await expect(
      analysisResult.current.mutateAsync({ provider: "fake", sourceLanguage: "zh" })
    ).rejects.toThrow("Project id is required to create an analysis job.");
    await expect(
      translationResult.current.mutateAsync({
        provider: "fake",
        sourceLanguage: "zh",
        targetLanguage: "en",
        mode: "missing_only"
      })
    ).rejects.toThrow("Project id is required to create a translation job.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
