import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useCreateProjectMutation,
  useProjectsQuery,
  useSaveTranslationSettingsMutation,
  useTranslationSettingsQuery
} from "./projectQueries";
import { queryKeys } from "./queryKeys";
import { projectFixture } from "../test/fixtures";
import { stubFetchWithRoutes } from "../test/serverMocks";
import { createTestQueryClient, createQueryWrapper } from "./queryTestUtils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("project queries", () => {
  it("loads recent projects through TanStack Query", async () => {
    const fetchMock = stubFetchWithRoutes([
      {
        match: (url, init) => url.endsWith("/projects") && init?.method === undefined,
        response: { projects: [projectFixture] }
      }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useProjectsQuery(), {
      wrapper: createQueryWrapper()
    });

    await waitFor(() => expect(result.current.data?.projects).toEqual([projectFixture]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("create project mutation writes the created project to the individual cache", async () => {
    const fetchMock = stubFetchWithRoutes([
      {
        match: (url, init) => url.endsWith("/projects") && init?.method === "POST",
        response: projectFixture
      }
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCreateProjectMutation(), {
      wrapper: createQueryWrapper(queryClient)
    });

    await result.current.mutateAsync({
      name: "Demo",
      sourceVideoPath: "D:/media/demo.mp4",
      sourceLanguage: "zh",
      targetLanguage: "en"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKeys.project("project-demo"))).toEqual(projectFixture);
  });

  it("loads and caches project translation settings", async () => {
    const settings = {
      projectId: "project-demo",
      provider: "fake",
      modelId: null,
      modelNameOrPath: null,
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "missing_only",
      device: "cpu",
      computeType: "int8",
      batchSize: 8,
      endpoint: null,
      apiKeyEnv: null,
      glossary: [],
      updatedAt: "2026-06-07T00:00:00+00:00"
    };
    const fetchMock = stubFetchWithRoutes([
      {
        match: (url, init) =>
          url.endsWith("/projects/project-demo/translation-settings") && init?.method === undefined,
        response: settings
      }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTranslationSettingsQuery("project-demo"), {
      wrapper: createQueryWrapper()
    });

    await waitFor(() => expect(result.current.data).toEqual(settings));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("save translation settings mutation writes the project settings cache", async () => {
    const settings = {
      projectId: "project-demo",
      provider: "ct2-marian",
      modelId: "translation.opus-mt.en-zh",
      modelNameOrPath: null,
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "missing_only",
      device: "cuda",
      computeType: "float16",
      batchSize: 8,
      endpoint: null,
      apiKeyEnv: null,
      glossary: [],
      updatedAt: "2026-06-07T00:00:01+00:00"
    };
    const fetchMock = stubFetchWithRoutes([
      {
        match: (url, init) =>
          url.endsWith("/projects/project-demo/translation-settings") && init?.method === "PUT",
        response: settings
      }
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useSaveTranslationSettingsMutation("project-demo"), {
      wrapper: createQueryWrapper(queryClient)
    });

    await result.current.mutateAsync({
      provider: "ct2-marian",
      modelId: "translation.opus-mt.en-zh",
      sourceLanguage: "en",
      targetLanguage: "zh",
      device: "cuda",
      computeType: "float16"
    });

    expect(queryClient.getQueryData(queryKeys.translationSettings("project-demo"))).toEqual(settings);
  });
});
