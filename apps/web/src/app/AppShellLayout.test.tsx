import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "./i18n";
import { useUiStore } from "../state/uiStore";
import { projectFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { AppShellLayout } from "./AppShellLayout";

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousReactActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

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

beforeEach(async () => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  stubMatchMedia();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousReactActEnvironment;
  await appI18n.changeLanguage("en");
});

describe("AppShellLayout", () => {
  it("keeps global system settings as the far-right gear and removes project workflow tabs from the top bar", async () => {
    useUiStore.getState().setActiveProjectId("project-demo");
    useUiStore.getState().setPage("workbench");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.42.0" });
        }
        if (url.endsWith("/tasks")) {
          return jsonResponse({ tasks: [] });
        }
        if (url.endsWith("/projects/project-demo")) {
          return jsonResponse(projectFixture);
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(
      <AppShellLayout>
        <div>Shell content</div>
      </AppShellLayout>
    );

    expect(await screen.findByRole("banner")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Project workspace tabs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transcription" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Translation" })).not.toBeInTheDocument();

    const headerButtons = within(screen.getByRole("banner")).getAllByRole("button");
    expect(headerButtons.at(-1)).toHaveAccessibleName("Open system settings");
  });

  it("recovers the shell runtime badge after the health endpoint becomes reachable", async () => {
    let healthAttempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          healthAttempts += 1;
          if (healthAttempts === 1) {
            throw new TypeError("connection refused");
          }

          return jsonResponse({
            name: "diplomat-worker",
            status: "ok",
            version: "0.42.0"
          });
        }
        if (url.endsWith("/tasks")) {
          return jsonResponse({ tasks: [] });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(
      <AppShellLayout>
        <div>Shell content</div>
      </AppShellLayout>
    );

    expect(await screen.findAllByText("Local runtime · Offline")).toHaveLength(2);
    expect(healthAttempts).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Local runtime · Ready").length).toBeGreaterThan(0);
    });
    expect(healthAttempts).toBeGreaterThan(1);
  });
});
