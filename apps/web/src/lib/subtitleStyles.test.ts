import { describe, expect, it } from "vitest";
import { previewStyleToCss, subtitleStyleWithDefaults, timingIssueSummary } from "./subtitleStyles";
import type { TimingValidationResult } from "./timingValidation";

const style = {
  id: "default",
  name: "Default",
  fontFamily: "Arial",
  fontSize: 42,
  primaryColor: "#ffffff",
  secondaryColor: "#14b8a6",
  strokeWidth: 2,
  shadow: 1,
  position: "bottom",
  marginV: 48,
  alignment: "center",
  bilingualLayout: "source_top",
  lineSpacing: 1.1
};

describe("subtitle styles", () => {
  it("normalizes missing visual fields for existing documents", () => {
    const normalized = subtitleStyleWithDefaults(style);

    expect(normalized.backgroundBar).toBe(false);
    expect(normalized.backgroundColor).toBe("#000000cc");
    expect(normalized.safeAreaMargin).toBe(32);
  });

  it("maps subtitle style to preview css", () => {
    const css = previewStyleToCss(
      subtitleStyleWithDefaults({
        ...style,
        primaryColor: "#ffeecc",
        backgroundBar: true
      })
    );

    expect(css.color).toBe("#ffeecc");
    expect(css.fontFamily).toContain("Arial");
    expect(css.background).toBe("#000000cc");
  });

  it("summarizes timing issue counts", () => {
    const validation: TimingValidationResult = {
      issues: [
        { lineId: "line-1", code: "overlap_next", severity: "error" },
        { lineId: "line-2", code: "too_short", severity: "warning" }
      ],
      byLineId: {}
    };

    expect(timingIssueSummary(validation)).toEqual({ errors: 1, warnings: 1 });
  });
});
