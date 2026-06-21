import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "./i18n";
import { useUiStore } from "../state/uiStore";
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
            version: "0.40.0"
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
