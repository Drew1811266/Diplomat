import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import { WorkbenchPage } from "./WorkbenchPage";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

beforeEach(async () => {
  stubMatchMedia(false);
  await appI18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("WorkbenchPage", () => {
  it("renders the media-centered workbench regions", () => {
    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByRole("toolbar", { name: "Project tools" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Subtitle Grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Timeline")).toBeInTheDocument();
  });

  it("stacks the inspector below media panes on narrow screens", () => {
    stubMatchMedia(true);

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByTestId("workbench-body")).toHaveAttribute("data-layout", "stacked");
  });

  it("keeps growing subtitle and inspector content independently scrollable", () => {
    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByTestId("subtitle-grid-body")).toHaveStyle({ overflow: "auto" });
    expect(screen.getByTestId("inspector-body")).toHaveStyle({ overflow: "auto" });
  });

  it("selects a subtitle row, returns to line inspector mode, and updates preview overlay", async () => {
    const user = userEvent.setup();
    useUiStore.getState().setInspectorMode("translation");

    renderWithProviders(<WorkbenchPage />);

    await user.click(screen.getByRole("button", { name: "Select line line-1" }));

    expect(screen.getByRole("heading", { name: "Line" })).toBeInTheDocument();
    expect(screen.getByLabelText("Source text")).toHaveValue("原始字幕文本");
    expect(within(screen.getByLabelText("Video preview")).getByText("原始字幕文本")).toBeInTheDocument();
  });

  it("switches inspector modes from the toolbar", async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkbenchPage />);

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(screen.getByRole("heading", { name: "Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Provider" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Translate" }));
    expect(screen.getByRole("heading", { name: "Translation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Target language")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("heading", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Export mode" })).toBeInTheDocument();
  });

  it("blocks export after local subtitle edits until the draft is saved", async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkbenchPage />);

    await user.click(screen.getByRole("button", { name: "Select line line-1" }));
    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Edited source");

    const toolbar = screen.getByRole("toolbar", { name: "Project tools" });
    const toolbarSave = within(toolbar).getByRole("button", { name: "Save" });
    expect(toolbarSave).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Export" }));

    const inspector = screen.getByLabelText("Inspector");
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeDisabled();
    expect(within(inspector).getByText("Save subtitle edits before exporting.")).toBeInTheDocument();

    await user.click(toolbarSave);

    expect(toolbarSave).toBeDisabled();
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeEnabled();
    expect(
      within(inspector).queryByText("Save subtitle edits before exporting.")
    ).not.toBeInTheDocument();
  });

  it("uses localized workbench accessibility labels", async () => {
    await appI18n.changeLanguage("zh");

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByRole("main", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "项目工具" })).toBeInTheDocument();
    expect(screen.getByLabelText("视频预览")).toBeInTheDocument();
    expect(screen.getByLabelText("字幕表格")).toBeInTheDocument();
    expect(screen.getByLabelText("检查器")).toBeInTheDocument();
    expect(screen.getByLabelText("时间线")).toBeInTheDocument();
    expect(screen.getByText("1 行字幕")).toBeInTheDocument();
  });
});
