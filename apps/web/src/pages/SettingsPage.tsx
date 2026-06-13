import { Box, Group, NativeSelect, Stack, TextInput, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

const DEFAULT_WORKER_BASE_URL = "http://127.0.0.1:8765";
const DEFAULT_SOURCE_LANGUAGE = "zh";
const DEFAULT_TARGET_LANGUAGE = "en";
const DEFAULT_EXPORT_MODE = "bilingual";

function workerBaseUrl() {
  const configuredUrl = import.meta.env.VITE_DIPLOMAT_WORKER_BASE_URL;
  return configuredUrl?.trim() ? configuredUrl.trim() : DEFAULT_WORKER_BASE_URL;
}

function SettingsSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      bg="#ffffff"
      p="md"
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 6
      }}
    >
      <Stack gap="sm">
        <Title order={3} size="h5">
          {title}
        </Title>
        {children}
      </Stack>
    </Box>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <Box component="main" aria-label={t("settings.title")} maw={920}>
      <Stack gap="md">
        <Title order={2}>{t("settings.title")}</Title>

        <SettingsSection title={t("settings.language")}>
          <Group justify="flex-start">
            <LanguageSwitcher />
          </Group>
        </SettingsSection>

        <SettingsSection title={t("settings.theme")}>
          <TextInput label={t("settings.theme")} value={t("settings.themeLight")} readOnly />
        </SettingsSection>

        <SettingsSection title={t("settings.worker")}>
          <TextInput label={t("settings.workerUrl")} value={workerBaseUrl()} readOnly />
        </SettingsSection>

        <SettingsSection title={t("settings.defaults")}>
          <Group grow align="flex-start">
            <TextInput
              label={t("settings.defaultSourceLanguage")}
              value={DEFAULT_SOURCE_LANGUAGE}
              readOnly
            />
            <TextInput
              label={t("settings.defaultTargetLanguage")}
              value={DEFAULT_TARGET_LANGUAGE}
              readOnly
            />
          </Group>
          <NativeSelect
            label={t("settings.defaultExportMode")}
            value={DEFAULT_EXPORT_MODE}
            disabled
            data={[
              { label: t("exportModes.source"), value: "source" },
              { label: t("exportModes.target"), value: "target" },
              { label: t("exportModes.bilingual"), value: "bilingual" }
            ]}
          />
        </SettingsSection>
      </Stack>
    </Box>
  );
}
