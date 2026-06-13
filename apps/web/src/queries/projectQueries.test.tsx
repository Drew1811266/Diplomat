import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCreateProjectMutation, useProjectsQuery } from "./projectQueries";
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
});
