import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { TopToolbar } from "./TopToolbar";

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
});

describe("TopToolbar", () => {
  it("keeps the project toolbar to commands instead of duplicating workflow navigation", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onInspectorMode = vi.fn();

    renderWithProviders(
      <TopToolbar
        canSave={false}
        canExport
        onImport={onImport}
        onInspectorMode={onInspectorMode}
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Analyze" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Translate" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import video" }));
    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onInspectorMode).toHaveBeenCalledTimes(1);
    expect(onInspectorMode).toHaveBeenCalledWith("export");
  });

  it("disables save when saving is unavailable and calls save when enabled", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    const { rerender } = renderWithProviders(
      <TopToolbar
        canSave={false}
        canExport={false}
        onInspectorMode={vi.fn()}
        onSave={onSave}
      />
    );

    const disabledSave = screen.getByRole("button", { name: "Save" });
    expect(disabledSave).toBeDisabled();
    await user.click(disabledSave);
    expect(onSave).not.toHaveBeenCalled();

    rerender(
      <TopToolbar
        canSave
        canExport={false}
        onInspectorMode={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
