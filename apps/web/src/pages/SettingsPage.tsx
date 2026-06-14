import {
  Badge,
  Box,
  Button,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { IconFolderOpen, IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { openPathInFileManager, startWorker, stopWorker } from "../desktop";
import { useDesktopRuntimeStatusQuery } from "../queries/workerQueries";

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

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return <TextInput label={label} value={value} readOnly />;
}

function RuntimePathField({
  label,
  value,
  openLabel
}: {
  label: string;
  value: string;
  openLabel: string;
}) {
  return (
    <Group align="flex-end" gap="xs">
      <Box style={{ flex: 1 }}>
        <ReadonlyField label={label} value={value} />
      </Box>
      <Button
        type="button"
        variant="default"
        leftSection={<IconFolderOpen size={16} />}
        onClick={() => void openPathInFileManager(value)}
      >
        {openLabel}
      </Button>
    </Group>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const runtime = useDesktopRuntimeStatusQuery();
  const runtimeStatus = runtime.data;

  function refreshAfter(action: () => Promise<unknown>) {
    void action().then(() => runtime.refetch());
  }

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

        <SettingsSection title={t("settings.runtime")}>
          {runtimeStatus ? (
            <Stack gap="sm">
              <Group gap="xs">
                <Badge color={runtimeStatus.worker.status === "running" ? "teal" : "gray"}>
                  {runtimeStatus.worker.status}
                </Badge>
                <Text size="sm" c="dimmed">
                  {runtimeStatus.worker.message}
                </Text>
              </Group>
              <Group grow align="flex-start">
                <ReadonlyField
                  label={t("settings.workerEndpoint")}
                  value={runtimeStatus.worker.endpoint}
                />
                <ReadonlyField
                  label={t("settings.workerStatus")}
                  value={runtimeStatus.worker.status}
                />
              </Group>
              <Group grow align="flex-start">
                <ReadonlyField
                  label={t("settings.ffmpegStatus")}
                  value={runtimeStatus.ffmpeg.status}
                />
                <ReadonlyField
                  label={t("settings.ffprobeStatus")}
                  value={runtimeStatus.ffprobe.status}
                />
              </Group>
              <ReadonlyField
                label={t("settings.ffmpegVersion")}
                value={runtimeStatus.ffmpeg.version ?? runtimeStatus.ffmpeg.message}
              />
              <ReadonlyField
                label={t("settings.ffprobeVersion")}
                value={runtimeStatus.ffprobe.version ?? runtimeStatus.ffprobe.message}
              />
              <Group gap="xs">
                <Button
                  type="button"
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={() => refreshAfter(startWorker)}
                >
                  {t("settings.startWorker")}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  leftSection={<IconPlayerStop size={16} />}
                  onClick={() => refreshAfter(stopWorker)}
                >
                  {t("settings.stopWorker")}
                </Button>
              </Group>
              <RuntimePathField
                label={t("settings.dataDirectory")}
                value={runtimeStatus.directories.data}
                openLabel={t("settings.openData")}
              />
              <RuntimePathField
                label={t("settings.modelsDirectory")}
                value={runtimeStatus.directories.models}
                openLabel={t("settings.openModels")}
              />
              <RuntimePathField
                label={t("settings.logsDirectory")}
                value={runtimeStatus.directories.logs}
                openLabel={t("settings.openLogs")}
              />
            </Stack>
          ) : (
            <Stack gap="xs">
              <ReadonlyField label={t("settings.workerUrl")} value={workerBaseUrl()} />
              <Text size="sm" c="dimmed">
                {t("settings.desktopRuntimeUnavailable")}
              </Text>
            </Stack>
          )}
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
