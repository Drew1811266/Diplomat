import { describe, expect, it } from "vitest";
import { appI18n } from "../app/i18n";
import {
  createLanguageSelectData,
  createOptionalLanguageSelectData,
  createRequiredLanguageSelectData
} from "./languageOptions";

describe("languageOptions", () => {
  it("formats common language choices with readable names and stored codes", () => {
    const data = createLanguageSelectData(appI18n.t);

    expect(data).toContainEqual({ value: "zh", label: "Chinese (zh)" });
    expect(data).toContainEqual({ value: "en", label: "English (en)" });
    expect(data).toContainEqual({ value: "ja", label: "Japanese (ja)" });
  });

  it("keeps project-specific language codes selectable", () => {
    const data = createLanguageSelectData(appI18n.t, ["yue"]);

    expect(data).toContainEqual({ value: "yue", label: "yue (yue)" });
  });

  it("adds explicit empty choices for required and optional selectors", () => {
    expect(createRequiredLanguageSelectData(appI18n.t)[0]).toEqual({
      value: "",
      label: "Select language"
    });
    expect(createOptionalLanguageSelectData(appI18n.t, "Auto detect")[0]).toEqual({
      value: "",
      label: "Auto detect"
    });
  });
});
