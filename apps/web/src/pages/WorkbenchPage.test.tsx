import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import { WorkbenchPage } from "./WorkbenchPage";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useUiStore.getState().resetUiState();
});

describe("WorkbenchPage", () => {
  it("renders the media-centered workbench regions", () => {
    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByRole("toolbar", { name: "Project tools" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Subtitle Grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Timeline")).toBeInTheDocument();
  });
});
