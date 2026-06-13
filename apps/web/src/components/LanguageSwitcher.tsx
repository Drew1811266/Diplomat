import { SegmentedControl } from "@mantine/core";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { appI18n, type AppLanguage } from "../app/i18n";
import { useUiStore } from "../state/uiStore";

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);

  useEffect(() => {
    if (appI18n.resolvedLanguage !== language && appI18n.language !== language) {
      void appI18n.changeLanguage(language);
    }
  }, [language]);

  function handleChange(nextLanguage: string) {
    const typedLanguage = nextLanguage as AppLanguage;
    setLanguage(typedLanguage);
    void appI18n.changeLanguage(typedLanguage);
  }

  return (
    <SegmentedControl
      aria-label={t("settings.language")}
      size="xs"
      value={language}
      onChange={handleChange}
      data={[
        { label: "EN", value: "en" },
        { label: "中文", value: "zh" }
      ]}
    />
  );
}
