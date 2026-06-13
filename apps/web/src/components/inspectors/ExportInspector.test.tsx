import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SrtExportResponse } from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { ExportInspector } from "./ExportInspector";

const exportResult: SrtExportResponse = {
  projectId: "project-1",
  exportPath: "D:/exports/project-1.srt",
  mode: "target"
};

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExportInspector", () => {
  it("switches export mode and starts export when allowed", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const onExport = vi.fn();

    renderWithProviders(
      <ExportInspector
        mode="bilingual"
        result={null}
        canExport
        disabledReason={null}
        busy={false}
        onModeChange={onModeChange}
        onExport={onExport}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Export mode" }), {
      target: { value: "source" }
    });
    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(onModeChange).toHaveBeenCalledWith("source");
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("disables export when unavailable and shows the disabled reason", () => {
    renderWithProviders(
      <ExportInspector
        mode="target"
        result={null}
        canExport={false}
        disabledReason="Save subtitle edits before exporting."
        busy={false}
        onModeChange={() => undefined}
        onExport={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByText("Save subtitle edits before exporting.")).toBeInTheDocument();
  });

  it("disables export while busy and displays the export result", () => {
    renderWithProviders(
      <ExportInspector
        mode="target"
        result={exportResult}
        canExport
        disabledReason={null}
        busy
        onModeChange={() => undefined}
        onExport={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Export mode" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByText("SRT exported: D:/exports/project-1.srt")).toBeInTheDocument();
  });
});
