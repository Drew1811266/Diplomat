import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUiStore.getState().resetUiState();
  });

  it("tracks page, inspector mode, selected line, and language", () => {
    useUiStore.getState().setPage("settings");
    useUiStore.getState().setSelectedLineId("line-1");
    useUiStore.getState().setLanguage("zh");

    expect(useUiStore.getState().currentPage).toBe("settings");
    expect(useUiStore.getState().inspectorMode).toBe("line");
    expect(useUiStore.getState().selectedLineId).toBe("line-1");
    expect(useUiStore.getState().language).toBe("zh");
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
});
