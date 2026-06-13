import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { useUiStore } from "../src/state/uiStore";
import { projectFixture } from "../src/test/fixtures";
import { renderWithProviders } from "../src/test/render";

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

function stubResizeObserver() {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }))
  );
}

function stubStartupFetch() {
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
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useUiStore.getState().resetUiState();
});

describe("App", () => {
  it("starts in the project center shell", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Project Center" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Application" })).toBeVisible();
    expect(screen.getByText("Diplomat")).toBeVisible();
    expect(await screen.findByText("Demo")).toBeVisible();
  });

  it("navigates to settings from the app rail", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("main", { name: "Settings" })).toBeVisible();
  });
});
