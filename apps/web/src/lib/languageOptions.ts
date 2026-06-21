import type { TFunction } from "i18next";

const commonLanguageCodes = ["zh", "en", "ja", "ko", "es", "fr", "de", "it", "pt", "ru", "ar"];

function normalizeLanguageCode(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function uniqueLanguageCodes(extraCodes: Array<string | null | undefined>) {
  const codes = new Set(commonLanguageCodes);

  extraCodes.forEach((code) => {
    const normalized = normalizeLanguageCode(code);
    if (normalized) {
      codes.add(normalized);
    }
  });

  return Array.from(codes);
}

function languageLabel(t: TFunction, code: string) {
  const key = `languages.${code}`;
  const translated = t(key);
  const name = translated === key ? code : translated;
  return `${name} (${code})`;
}

export function createLanguageSelectData(
  t: TFunction,
  extraCodes: Array<string | null | undefined> = []
) {
  return uniqueLanguageCodes(extraCodes).map((code) => ({
    value: code,
    label: languageLabel(t, code)
  }));
}

export function createRequiredLanguageSelectData(
  t: TFunction,
  extraCodes: Array<string | null | undefined> = []
) {
  return [{ value: "", label: t("languages.selectLanguage") }, ...createLanguageSelectData(t, extraCodes)];
}

export function createOptionalLanguageSelectData(
  t: TFunction,
  emptyLabel: string,
  extraCodes: Array<string | null | undefined> = []
) {
  return [{ value: "", label: emptyLabel }, ...createLanguageSelectData(t, extraCodes)];
}
