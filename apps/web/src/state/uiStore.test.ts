import { beforeEach, describe, expect, it } from "vitest";
import { LANGUAGE_STORAGE_KEY, getInitialLanguage, useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.getState().resetUiState();
  });

  it("tracks page, active project, inspector mode, selected line, and language", () => {
    useUiStore.getState().setPage("settings");
    useUiStore.getState().setActiveProjectId("project-demo");
    useUiStore.getState().setSelectedLineId("line-1");
    useUiStore.getState().setLanguage("zh");

    expect(useUiStore.getState().currentPage).toBe("settings");
    expect(useUiStore.getState().activeProjectId).toBe("project-demo");
    expect(useUiStore.getState().inspectorMode).toBe("line");
    expect(useUiStore.getState().selectedLineId).toBe("line-1");
    expect(useUiStore.getState().language).toBe("zh");

    useUiStore.getState().resetUiState();

    expect(useUiStore.getState().activeProjectId).toBeNull();
  });

  it("reads a valid persisted language and falls back to English for missing or invalid values", () => {
    expect(getInitialLanguage()).toBe("en");

    localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh");
    expect(getInitialLanguage()).toBe("zh");

    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    expect(getInitialLanguage()).toBe("en");
  });

  it("persists language changes and reset keeps the user's stored language", () => {
    useUiStore.getState().setLanguage("zh");
    useUiStore.getState().setPage("settings");

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh");

    useUiStore.getState().resetUiState();

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh");
    expect(useUiStore.getState().language).toBe("zh");
    expect(useUiStore.getState().currentPage).toBe("projects");
  });

  it.each(["analysis", "translation", "export", "settings-lite"] as const)(
    "selecting a line from %s mode returns the inspector to line mode",
    (mode) => {
      useUiStore.getState().setInspectorMode(mode);
      useUiStore.getState().setSelectedLineId("line-2");

      expect(useUiStore.getState().selectedLineId).toBe("line-2");
      expect(useUiStore.getState().inspectorMode).toBe("line");
    }
  );

  it("clears the selected subtitle line when the active project changes", () => {
    useUiStore.getState().setActiveProjectId("project-demo");
    useUiStore.getState().setSelectedLineId("line-1");

    useUiStore.getState().setActiveProjectId("project-next");

    expect(useUiStore.getState().activeProjectId).toBe("project-next");
    expect(useUiStore.getState().selectedLineId).toBeNull();
  });
});
