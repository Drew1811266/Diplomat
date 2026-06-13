import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import { SettingsPage } from "./SettingsPage";

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
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("SettingsPage", () => {
  it("renders compact desktop settings sections with accessible form labels", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("main", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("Interface language")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Worker" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Defaults" })).toBeInTheDocument();
    expect(screen.getByLabelText("Worker URL")).toHaveValue("http://127.0.0.1:8765");
    expect(screen.getByLabelText("Default source language")).toHaveValue("zh");
    expect(screen.getByLabelText("Default target language")).toHaveValue("en");
    expect(screen.getByLabelText("Default export mode")).toHaveValue("bilingual");
  });

  it("updates the settings heading immediately after switching languages", async () => {
    const user = userEvent.setup();

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByLabelText("中文"));

    expect(await screen.findByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("界面语言")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "主题" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "默认值" })).toBeInTheDocument();
    expect(screen.getByLabelText("默认导出模式")).toHaveValue("bilingual");
  });
});
