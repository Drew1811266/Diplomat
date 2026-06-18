import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import { HelpPage } from "./HelpPage";

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

beforeEach(async () => {
  stubMatchMedia();
  stubResizeObserver();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("HelpPage", () => {
  it("renders the English production workflow guide", () => {
    renderWithProviders(<HelpPage />);

    expect(screen.getByRole("main", { name: "Help Center" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help Center" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First run" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Model management" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Long-video workflow" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Release checklist" })).toBeInTheDocument();
    expect(
      screen.getByText("Install only the curated open-source models listed in Models.")
    ).toBeInTheDocument();
  });

  it("renders the Chinese help guide after language switch", async () => {
    await appI18n.changeLanguage("zh");

    renderWithProviders(<HelpPage />);

    expect(screen.getByRole("main", { name: "帮助中心" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "帮助中心" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "首次使用" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "长视频工作流" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "发布前检查" })).toBeInTheDocument();
    expect(screen.getByText("只安装“模型”页列出的内置开源模型。")).toBeInTheDocument();
  });
});
