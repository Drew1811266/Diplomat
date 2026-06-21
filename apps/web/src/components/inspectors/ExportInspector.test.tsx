import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubtitleExportResponse, TaskResponse } from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzedDocumentFixture } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { ExportInspector } from "./ExportInspector";

const style = analyzedDocumentFixture.styles[0]!;
const exportResult: SubtitleExportResponse = {
  projectId: "project-1",
  exportPath: "D:/exports/project-1.srt",
  format: "srt",
  mode: "target",
  warnings: []
};

const exportTask: TaskResponse = {
  taskId: "task-export",
  projectId: "project-1",
  type: "export",
  status: "running",
  progress: 0.42,
  message: "Rendering video",
  startedAt: "2026-06-14T00:00:00+00:00",
  updatedAt: "2026-06-14T00:00:01+00:00",
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  diagnosticLogPath: null
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
        format="srt"
        mode="bilingual"
        result={null}
        canExport
        disabledReason={null}
        busy={false}
        style={style}
        validationIssues={[]}
        onFormatChange={() => undefined}
        onModeChange={onModeChange}
        onStyleChange={() => undefined}
        onExport={onExport}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
      target: { value: "ass" }
    });
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
        format="srt"
        mode="target"
        result={null}
        canExport={false}
        disabledReason="Save subtitle edits before exporting."
        busy={false}
        style={style}
        onFormatChange={() => undefined}
        onModeChange={() => undefined}
        onStyleChange={() => undefined}
        onExport={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByText("Save subtitle edits before exporting.")).toBeInTheDocument();
  });

  it("disables export while busy and displays the export result", () => {
    renderWithProviders(
      <ExportInspector
        format="srt"
        mode="target"
        result={exportResult}
        canExport
        disabledReason={null}
        busy
        style={style}
        onFormatChange={() => undefined}
        onModeChange={() => undefined}
        onStyleChange={() => undefined}
        onExport={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Export mode" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByText("SRT exported: D:/exports/project-1.srt")).toBeInTheDocument();
  });

  it("edits export format, style, safe area, and presets", async () => {
    const user = userEvent.setup();
    const onFormatChange = vi.fn();
    const onStyleChange = vi.fn();
    const onCreatePreset = vi.fn();
    const onUpdatePreset = vi.fn();
    const onDeletePreset = vi.fn();
    const onApplyPreset = vi.fn();
    const onShowSafeAreaChange = vi.fn();

    renderWithProviders(
      <ExportInspector
        format="srt"
        mode="bilingual"
        result={null}
        canExport
        disabledReason={null}
        busy={false}
        validationIssues={[
          {
            lineId: "line-1",
            code: "too_short",
            severity: "warning",
            message: "Cue is shorter than 300ms."
          }
        ]}
        style={style}
        presets={[
          {
            id: "preset-default",
            name: "Default",
            style,
            createdAt: "2026-06-14T00:00:00+00:00",
            updatedAt: "2026-06-14T00:00:00+00:00"
          }
        ]}
        activePresetId="preset-default"
        onFormatChange={onFormatChange}
        onModeChange={() => undefined}
        onStyleChange={onStyleChange}
        onCreatePreset={onCreatePreset}
        onUpdatePreset={onUpdatePreset}
        onDeletePreset={onDeletePreset}
        onApplyPreset={onApplyPreset}
        onShowSafeAreaChange={onShowSafeAreaChange}
        onExport={() => undefined}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
      target: { value: "ass" }
    });
    fireEvent.change(screen.getByLabelText("Font size"), {
      target: { value: "48" }
    });
    await user.click(screen.getByLabelText("Safe area"));
    await user.click(screen.getByRole("button", { name: "Apply preset" }));
    await user.click(screen.getByRole("button", { name: "Update preset" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.type(screen.getByLabelText("Preset name"), "Broadcast");
    await user.click(screen.getByRole("button", { name: "Save preset" }));
    await user.type(screen.getByLabelText("Preset name"), "Renamed");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.getByText("1 timing warning will be included.")).toBeInTheDocument();
    expect(onFormatChange).toHaveBeenCalledWith("ass");
    expect(onStyleChange).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 48 }));
    expect(onShowSafeAreaChange).toHaveBeenCalledWith(true);
    expect(onApplyPreset).toHaveBeenCalledWith("preset-default");
    expect(onUpdatePreset).toHaveBeenCalledWith("preset-default", { style });
    expect(onDeletePreset).toHaveBeenCalledWith("preset-default");
    expect(onCreatePreset).toHaveBeenCalledWith("Broadcast", expect.objectContaining({ name: "Broadcast" }));
    expect(onUpdatePreset).toHaveBeenCalledWith("preset-default", { name: "Renamed" });
  });

  it("can render as a style-only inspector without delivery controls", () => {
    renderWithProviders(
      <ExportInspector
        surface="style"
        format="srt"
        mode="bilingual"
        result={null}
        canExport
        disabledReason={null}
        busy={false}
        style={style}
        onFormatChange={() => undefined}
        onModeChange={() => undefined}
        onStyleChange={() => undefined}
        onExport={() => undefined}
      />
    );

    expect(screen.getByLabelText("Font family")).toBeInTheDocument();
    expect(screen.getByLabelText("Safe area")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Format" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Export mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Render video" })).not.toBeInTheDocument();
  });

  it("can render as a delivery-only inspector without style controls", () => {
    renderWithProviders(
      <ExportInspector
        surface="delivery"
        format="srt"
        mode="bilingual"
        result={null}
        canExport
        disabledReason={null}
        busy={false}
        style={style}
        onFormatChange={() => undefined}
        onModeChange={() => undefined}
        onStyleChange={() => undefined}
        onExport={() => undefined}
        onBurnInExport={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Format" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Export mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Render video" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Font family")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Preset name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Safe area")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply preset" })).not.toBeInTheDocument();
  });

  it("starts burn-in export and exposes export task controls", async () => {
    const user = userEvent.setup();
    const onBurnInExport = vi.fn();
    const onCancelTask = vi.fn();
    const onRetryTask = vi.fn();
    const onOpenExportsFolder = vi.fn();

    renderWithProviders(
      <ExportInspector
        format="srt"
        mode="bilingual"
        result={null}
        canExport
        disabledReason={null}
        busy={false}
        style={style}
        latestTask={exportTask}
        canCancelTask
        canRetryTask
        exportsDir="D:/Diplomat/projects/project-1/exports"
        onFormatChange={() => undefined}
        onModeChange={() => undefined}
        onStyleChange={() => undefined}
        onExport={() => undefined}
        onBurnInExport={onBurnInExport}
        onCancelTask={onCancelTask}
        onRetryTask={onRetryTask}
        onOpenExportsFolder={onOpenExportsFolder}
      />
    );

    await user.click(screen.getByRole("button", { name: "Render video" }));
    await user.click(screen.getByRole("button", { name: "Cancel render" }));
    await user.click(screen.getByRole("button", { name: "Retry render" }));
    await user.click(screen.getByRole("button", { name: "Open export folder" }));

    expect(screen.getByText("Rendering video")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(onBurnInExport).toHaveBeenCalledTimes(1);
    expect(onCancelTask).toHaveBeenCalledTimes(1);
    expect(onRetryTask).toHaveBeenCalledTimes(1);
    expect(onOpenExportsFolder).toHaveBeenCalledTimes(1);
  });
});
