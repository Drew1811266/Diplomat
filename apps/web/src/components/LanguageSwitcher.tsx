import { SegmentedControl } from "@mantine/core";
import { appI18n, type AppLanguage } from "../app/i18n";
import { useUiStore } from "../state/uiStore";

export function LanguageSwitcher() {
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);

  function handleChange(nextLanguage: string) {
    const typedLanguage = nextLanguage as AppLanguage;
    setLanguage(typedLanguage);
    void appI18n.changeLanguage(typedLanguage);
  }

  return (
    <SegmentedControl
      aria-label="Interface language"
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
