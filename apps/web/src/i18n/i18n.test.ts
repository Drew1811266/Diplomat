import { describe, expect, it } from "vitest";
import { en } from "./en";
import { zh } from "./zh";

function flattenKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return flattenKeys(entry as Record<string, unknown>, nextKey);
    }
    return [nextKey];
  });
}

describe("i18n resources", () => {
  it("keeps English and Chinese keys aligned", () => {
    expect(flattenKeys(zh).sort()).toEqual(flattenKeys(en).sort());
  });
});
