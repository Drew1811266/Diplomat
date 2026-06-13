import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectCenterPage } from "./ProjectCenterPage";
import { projectFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

function stubMatchMedia() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectCenterPage", () => {
  it("shows worker status, actions, and recent projects", async () => {
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({ projects: [projectFixture] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Project Center" })).toBeVisible();
    expect((await screen.findAllByText("Worker ready"))[0]).toBeVisible();
    expect(await screen.findByText("Demo")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Import Video" })).toBeVisible();
  });
});
