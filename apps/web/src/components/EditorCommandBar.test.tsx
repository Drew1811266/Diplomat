import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { EditorCommandBar } from "./EditorCommandBar";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EditorCommandBar", () => {
  it("renders editing commands and disables unavailable actions", () => {
    renderWithProviders(
      <EditorCommandBar
        canUndo
        canRedo={false}
        canEdit
        offsetMs={250}
        offsetScope="selected"
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onSplit={vi.fn()}
        onMergePrevious={vi.fn()}
        onMergeNext={vi.fn()}
        onOffsetMsChange={vi.fn()}
        onOffsetScopeChange={vi.fn()}
        onApplyOffset={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />
    );

    expect(screen.getByRole("toolbar", { name: "Editor commands" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Split line" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Offset milliseconds" })).toHaveValue("250");
  });

  it("calls command handlers", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    const onApplyOffset = vi.fn();
    const onOpenShortcuts = vi.fn();

    renderWithProviders(
      <EditorCommandBar
        canUndo
        canRedo
        canEdit
        offsetMs={250}
        offsetScope="all"
        onUndo={onUndo}
        onRedo={vi.fn()}
        onSplit={vi.fn()}
        onMergePrevious={vi.fn()}
        onMergeNext={vi.fn()}
        onOffsetMsChange={vi.fn()}
        onOffsetScopeChange={vi.fn()}
        onApplyOffset={onApplyOffset}
        onOpenShortcuts={onOpenShortcuts}
      />
    );

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Apply offset" }));
    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onApplyOffset).toHaveBeenCalledTimes(1);
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
  });
});
