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
      translationError: null,
      translationQualityIssues: []
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
      translationError: null,
      translationQualityIssues: []
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
      translationError: "Provider timeout",
      translationQualityIssues: []
    }
  ];
}

function makeManyLines(count: number): SubtitleLine[] {
  return Array.from({ length: count }, (_, index) => ({
    ...baseLine,
    id: `line-${index + 1}`,
    startMs: index * 1500,
    endMs: index * 1500 + 1200,
    sourceText: `Source subtitle ${index + 1}`,
    translatedText: `Translated subtitle ${index + 1}`,
    reviewStatus: "draft",
    translationStatus: "translated",
    translationError: null,
    translationQualityIssues: []
  }));
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
        activeLineId="line-1"
        filter="all"
        onFilterChange={() => undefined}
        onSelectLine={onSelectLine}
      />
    );

    const table = screen.getByRole("table", { name: "Subtitle Grid" });
    expect(table).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Source" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Translation" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Start" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "End" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Review" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.getByText("原始字幕文本")).toBeInTheDocument();
    expect(screen.getByText("Second subtitle line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select line 1" })).toHaveTextContent("1");
    expect(screen.queryByText("line-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("subtitle-row-line-2")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("subtitle-row-line-1")).toHaveAttribute("data-active", "true");

    await user.click(screen.getByRole("button", { name: "Select line 1" }));

    expect(onSelectLine).toHaveBeenCalledWith("line-1");
  });

  it("requests filter changes and shows missing translations only when controlled", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    const { rerender } = renderWithProviders(
      <SubtitleGrid
        lines={makeLines()}
        selectedLineId={null}
        activeLineId={null}
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
        activeLineId={null}
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

  it("shows timing issue badges on affected rows", () => {
    renderWithProviders(
      <SubtitleGrid
        lines={makeLines()}
        selectedLineId={null}
        activeLineId={null}
        timingIssuesByLineId={{
          "line-2": [
            {
              lineId: "line-2",
              code: "overlap_previous",
              severity: "error"
            }
          ]
        }}
        filter="all"
        onFilterChange={() => undefined}
        onSelectLine={() => undefined}
      />
    );

    expect(screen.getByTestId("subtitle-row-line-2")).toHaveAttribute("data-has-issues", "true");
    expect(screen.getByText("1 timing issue")).toBeInTheDocument();
  });

  it("shows translation quality issue badges on affected rows", () => {
    const lines = makeLines();
    lines[1] = {
      ...lines[1]!,
      translationQualityIssues: [
        {
          code: "glossary_term_missing",
          severity: "warning",
          message: 'Expected translation for "GPU" to include "Graphics processor".',
          termId: "term-1"
        }
      ]
    };

    renderWithProviders(
      <SubtitleGrid
        lines={lines}
        selectedLineId={null}
        activeLineId={null}
        filter="all"
        onFilterChange={() => undefined}
        onSelectLine={() => undefined}
      />
    );

    expect(screen.getByTestId("subtitle-row-line-2")).toHaveAttribute("data-has-issues", "true");
    expect(screen.getByText("1 quality issue")).toBeInTheDocument();
  });

  it("virtualizes long subtitle documents instead of rendering every row", () => {
    renderWithProviders(
      <SubtitleGrid
        lines={makeManyLines(1000)}
        selectedLineId={null}
        activeLineId={null}
        filter="all"
        onFilterChange={() => undefined}
        onSelectLine={() => undefined}
      />
    );

    expect(screen.getByText("1000 rows")).toBeInTheDocument();
    expect(screen.getByTestId("subtitle-row-line-1")).toBeInTheDocument();
    expect(screen.queryByTestId("subtitle-row-line-999")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^subtitle-row-line-/)).toHaveLength(80);
  });
});
