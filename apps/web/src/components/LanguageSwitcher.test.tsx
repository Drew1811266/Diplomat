import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { LANGUAGE_STORAGE_KEY, useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import { LanguageSwitcher } from "./LanguageSwitcher";

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
  vi.restoreAllMocks();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("LanguageSwitcher", () => {
  it("uses a localized accessible label", async () => {
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");

    renderWithProviders(<LanguageSwitcher />);

    expect(screen.getByLabelText("界面语言")).toBeInTheDocument();
  });

  it("switches between English and Chinese through appI18n", async () => {
    const user = userEvent.setup();
    const changeLanguage = vi.spyOn(appI18n, "changeLanguage");

    renderWithProviders(<LanguageSwitcher />);

    await user.click(screen.getByLabelText("中文"));

    expect(useUiStore.getState().language).toBe("zh");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh");
    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith("zh"));
    expect(await screen.findByLabelText("界面语言")).toBeInTheDocument();

    await user.click(screen.getByLabelText("EN"));

    expect(useUiStore.getState().language).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith("en"));
  });
});
