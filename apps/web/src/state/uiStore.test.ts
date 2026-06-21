import { beforeEach, describe, expect, it } from "vitest";
import {
  LANGUAGE_STORAGE_KEY,
  PROJECT_DEFAULTS_STORAGE_KEY,
  WORKSPACE_LAYOUT_STORAGE_KEY,
  getInitialProjectDefaults,
  getInitialLanguage,
  useUiStore
} from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.getState().resetUiState();
  });

  it("tracks page, active project, editor workspace, inspector mode, selected line, and language", () => {
    useUiStore.getState().setPage("settings");
    useUiStore.getState().setActiveProjectId("project-demo");
    useUiStore.getState().setEditorWorkspace("translation");
    useUiStore.getState().setSelectedLineId("line-1");
    useUiStore.getState().setLanguage("zh");

    expect(useUiStore.getState().currentPage).toBe("settings");
    expect(useUiStore.getState().activeProjectId).toBe("project-demo");
    expect(useUiStore.getState().editorWorkspace).toBe("translation");
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
    expect(useUiStore.getState().settingsCategory).toBe("language");
    expect(useUiStore.getState().editorWorkspace).toBe("transcription");
  });

  it("persists system default project settings across resets", () => {
    expect(getInitialProjectDefaults()).toEqual({
      sourceLanguage: "zh",
      targetLanguage: "en",
      exportMode: "bilingual"
    });

    useUiStore.getState().setProjectDefaults({
      sourceLanguage: "en",
      targetLanguage: "ja",
      exportMode: "target"
    });

    expect(useUiStore.getState().projectDefaults).toEqual({
      sourceLanguage: "en",
      targetLanguage: "ja",
      exportMode: "target"
    });
    expect(JSON.parse(localStorage.getItem(PROJECT_DEFAULTS_STORAGE_KEY) ?? "{}")).toEqual({
      sourceLanguage: "en",
      targetLanguage: "ja",
      exportMode: "target"
    });

    useUiStore.getState().resetUiState();

    expect(useUiStore.getState().projectDefaults).toEqual({
      sourceLanguage: "en",
      targetLanguage: "ja",
      exportMode: "target"
    });
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

  it("stores panel layout independently for each editor workspace", () => {
    expect(useUiStore.getState().workspaceLayouts.translation.inspectorWidth).toBe(420);

    useUiStore.getState().setWorkspaceLayout("translation", {
      inspectorWidth: 420,
      bottomDockHeight: 260,
      inspectorCollapsed: true
    });

    expect(useUiStore.getState().workspaceLayouts.translation).toMatchObject({
      inspectorWidth: 420,
      bottomDockHeight: 260,
      inspectorCollapsed: true
    });
    expect(useUiStore.getState().workspaceLayouts.transcription).toMatchObject({
      inspectorWidth: 420,
      bottomDockHeight: 240,
      inspectorCollapsed: false
    });
    expect(JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? "{}")).toMatchObject({
      translation: {
        inspectorWidth: 420,
        bottomDockHeight: 260,
        inspectorCollapsed: true
      }
    });
  });

  it("loads valid persisted workspace layouts and ignores invalid workspace values", () => {
    localStorage.setItem(
      WORKSPACE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        translation: {
          inspectorWidth: 388,
          bottomDockHeight: 248,
          inspectorCollapsed: false,
          bottomCollapsed: true
        },
        unknown: {
          inspectorWidth: 999
        }
      })
    );

    useUiStore.getState().resetUiState();

    expect(useUiStore.getState().workspaceLayouts.translation).toMatchObject({
      inspectorWidth: 388,
      bottomDockHeight: 248,
      inspectorCollapsed: false,
      bottomCollapsed: true
    });
    expect(useUiStore.getState().workspaceLayouts.transcription.inspectorWidth).toBe(420);
    expect(useUiStore.getState().workspaceLayouts.delivery.bottomCollapsed).toBe(false);
  });

  it("resets all persisted workspace layouts back to desktop defaults", () => {
    useUiStore.getState().setWorkspaceLayout("translation", {
      inspectorWidth: 420,
      bottomDockHeight: 320,
      inspectorCollapsed: true,
      bottomCollapsed: true
    });

    useUiStore.getState().resetWorkspaceLayouts();

    expect(useUiStore.getState().workspaceLayouts.translation).toEqual({
      inspectorWidth: 420,
      bottomDockHeight: 240,
      inspectorCollapsed: false,
      bottomCollapsed: false
    });
    expect(useUiStore.getState().workspaceLayouts.transcription).toEqual({
      inspectorWidth: 420,
      bottomDockHeight: 240,
      inspectorCollapsed: false,
      bottomCollapsed: false
    });
    expect(JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? "{}")).toEqual(
      useUiStore.getState().workspaceLayouts
    );
  });
});
