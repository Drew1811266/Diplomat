import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubtitleLine } from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzedDocumentFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { SubtitleGrid } from "./SubtitleGrid";

const baseLine = analyzedDocumentFixture.lines[0]!;

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

function makeLines(): SubtitleLine[] {
  return [
    {
      ...baseLine,
      id: "line-1",
      startMs: 1000,
      endMs: 2400,
      sourceText: "原始字幕文本",
      translatedText: "",
      reviewStatus: "draft",
      translationStatus: "not_requested",
      translationError: null
    },
    {
      ...baseLine,
      id: "line-2",
      startMs: 2600,
      endMs: 4300,
      sourceText: "第二句字幕",
      translatedText: "Second subtitle line",
      reviewStatus: "reviewed",
      translationStatus: "translated",
      translationError: null
    },
    {
      ...baseLine,
      id: "line-3",
      startMs: 4800,
      endMs: 6100,
      sourceText: "失败字幕",
      translatedText: "Failed candidate",
      reviewStatus: "draft",
      translationStatus: "failed",
      translationError: "Provider timeout"
    }
  ];
}

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SubtitleGrid", () => {
  it("renders dense subtitle rows with required columns and selected state", async () => {
    const user = userEvent.setup();
    const onSelectLine = vi.fn();

    renderWithProviders(
      <SubtitleGrid
        lines={makeLines()}
        selectedLineId="line-2"
        filter="all"
        onFilterChange={() => undefined}
        onSelectLine={onSelectLine}
      />
    );

    const table = screen.getByRole("table", { name: "Subtitle Grid" });
    expect(table).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Start" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "End" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Source" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Translation" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("原始字幕文本")).toBeInTheDocument();
    expect(screen.getByText("Second subtitle line")).toBeInTheDocument();
    expect(screen.getByTestId("subtitle-row-line-2")).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Select line line-1" }));

    expect(onSelectLine).toHaveBeenCalledWith("line-1");
  });

  it("requests filter changes and shows missing translations only when controlled", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    const { rerender } = renderWithProviders(
      <SubtitleGrid
        lines={makeLines()}
        selectedLineId={null}
        filter="all"
        onFilterChange={onFilterChange}
        onSelectLine={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: "Missing translations" }));
    expect(onFilterChange).toHaveBeenCalledWith("missing");

    rerender(
      <SubtitleGrid
        lines={makeLines()}
        selectedLineId={null}
        filter="missing"
        onFilterChange={onFilterChange}
        onSelectLine={() => undefined}
      />
    );

    expect(screen.getByText("原始字幕文本")).toBeInTheDocument();
    expect(screen.getByText("失败字幕")).toBeInTheDocument();
    expect(screen.queryByText("Second subtitle line")).not.toBeInTheDocument();
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });
});
