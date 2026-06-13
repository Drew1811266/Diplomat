import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubtitleLine } from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { analyzedDocumentFixture } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { LineInspector } from "./LineInspector";

const selectedLine: SubtitleLine = {
  ...analyzedDocumentFixture.lines[0]!,
  translatedText: "Old translation",
  translationStatus: "failed",
  translationError: "Provider timeout"
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

describe("LineInspector", () => {
  it("renders an empty state when no subtitle line is selected", () => {
    renderWithProviders(
      <LineInspector line={null} busy={false} onChangeLine={() => undefined} onSave={() => undefined} />
    );

    expect(screen.getByText("Select a subtitle row to edit timing and text.")).toBeInTheDocument();
  });

  it("edits timing and text fields, marking translated text as edited", async () => {
    const user = userEvent.setup();
    const onChangeLine = vi.fn();

    function Harness() {
      const [line, setLine] = useState(selectedLine);

      return (
        <LineInspector
          line={line}
          busy={false}
          onChangeLine={(nextLine) => {
            onChangeLine(nextLine);
            setLine(nextLine);
          }}
          onSave={() => undefined}
        />
      );
    }

    renderWithProviders(<Harness />);

    fireEvent.change(screen.getByLabelText("Start ms"), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText("End ms"), { target: { value: "2600" } });
    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Updated source");
    await user.clear(screen.getByLabelText("Translated text"));
    await user.type(screen.getByLabelText("Translated text"), "Updated translation");

    expect(screen.getByLabelText("Start ms")).toHaveValue("1200");
    expect(screen.getByLabelText("End ms")).toHaveValue("2600");
    expect(screen.getByLabelText("Source text")).toHaveValue("Updated source");
    expect(screen.getByLabelText("Translated text")).toHaveValue("Updated translation");
    expect(onChangeLine).toHaveBeenLastCalledWith(
      expect.objectContaining({
        translatedText: "Updated translation",
        translationStatus: "edited",
        translationError: null
      })
    );
  });

  it("saves the selected line and disables controls while busy", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = renderWithProviders(
      <LineInspector line={selectedLine} busy={false} onChangeLine={() => undefined} onSave={onSave} />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledTimes(1);

    rerender(
      <LineInspector line={selectedLine} busy onChangeLine={() => undefined} onSave={onSave} />
    );

    expect(screen.getByLabelText("Start ms")).toBeDisabled();
    expect(screen.getByLabelText("End ms")).toBeDisabled();
    expect(screen.getByLabelText("Source text")).toBeDisabled();
    expect(screen.getByLabelText("Translated text")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
