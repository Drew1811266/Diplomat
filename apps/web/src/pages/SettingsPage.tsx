import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  VisuallyHidden
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconAlertTriangle,
  IconCircleCheck,
  IconDownload,
  IconFolderOpen,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconUpload
} from "@tabler/icons-react";
import type {
  ReleaseReadinessCheck,
  ReleaseReadinessSeverity,
  SubtitleExportMode
} from "@diplomat/shared";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { workstationSurfaces } from "../app/theme";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { openPathInFileManager, startWorker, stopWorker } from "../desktop";
import { createLanguageSelectData } from "../lib/languageOptions";
import { ModelsContent } from "./ModelsPage";
import { useReleaseReadinessQuery } from "../queries/releaseQueries";
import { useDesktopRuntimeStatusQuery } from "../queries/workerQueries";
import { useUiStore, type SystemSettingsCategory } from "../state/uiStore";

const DEFAULT_WORKER_BASE_URL = "http://127.0.0.1:8765";
const APP_VERSION = "0.42.0";
const SHORTCUT_BINDINGS_STORAGE_KEY = "diplomat.shortcutBindings";
const SHORTCUT_CONFIG_VERSION = 1;
const everydaySettingsCategories: SystemSettingsCategory[] = [
  "appearance",
  "language",
  "runtime",
  "models",
  "defaults",
  "shortcuts"
];
const advancedSettingsCategories: SystemSettingsCategory[] = [
  "general",
  "privacy",
  "advanced",
  "diagnostics",
  "about",
  "release"
];

function isAdvancedSettingsCategory(category: SystemSettingsCategory) {
  return advancedSettingsCategories.includes(category);
}

const shortcutCommands = [
  {
    categoryKey: "settings.shortcutCategories.editing",
    commandKey: "settings.shortcutCommands.splitLine",
    binding: "Ctrl+Enter"
  },
  {
    categoryKey: "settings.shortcutCategories.editing",
    commandKey: "settings.shortcutCommands.undoEdit",
    binding: "Ctrl+Z"
  },
  {
    categoryKey: "settings.shortcutCategories.editing",
    commandKey: "settings.shortcutCommands.redoEdit",
    binding: "Ctrl+Shift+Z"
  },
  {
    categoryKey: "settings.shortcutCategories.timeline",
    commandKey: "settings.shortcutCommands.playPause",
    binding: "Space"
  },
  {
    categoryKey: "settings.shortcutCategories.workflow",
    commandKey: "settings.shortcutCommands.importVideo",
    binding: "Ctrl+I"
  },
  {
    categoryKey: "settings.shortcutCategories.delivery",
    commandKey: "settings.shortcutCommands.exportSubtitles",
    binding: "Ctrl+E"
  }
] as const;

type ShortcutCommand = (typeof shortcutCommands)[number];
type ShortcutCommandKey = ShortcutCommand["commandKey"];
type ShortcutBindings = Record<ShortcutCommandKey, string>;

function defaultShortcutBindings(): ShortcutBindings {
  return Object.fromEntries(
    shortcutCommands.map((shortcut) => [shortcut.commandKey, shortcut.binding])
  ) as ShortcutBindings;
}

function getShortcutStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function getInitialShortcutBindings(): ShortcutBindings {
  const defaults = defaultShortcutBindings();
  const storage = getShortcutStorage();
  if (!storage) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(storage.getItem(SHORTCUT_BINDINGS_STORAGE_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    shortcutCommands.forEach((shortcut) => {
      const binding = parsed[shortcut.commandKey];
      if (typeof binding === "string" && binding.trim()) {
        defaults[shortcut.commandKey] = binding.trim();
      }
    });
  } catch {
    return defaults;
  }

  return defaults;
}

function persistShortcutBindings(bindings: ShortcutBindings) {
  try {
    getShortcutStorage()?.setItem(SHORTCUT_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Ignore storage failures; shortcut edits still apply to the current session.
  }
}

function clearPersistedShortcutBindings() {
  try {
    getShortcutStorage()?.removeItem(SHORTCUT_BINDINGS_STORAGE_KEY);
  } catch {
    // Ignore storage failures; in-memory reset still applies.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseShortcutBindingsConfig(
  value: unknown,
  fallback: ShortcutBindings
): ShortcutBindings | null {
  const source = isRecord(value) && isRecord(value.shortcuts) ? value.shortcuts : value;
  if (!isRecord(source)) {
    return null;
  }

  const nextBindings = { ...fallback };
  shortcutCommands.forEach((shortcut) => {
    const binding = source[shortcut.commandKey];
    if (typeof binding === "string" && binding.trim()) {
      nextBindings[shortcut.commandKey] = binding.trim();
    }
  });

  const seenBindings = new Set<string>();
  for (const shortcut of shortcutCommands) {
    const normalized = nextBindings[shortcut.commandKey].trim().toLowerCase();
    if (!normalized || seenBindings.has(normalized)) {
      return null;
    }
    seenBindings.add(normalized);
  }

  return nextBindings;
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

function workerBaseUrl() {
  const configuredUrl = import.meta.env.VITE_DIPLOMAT_WORKER_BASE_URL;
  return configuredUrl?.trim() ? configuredUrl.trim() : DEFAULT_WORKER_BASE_URL;
}

function SettingsSection({
  id,
  title,
  children
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      id={id}
      component="section"
      bg={workstationSurfaces.panel}
      p="md"
      style={{
        border: `1px solid ${workstationSurfaces.outline}`,
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
  const { t } = useTranslation();

  return (
    <Box
      role="group"
      aria-label={label}
      px="sm"
      py={8}
      bg={workstationSurfaces.panelAlt}
      style={{
        border: `1px solid ${workstationSurfaces.outline}`,
        borderRadius: 6
      }}
    >
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={800} c="dimmed">
          {label}
        </Text>
        <Badge size="xs" color="gray" variant="light" tt="none">
          {t("settings.currentState")}
        </Badge>
      </Group>
      <Text
        size="sm"
        fw={650}
        c={workstationSurfaces.text}
        title={value}
        style={{ wordBreak: "break-word" }}
      >
        {value}
      </Text>
    </Box>
  );
}

function ReadOnlyCategoryNotice() {
  const { t } = useTranslation();

  return (
    <Box
      role="status"
      aria-label={t("settings.readOnlyCategoryNoticeTitle")}
      p="sm"
      bg={workstationSurfaces.panelAlt}
      style={{
        border: `1px solid ${workstationSurfaces.outline}`,
        borderRadius: 6
      }}
    >
      <Text size="xs" fw={800} c={workstationSurfaces.text}>
        {t("settings.readOnlyCategoryNoticeTitle")}
      </Text>
      <Text size="sm" c={workstationSurfaces.textMuted}>
        {t("settings.readOnlyCategoryNoticeBody")}
      </Text>
    </Box>
  );
}

function RuntimeSummaryCard({
  label,
  value,
  color
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Paper withBorder radius="md" p="sm" bg={workstationSurfaces.panelAlt}>
      <Stack gap={4}>
        <Text size="xs" fw={800} c="dimmed">
          {label}
        </Text>
        <Badge color={color} variant="light" w="fit-content">
          {value}
        </Badge>
      </Stack>
    </Paper>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function displayRuntimeMessage(message: string) {
  return message
    .replaceAll("Diplomat Worker", "Diplomat local runtime")
    .replaceAll("Worker process", "Local runtime process")
    .replaceAll("Worker", "local runtime");
}

function severityColor(severity: ReleaseReadinessSeverity) {
  if (severity === "blocker") {
    return "red";
  }
  if (severity === "warning") {
    return "orange";
  }
  return "teal";
}

function ReleaseCheckRow({ check }: { check: ReleaseReadinessCheck }) {
  const { t } = useTranslation();

  return (
    <Box
      bg={workstationSurfaces.panelAlt}
      p="sm"
      style={{
        border: `1px solid ${workstationSurfaces.outline}`,
        borderRadius: 6
      }}
    >
      <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
        <Box style={{ flex: "1 1 240px", minWidth: 0 }}>
          <Text fw={600}>{check.label}</Text>
          <Text size="sm" c="dimmed">
            {check.message}
          </Text>
          {check.remediation ? (
            <Text size="sm" mt={4}>
              {t("settings.releaseCheckRemediation")}: {check.remediation}
            </Text>
          ) : null}
        </Box>
        <Badge color={severityColor(check.severity)} variant="light">
          {t(`settings.releaseSeverities.${check.severity}`)}
        </Badge>
      </Group>
    </Box>
  );
}

function ReleaseReadinessSection({ id }: { id?: string }) {
  const { t } = useTranslation();
  const readiness = useReleaseReadinessQuery();
  const report = readiness.data;

  return (
    <SettingsSection id={id} title={t("settings.releaseReadiness")}>
      {readiness.isLoading ? (
        <Text size="sm" c="dimmed">
          {t("settings.releaseReadinessLoading")}
        </Text>
      ) : null}

      {readiness.error ? (
        <Alert color="red" icon={<IconAlertTriangle size={16} />} title={t("settings.releaseReadiness")}>
          {errorMessage(readiness.error)}
        </Alert>
      ) : null}

      {report ? (
        <Stack gap="sm">
          <Group gap="xs">
            <Badge
              color={report.ready ? "teal" : "red"}
              leftSection={
                report.ready ? (
                  <IconCircleCheck size={12} aria-hidden="true" />
                ) : (
                  <IconAlertTriangle size={12} aria-hidden="true" />
                )
              }
            >
              {report.ready ? t("settings.releaseReady") : t("settings.releaseBlocked")}
            </Badge>
            <Badge color="teal" variant="light">
              {t("settings.releasePassCount", { count: report.summary.pass })}
            </Badge>
            <Badge color="orange" variant="light">
              {t("settings.releaseWarningCount", { count: report.summary.warning })}
            </Badge>
            <Badge color="red" variant="light">
              {t("settings.releaseBlockerCount", { count: report.summary.blocker })}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("settings.releaseReadinessVersion", { version: report.version })}
          </Text>
          <Stack gap="xs">
            {report.checks.map((check) => (
              <ReleaseCheckRow key={check.id} check={check} />
            ))}
          </Stack>
        </Stack>
      ) : null}
    </SettingsSection>
  );
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
  const [runtimeDetailsOpen, setRuntimeDetailsOpen] = useState(false);
  const [resetLayoutConfirmOpen, setResetLayoutConfirmOpen] = useState(false);
  const [shortcutQuery, setShortcutQuery] = useState("");
  const [shortcutBindings, setShortcutBindings] = useState<ShortcutBindings>(() =>
    getInitialShortcutBindings()
  );
  const [editingShortcutKey, setEditingShortcutKey] = useState<ShortcutCommandKey | null>(null);
  const [shortcutDraft, setShortcutDraft] = useState("");
  const [shortcutImportError, setShortcutImportError] = useState(false);
  const shortcutImportInputRef = useRef<HTMLInputElement | null>(null);
  const activeCategory = useUiStore((state) => state.settingsCategory);
  const setActiveCategory = useUiStore((state) => state.setSettingsCategory);
  const projectDefaults = useUiStore((state) => state.projectDefaults);
  const setProjectDefaults = useUiStore((state) => state.setProjectDefaults);
  const resetWorkspaceLayouts = useUiStore((state) => state.resetWorkspaceLayouts);
  const [advancedToolsOpen, setAdvancedToolsOpen] = useState(() =>
    isAdvancedSettingsCategory(activeCategory)
  );
  const runtime = useDesktopRuntimeStatusQuery();
  const runtimeStatus = runtime.data;
  const defaultLanguageOptions = createLanguageSelectData(t, [
    projectDefaults.sourceLanguage,
    projectDefaults.targetLanguage
  ]);

  useEffect(() => {
    if (isAdvancedSettingsCategory(activeCategory)) {
      setAdvancedToolsOpen(true);
    }
  }, [activeCategory]);

  function refreshAfter(action: () => Promise<unknown>) {
    void action().then(() => runtime.refetch());
  }

  function restartWorker() {
    refreshAfter(async () => {
      await stopWorker();
      return startWorker();
    });
  }

  function beginShortcutRebind(shortcut: ShortcutCommand) {
    setEditingShortcutKey(shortcut.commandKey);
    setShortcutDraft(shortcutBindings[shortcut.commandKey]);
  }

  function cancelShortcutRebind() {
    setEditingShortcutKey(null);
    setShortcutDraft("");
  }

  function saveShortcutRebind() {
    if (!editingShortcutKey) {
      return;
    }

    const nextBinding = shortcutDraft.trim();
    if (!nextBinding || shortcutConflict) {
      return;
    }

    const nextBindings = {
      ...shortcutBindings,
      [editingShortcutKey]: nextBinding
    };
    setShortcutBindings(nextBindings);
    persistShortcutBindings(nextBindings);
    setShortcutImportError(false);
    cancelShortcutRebind();
  }

  function resetShortcutBindings() {
    setShortcutBindings(defaultShortcutBindings());
    clearPersistedShortcutBindings();
    setShortcutImportError(false);
    cancelShortcutRebind();
  }

  function exportShortcutBindings() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: SHORTCUT_CONFIG_VERSION,
            shortcuts: shortcutBindings
          },
          null,
          2
        )
      ],
      { type: "application/json" }
    );
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "diplomat-shortcuts.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function importShortcutBindings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await readTextFile(file)) as unknown;
      const nextBindings = parseShortcutBindingsConfig(parsed, shortcutBindings);
      if (!nextBindings) {
        setShortcutImportError(true);
        return;
      }

      setShortcutBindings(nextBindings);
      persistShortcutBindings(nextBindings);
      setShortcutImportError(false);
      cancelShortcutRebind();
    } catch {
      setShortcutImportError(true);
    }
  }

  const normalizedShortcutQuery = shortcutQuery.trim().toLowerCase();
  const normalizedShortcutDraft = shortcutDraft.trim();
  const shortcutConflict =
    editingShortcutKey && normalizedShortcutDraft
      ? shortcutCommands.find(
          (shortcut) =>
            shortcut.commandKey !== editingShortcutKey &&
            shortcutBindings[shortcut.commandKey].toLowerCase() ===
              normalizedShortcutDraft.toLowerCase()
        )
      : null;
  const visibleShortcuts = shortcutCommands.filter((shortcut) => {
    if (!normalizedShortcutQuery) {
      return true;
    }

    return [
      t(shortcut.categoryKey),
      t(shortcut.commandKey),
      shortcutBindings[shortcut.commandKey]
    ].some((value) => value.toLowerCase().includes(normalizedShortcutQuery));
  });

  function renderCategoryButton(category: SystemSettingsCategory) {
    const active = category === activeCategory;
    const label = t(`settings.categories.${category}`);

    return (
      <Button
        key={category}
        className="diplomat-settings-nav-button"
        type="button"
        aria-current={active ? "page" : undefined}
        color={active ? "teal" : "gray"}
        variant={active ? "light" : "subtle"}
        justify="flex-start"
        title={label}
        onClick={() => setActiveCategory(category)}
      >
        {label}
      </Button>
    );
  }

  return (
    <Box component="main" aria-label={t("settings.title")} maw={1440} w="100%">
      <Stack gap="md">
        <Title order={1} size="h3">
          {t("settings.title")}
        </Title>

      <Box
        className="diplomat-settings-layout"
        data-testid="settings-layout"
        data-sidebar-width="272"
      >
        <Stack
          className="diplomat-sticky-nav"
          role="navigation"
          aria-label={t("settings.categoriesNav")}
          gap={6}
          p="xs"
          style={{
            border: `1px solid ${workstationSurfaces.outline}`,
            borderRadius: 6,
            background: workstationSurfaces.panel
          }}
        >
          <Text size="xs" fw={800} c="dimmed" px="xs">
            {t("settings.categoriesNav")}
          </Text>
          <Stack role="group" aria-label={t("settings.everydaySettings")} gap={4}>
            <Text size="xs" fw={800} c={workstationSurfaces.textMuted} px="xs">
              {t("settings.everydaySettings")}
            </Text>
            {everydaySettingsCategories.map(renderCategoryButton)}
          </Stack>
          <Stack role="group" aria-label={t("settings.advancedTools")} gap={4} mt={4}>
            <Button
              type="button"
              aria-controls="settings-advanced-tools-list"
              aria-expanded={advancedToolsOpen}
              className="diplomat-settings-nav-button"
              color="gray"
              justify="space-between"
              rightSection={
                advancedToolsOpen ? (
                  <IconChevronDown size={14} aria-hidden="true" />
                ) : (
                  <IconChevronRight size={14} aria-hidden="true" />
                )
              }
              size="compact-sm"
              variant="subtle"
              onClick={() =>
                setAdvancedToolsOpen((open) =>
                  isAdvancedSettingsCategory(activeCategory) ? true : !open
                )
              }
            >
              {t("settings.advancedTools")}
            </Button>
            <Text size="xs" c={workstationSurfaces.textMuted} px="xs">
              {t("settings.advancedToolsDescription")}
            </Text>
            {advancedToolsOpen ? (
              <Stack id="settings-advanced-tools-list" gap={4}>
                {advancedSettingsCategories.map(renderCategoryButton)}
              </Stack>
            ) : null}
          </Stack>
        </Stack>

        <Box
          className="diplomat-settings-panel"
          component="section"
          aria-label={t(`settings.categories.${activeCategory}`)}
        >
          {activeCategory === "general" ? (
            <Stack gap="md">
              <SettingsSection id="settings-general" title={t("settings.general")}>
                <ReadOnlyCategoryNotice />
                <Group grow align="flex-start">
                  <ReadonlyField
                    label={t("settings.startupView")}
                    value={t("settings.startupProjectLibrary")}
                  />
                  <ReadonlyField
                    label={t("settings.settingsScope")}
                    value={t("settings.settingsScopeSystem")}
                  />
                </Group>
              </SettingsSection>
            </Stack>
          ) : null}

          {activeCategory === "language" ? (
            <SettingsSection id="settings-language" title={t("settings.categories.language")}>
              <Group justify="flex-start">
                <LanguageSwitcher />
              </Group>
            </SettingsSection>
          ) : null}

          {activeCategory === "appearance" ? (
            <SettingsSection id="settings-appearance" title={t("settings.appearance")}>
              <ReadOnlyCategoryNotice />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <ReadonlyField label={t("settings.theme")} value={t("settings.themeLight")} />
                <ReadonlyField label={t("settings.density")} value={t("settings.densityCompact")} />
                <ReadonlyField label={t("settings.interfaceScale")} value="100%" />
                <ReadonlyField label={t("settings.subtitleEditorFontSize")} value="14 px" />
                <ReadonlyField label={t("settings.timecodeFormat")} value="HH:MM:SS.mmm" />
                <ReadonlyField label={t("settings.reducedMotion")} value={t("settings.followsSystem")} />
              </SimpleGrid>
              <Button
                type="button"
                variant="default"
                color="red"
                w="fit-content"
                onClick={() => setResetLayoutConfirmOpen(true)}
              >
                {t("settings.resetWorkspaceLayout")}
              </Button>
              <Modal
                opened={resetLayoutConfirmOpen}
                onClose={() => setResetLayoutConfirmOpen(false)}
                title={t("settings.resetWorkspaceLayout")}
                centered
                radius="md"
                size="md"
                transitionProps={{ duration: 0 }}
              >
                <Stack gap="md">
                  <Alert color="red" icon={<IconAlertTriangle size={16} aria-hidden="true" />}>
                    {t("settings.resetWorkspaceLayoutBody")}
                  </Alert>
                  <Group justify="flex-end" gap="xs">
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => setResetLayoutConfirmOpen(false)}
                    >
                      {t("actions.cancel")}
                    </Button>
                    <Button
                      type="button"
                      color="red"
                      onClick={() => {
                        resetWorkspaceLayouts();
                        setResetLayoutConfirmOpen(false);
                      }}
                    >
                      {t("settings.resetWorkspaceLayoutAction")}
                    </Button>
                  </Group>
                </Stack>
              </Modal>
            </SettingsSection>
          ) : null}

          {activeCategory === "runtime" ? (
            <SettingsSection id="settings-runtime" title={t("settings.runtime")}>
              {runtimeStatus ? (
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                    <RuntimeSummaryCard
                      label={t("settings.worker")}
                      value={runtimeStatus.worker.status}
                      color={runtimeStatus.worker.status === "running" ? "teal" : "gray"}
                    />
                    <RuntimeSummaryCard
                      label={t("settings.ffmpegStatus")}
                      value={runtimeStatus.ffmpeg.status}
                      color={runtimeStatus.ffmpeg.status === "available" ? "teal" : "red"}
                    />
                    <RuntimeSummaryCard
                      label={t("settings.ffprobeStatus")}
                      value={runtimeStatus.ffprobe.status}
                      color={runtimeStatus.ffprobe.status === "available" ? "teal" : "red"}
                    />
                  </SimpleGrid>
                  <Group gap="xs">
                    <Badge color={runtimeStatus.worker.status === "running" ? "teal" : "gray"}>
                      {runtimeStatus.worker.status}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {displayRuntimeMessage(runtimeStatus.worker.message)}
                    </Text>
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
                    <Button
                      type="button"
                      variant="default"
                      leftSection={<IconRefresh size={16} />}
                      onClick={restartWorker}
                    >
                      {t("settings.restartWorker")}
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      leftSection={<IconCircleCheck size={16} />}
                      onClick={() => void runtime.refetch()}
                    >
                      {t("settings.runDiagnostics")}
                    </Button>
                  </Group>
                  <Stack gap="xs">
                    <Button
                      type="button"
                      variant="subtle"
                      size="xs"
                      color="gray"
                      aria-expanded={runtimeDetailsOpen}
                      onClick={() => setRuntimeDetailsOpen((open) => !open)}
                      w="fit-content"
                    >
                      {t("settings.advancedDetails")}
                    </Button>
                    {runtimeDetailsOpen ? (
                      <Stack gap="sm">
                        <Group grow align="flex-start">
                          <ReadonlyField
                            label={t("settings.workerEndpoint")}
                            value={runtimeStatus.worker.endpoint}
                          />
                          <ReadonlyField
                            label={t("settings.workerStatus")}
                            value={runtimeStatus.worker.status}
                          />
                          <ReadonlyField
                            label={t("settings.workerLauncher")}
                            value={runtimeStatus.workerLauncher}
                          />
                        </Group>
                      </Stack>
                    ) : null}
                  </Stack>
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
                  <Text size="sm" c="dimmed">
                    {t("settings.desktopRuntimeUnavailable")}
                  </Text>
                  <Stack gap="xs">
                    <Button
                      type="button"
                      variant="subtle"
                      size="xs"
                      color="gray"
                      aria-expanded={runtimeDetailsOpen}
                      onClick={() => setRuntimeDetailsOpen((open) => !open)}
                      w="fit-content"
                    >
                      {t("settings.advancedDetails")}
                    </Button>
                    {runtimeDetailsOpen ? (
                      <ReadonlyField label={t("settings.workerUrl")} value={workerBaseUrl()} />
                    ) : null}
                  </Stack>
                </Stack>
              )}
            </SettingsSection>
          ) : null}

          {activeCategory === "models" ? (
            <SettingsSection id="settings-models" title={t("models.title")}>
              <ModelsContent showHeader={false} />
            </SettingsSection>
          ) : null}

          {activeCategory === "shortcuts" ? (
            <SettingsSection id="settings-shortcuts" title={t("settings.shortcuts")}>
              <Group align="flex-end" gap="sm">
                <TextInput
                  label={t("settings.searchCommands")}
                  value={shortcutQuery}
                  onChange={(event) => setShortcutQuery(event.currentTarget.value)}
                  style={{ flex: "1 1 260px" }}
                />
                <Button
                  type="button"
                  variant="default"
                  leftSection={<IconUpload size={16} aria-hidden="true" />}
                  onClick={() => shortcutImportInputRef.current?.click()}
                >
                  {t("settings.importShortcuts")}
                </Button>
                <VisuallyHidden>
                  <input
                    ref={shortcutImportInputRef}
                    aria-label={t("settings.importShortcuts")}
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => void importShortcutBindings(event)}
                  />
                </VisuallyHidden>
                <Button
                  type="button"
                  variant="default"
                  leftSection={<IconDownload size={16} aria-hidden="true" />}
                  onClick={exportShortcutBindings}
                >
                  {t("settings.exportShortcuts")}
                </Button>
                <Button type="button" variant="default" onClick={resetShortcutBindings}>
                  {t("settings.resetShortcuts")}
                </Button>
              </Group>
              {shortcutImportError ? (
                <Alert
                  color="red"
                  icon={<IconAlertTriangle size={16} aria-hidden="true" />}
                  title={t("settings.shortcutImportFailed")}
                >
                  {t("settings.shortcutImportFailed")}
                </Alert>
              ) : null}
              {visibleShortcuts.length > 0 ? (
                <Box w="100%" maw="100%" style={{ overflowX: "auto" }}>
                  <Table verticalSpacing="xs" horizontalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t("settings.shortcutCategory")}</Table.Th>
                        <Table.Th>{t("settings.shortcutCommand")}</Table.Th>
                        <Table.Th>{t("settings.shortcutBinding")}</Table.Th>
                        <Table.Th>{t("settings.shortcutAction")}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {visibleShortcuts.map((shortcut) => {
                        const commandLabel = t(shortcut.commandKey);
                        const isEditing = editingShortcutKey === shortcut.commandKey;
                        const conflictMessage = shortcutConflict
                          ? t("settings.shortcutConflict", {
                              binding: normalizedShortcutDraft,
                              command: t(shortcutConflict.commandKey)
                            })
                          : undefined;

                        return (
                          <Table.Tr key={shortcut.commandKey}>
                            <Table.Td>{t(shortcut.categoryKey)}</Table.Td>
                            <Table.Td>
                              <Text fw={650}>{commandLabel}</Text>
                            </Table.Td>
                            <Table.Td>
                              {isEditing ? (
                                <TextInput
                                  label={t("settings.shortcutBindingFor", {
                                    command: commandLabel
                                  })}
                                  aria-label={t("settings.shortcutBindingFor", {
                                    command: commandLabel
                                  })}
                                  value={shortcutDraft}
                                  error={conflictMessage}
                                  onChange={(event) => setShortcutDraft(event.currentTarget.value)}
                                  styles={{
                                    label: {
                                      position: "absolute",
                                      width: 1,
                                      height: 1,
                                      overflow: "hidden",
                                      clip: "rect(0 0 0 0)"
                                    }
                                  }}
                                />
                              ) : (
                                <Badge color="gray" variant="light" tt="none">
                                  {shortcutBindings[shortcut.commandKey]}
                                </Badge>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {isEditing ? (
                                <Group gap="xs" wrap="nowrap">
                                  <Button
                                    type="button"
                                    size="compact-xs"
                                    variant="light"
                                    color="teal"
                                    disabled={Boolean(shortcutConflict) || !normalizedShortcutDraft}
                                    onClick={saveShortcutRebind}
                                  >
                                    {t("settings.saveShortcut")}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="compact-xs"
                                    variant="subtle"
                                    color="gray"
                                    onClick={cancelShortcutRebind}
                                  >
                                    {t("settings.cancelShortcutEdit")}
                                  </Button>
                                </Group>
                              ) : (
                                <Button
                                  type="button"
                                  size="compact-xs"
                                  variant="subtle"
                                  color="gray"
                                  onClick={() => beginShortcutRebind(shortcut)}
                                >
                                  {t("settings.rebindShortcut")}
                                </Button>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Box>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("settings.noShortcuts")}
                </Text>
              )}
            </SettingsSection>
          ) : null}

          {activeCategory === "privacy" ? (
            <SettingsSection id="settings-privacy" title={t("settings.privacy")}>
              <ReadOnlyCategoryNotice />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <ReadonlyField
                  label={t("settings.defaultProcessing")}
                  value={t("settings.defaultProcessingLocal")}
                />
                <ReadonlyField
                  label={t("settings.remoteServices")}
                  value={t("settings.remoteServicesDisabled")}
                />
                <ReadonlyField
                  label={t("settings.modelDownloadSources")}
                  value={t("settings.modelDownloadSourcesCurated")}
                />
                <ReadonlyField
                  label={t("settings.projectDataLocation")}
                  value={t("settings.projectDataLocationLocal")}
                />
              </SimpleGrid>
            </SettingsSection>
          ) : null}

          {activeCategory === "advanced" ? (
            <SettingsSection id="settings-advanced" title={t("settings.advanced")}>
              <ReadOnlyCategoryNotice />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <ReadonlyField
                  label={t("settings.workerEndpointRaw")}
                  value={workerBaseUrl()}
                />
                <ReadonlyField
                  label={t("settings.runtimeProfile")}
                  value={t("settings.runtimeProfileValue")}
                />
                <ReadonlyField
                  label={t("settings.dataContract")}
                  value={t("settings.dataContractStable")}
                />
                <ReadonlyField
                  label={t("settings.workerUrl")}
                  value={workerBaseUrl()}
                />
              </SimpleGrid>
            </SettingsSection>
          ) : null}

          {activeCategory === "diagnostics" ? (
            <SettingsSection id="settings-diagnostics" title={t("settings.diagnostics")}>
              {runtimeStatus ? (
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <ReadonlyField
                      label={t("settings.runtimeDiagnostics")}
                      value={displayRuntimeMessage(runtimeStatus.worker.message)}
                    />
                    <ReadonlyField
                      label={t("settings.diagnosticsDirectory")}
                      value={runtimeStatus.directories.diagnostics}
                    />
                    <ReadonlyField
                      label={t("settings.workerStdoutLog")}
                      value={runtimeStatus.diagnostics.workerStdoutLog}
                    />
                    <ReadonlyField
                      label={t("settings.workerStderrLog")}
                      value={runtimeStatus.diagnostics.workerStderrLog}
                    />
                  </SimpleGrid>
                  <Group gap="xs">
                    <Button
                      type="button"
                      variant="default"
                      leftSection={<IconCircleCheck size={16} />}
                      onClick={() => void runtime.refetch()}
                    >
                      {t("settings.runDiagnostics")}
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      leftSection={<IconFolderOpen size={16} />}
                      onClick={() => void openPathInFileManager(runtimeStatus.directories.logs)}
                    >
                      {t("settings.openLogs")}
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("settings.desktopDiagnosticsUnavailable")}
                </Text>
              )}
            </SettingsSection>
          ) : null}

          {activeCategory === "about" ? (
            <SettingsSection id="settings-about" title={t("settings.about")}>
              <ReadOnlyCategoryNotice />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <ReadonlyField label={t("settings.version")} value={APP_VERSION} />
                <ReadonlyField
                  label={t("settings.application")}
                  value={t("settings.applicationValue")}
                />
                <ReadonlyField
                  label={t("settings.licenseSummary")}
                  value={t("settings.licenseSummaryValue")}
                />
                <ReadonlyField
                  label={t("settings.dataContract")}
                  value={t("settings.dataContractStable")}
                />
              </SimpleGrid>
            </SettingsSection>
          ) : null}

          {activeCategory === "release" ? <ReleaseReadinessSection id="settings-release" /> : null}

          {activeCategory === "defaults" ? (
            <SettingsSection id="settings-defaults" title={t("settings.defaults")}>
              <Text size="sm" c="dimmed">
                {t("settings.projectDefaultsDescription")}
              </Text>
              <Group grow align="flex-start">
                <NativeSelect
                  label={t("settings.defaultSourceLanguage")}
                  value={projectDefaults.sourceLanguage}
                  data={defaultLanguageOptions}
                  onChange={(event) =>
                    setProjectDefaults({ sourceLanguage: event.currentTarget.value })
                  }
                />
                <NativeSelect
                  label={t("settings.defaultTargetLanguage")}
                  value={projectDefaults.targetLanguage}
                  data={defaultLanguageOptions}
                  onChange={(event) =>
                    setProjectDefaults({ targetLanguage: event.currentTarget.value })
                  }
                />
              </Group>
              <NativeSelect
                label={t("settings.defaultExportMode")}
                value={projectDefaults.exportMode}
                onChange={(event) =>
                  setProjectDefaults({
                    exportMode: event.currentTarget.value as SubtitleExportMode
                  })
                }
                data={[
                  { label: t("exportModes.source"), value: "source" },
                  { label: t("exportModes.target"), value: "target" },
                  { label: t("exportModes.bilingual"), value: "bilingual" }
                ]}
              />
            </SettingsSection>
          ) : null}
        </Box>
      </Box>
      </Stack>
    </Box>
  );
}
