import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Kbd,
  Modal,
  Popover,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import {
  IconBriefcase,
  IconCommand,
  IconCpu,
  IconFolderOpen,
  IconHelpCircle,
  IconListCheck,
  IconSearch,
  IconSettings,
  IconSparkles
} from "@tabler/icons-react";
import type { TaskResponse, TaskStatus } from "@diplomat/shared";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { displayTaskMessage } from "../lib/taskMessages";
import { useProjectQuery } from "../queries/projectQueries";
import { isTaskActive, useTasksQuery } from "../queries/taskQueries";
import { useWorkerHealthQuery } from "../queries/workerQueries";
import { useUiStore, type AppPage, type EditorWorkspace, type InspectorMode } from "../state/uiStore";
import { getUiV2FeatureFlag } from "./featureFlags";
import { workstationSurfaces } from "./theme";

type AppShellLayoutProps = {
  children: ReactNode;
};

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const { t } = useTranslation();
  const currentPage = useUiStore((state) => state.currentPage);
  const activeProjectId = useUiStore((state) => state.activeProjectId);
  const editorWorkspace = useUiStore((state) => state.editorWorkspace);
  const setPage = useUiStore((state) => state.setPage);
  const setEditorWorkspace = useUiStore((state) => state.setEditorWorkspace);
  const setInspectorMode = useUiStore((state) => state.setInspectorMode);
  const setSettingsCategory = useUiStore((state) => state.setSettingsCategory);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const activeProject = useProjectQuery(activeProjectId);
  const activeProjectHasMedia = Boolean(
    activeProject.data?.sourceVideoPath || (activeProject.data?.mediaAssets?.length ?? 0) > 0
  );
  const currentPageLabel = pageStatusLabel(currentPage, t);
  const projectContextLabel = activeProjectId
    ? activeProject.data && !activeProjectHasMedia
      ? t("workbench.noSourceVideo")
      : t(`editorWorkspaces.${editorWorkspace}`)
    : t("workbench.noProject");
  const uiV2FeatureFlag = getUiV2FeatureFlag();
  const workerHealth = useWorkerHealthQuery();
  const runtimeReady = workerHealth.data?.status === "ok";
  const runtimeStatus = workerHealth.isLoading
    ? "checking"
    : runtimeReady
      ? "ready"
      : "offline";
  const runtimeStatusText = `${t("appShell.localRuntime")} · ${t(`appShell.runtime.${runtimeStatus}`)}`;
  const runtimeStatusColor = runtimeStatus === "ready" ? "teal" : runtimeStatus === "offline" ? "red" : "gray";
  const showProjectLibraryNavigation = currentPage !== "projects";
  const showWorkbenchNavigation = Boolean(activeProjectId) && currentPage !== "workbench";
  const showContextNavigation = showProjectLibraryNavigation || showWorkbenchNavigation;
  const showProjectWorkspaceNavigation =
    Boolean(activeProjectId) && currentPage === "workbench" && activeProjectHasMedia;

  function selectWorkspace(workspace: EditorWorkspace) {
    setEditorWorkspace(workspace);
    setInspectorMode(workspaceInspectorModes[workspace]);
    setPage("workbench");
  }

  function openRuntimeSettings() {
    setSettingsCategory("runtime");
    setPage("settings");
  }

  useEffect(() => {
    function openCommandPalette(event: KeyboardEvent) {
      const isCommandShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p";

      if (!isCommandShortcut) {
        return;
      }

      event.preventDefault();
      setCommandOpen(true);
    }

    document.addEventListener("keydown", openCommandPalette);
    return () => document.removeEventListener("keydown", openCommandPalette);
  }, [setCommandOpen]);

  return (
    <AppShell
      data-testid="diplomat-ui-shell"
      data-ui-version="v2"
      data-feature-ui-v2={uiV2FeatureFlag.enabled ? "enabled" : "disabled"}
      data-feature-ui-v2-source={uiV2FeatureFlag.source}
      header={{ height: 44 }}
      footer={{ height: 24 }}
      padding={0}
      styles={{
        root: { minHeight: "100vh", background: workstationSurfaces.app },
        header: {
          background: workstationSurfaces.header,
          borderBottom: `1px solid ${workstationSurfaces.outline}`
        },
        main: {
          minHeight: "100vh",
          background: workstationSurfaces.app,
          paddingTop: 44,
          paddingBottom: 24
        },
        footer: {
          background: workstationSurfaces.header,
          borderTop: `1px solid ${workstationSurfaces.outline}`
        }
      }}
    >
      <AppShell.Header>
        <Group
          h="100%"
          px="sm"
          justify="flex-start"
          wrap="nowrap"
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <Group gap="sm" wrap="nowrap" miw={0} style={{ flex: "0 0 auto" }}>
            <Text size="lg" fw={900} c={workstationSurfaces.text} lh={1}>
              {t("app.name")}
            </Text>
            <Text size="xs" fw={700} c={workstationSurfaces.textMuted} truncate>
              {currentPageLabel}
            </Text>
          </Group>
          {showContextNavigation ? (
            <>
              <Divider orientation="vertical" color={workstationSurfaces.outline} />
              <Group role="navigation" aria-label={t("appShell.contextNavigation")} gap={4} wrap="nowrap">
                {showProjectLibraryNavigation ? (
                  <Button
                    color="gray"
                    leftSection={<IconFolderOpen size={15} stroke={1.8} aria-hidden="true" />}
                    radius="sm"
                    size="compact-xs"
                    variant="subtle"
                    onClick={() => setPage("projects")}
                  >
                    {t("nav.projectLibrary")}
                  </Button>
                ) : null}
                {showWorkbenchNavigation ? (
                  <Button
                    color="teal"
                    leftSection={<IconBriefcase size={15} stroke={1.8} aria-hidden="true" />}
                    radius="sm"
                    size="compact-xs"
                    variant="light"
                    onClick={() => setPage("workbench")}
                  >
                    {t("nav.projectEditor")}
                  </Button>
                ) : null}
              </Group>
            </>
          ) : null}
          {showProjectWorkspaceNavigation ? (
            <>
              <Divider orientation="vertical" color={workstationSurfaces.outline} />
              <Group role="navigation" aria-label={t("appShell.projectWorkspacesNav")} gap={4} wrap="nowrap">
                {projectWorkspaceItems.map(({ workspace, key }) => {
                  const label = t(key);
                  const active = editorWorkspace === workspace;

                  return (
                    <Button
                      key={workspace}
                      aria-current={active ? "page" : undefined}
                      color={active ? "teal" : "gray"}
                      radius="sm"
                      size="compact-xs"
                      variant={active ? "light" : "subtle"}
                      onClick={() => selectWorkspace(workspace)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </Group>
            </>
          ) : null}
          <Group gap="sm" wrap="nowrap" style={{ flex: "0 0 auto", marginLeft: "auto" }}>
            <Group role="navigation" aria-label={t("appShell.systemUtilities")} gap={4} wrap="nowrap">
              <Tooltip label={t("commandPalette.open")} openDelay={400}>
                <ActionIcon
                  aria-label={t("commandPalette.open")}
                  color="gray"
                  radius="sm"
                  size={28}
                  variant="subtle"
                  onClick={() => setCommandOpen(true)}
                >
                  <IconCommand size={17} stroke={1.8} aria-hidden="true" />
                </ActionIcon>
              </Tooltip>
              {systemUtilityItems.map(({ page, key, icon: Icon }) => {
                const label = t(key);
                const active = currentPage === page;

                return (
                  <Tooltip key={page} label={label} openDelay={400}>
                    <ActionIcon
                      aria-current={active ? "page" : undefined}
                      aria-label={label}
                      color={active ? "teal" : "gray"}
                      radius="sm"
                      size={28}
                      variant={active ? "light" : "subtle"}
                      onClick={() => setPage(page)}
                    >
                      <Icon size={17} stroke={1.8} aria-hidden="true" />
                    </ActionIcon>
                  </Tooltip>
                );
              })}
            </Group>
            <Divider orientation="vertical" color={workstationSurfaces.outline} />
            <GlobalTaskPopover onOpenTasks={() => setPage("tasks")} />
            <Button
              type="button"
              aria-label={t("appShell.openRuntimeSettings")}
              color={runtimeStatusColor}
              radius="sm"
              size="compact-xs"
              variant="light"
              onClick={openRuntimeSettings}
            >
              {runtimeStatusText}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <GlobalCommandPalette />

      <AppShell.Main>
        <Box p="lg" style={{ minWidth: 0, maxWidth: "100%" }}>
          {children}
        </Box>
      </AppShell.Main>

      <AppShell.Footer role="contentinfo" aria-label={t("appShell.statusBar")}>
        <Group h="100%" px="sm" gap="md" wrap="nowrap">
          <Text size="xs" fw={700} c={workstationSurfaces.textMuted}>
            {currentPageLabel}
          </Text>
          <Text size="xs" fw={700} c={workstationSurfaces.textMuted}>
            {projectContextLabel}
          </Text>
          <Button
            type="button"
            aria-label={t("appShell.openRuntimeSettings")}
            color={runtimeStatusColor}
            radius="sm"
            size="compact-xs"
            variant="subtle"
            onClick={openRuntimeSettings}
            style={{ marginLeft: "auto" }}
          >
            {runtimeStatusText}
          </Button>
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}

function pageStatusLabel(page: AppPage, t: TFunction) {
  if (page === "projects") {
    return t("nav.projectLibrary");
  }
  if (page === "workbench") {
    return t("nav.projectEditor");
  }
  if (page === "settings") {
    return t("settings.title");
  }
  if (page === "help") {
    return t("help.title");
  }
  return t("tasks.title");
}

type CommandItem = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  icon: ReactNode;
  disabled?: boolean;
  run: () => void;
};

function GlobalCommandPalette() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const opened = useUiStore((state) => state.commandOpen);
  const activeProjectId = useUiStore((state) => state.activeProjectId);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const setPage = useUiStore((state) => state.setPage);
  const setSettingsCategory = useUiStore((state) => state.setSettingsCategory);

  useEffect(() => {
    if (!opened) {
      setQuery("");
    }
  }, [opened]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: "projects",
        label: t("nav.projectLibrary"),
        description: t("commandPalette.commands.projects.description"),
        keywords: "project library projects home",
        icon: <IconFolderOpen size={16} stroke={1.8} aria-hidden="true" />,
        run: () => setPage("projects")
      },
      {
        id: "workbench",
        label: t("nav.projectEditor"),
        description: activeProjectId
          ? t("commandPalette.commands.workbench.description")
          : t("commandPalette.commands.workbench.disabledDescription"),
        keywords: "workbench editor timeline import video media",
        icon: <IconBriefcase size={16} stroke={1.8} aria-hidden="true" />,
        disabled: !activeProjectId,
        run: () => setPage("workbench")
      },
      {
        id: "tasks",
        label: t("nav.taskQueue"),
        description: t("commandPalette.commands.tasks.description"),
        keywords: "tasks queue jobs background progress",
        icon: <IconListCheck size={16} stroke={1.8} aria-hidden="true" />,
        run: () => setPage("tasks")
      },
      {
        id: "models",
        label: t("settings.categories.models"),
        description: t("commandPalette.commands.models.description"),
        keywords: "models model asr translation download install system settings",
        icon: <IconSparkles size={16} stroke={1.8} aria-hidden="true" />,
        run: () => {
          setSettingsCategory("models");
          setPage("settings");
        }
      },
      {
        id: "runtime",
        label: t("settings.categories.runtime"),
        description: t("commandPalette.commands.runtime.description"),
        keywords: "runtime worker local endpoint ffmpeg system settings",
        icon: <IconCpu size={16} stroke={1.8} aria-hidden="true" />,
        run: () => {
          setSettingsCategory("runtime");
          setPage("settings");
        }
      },
      {
        id: "help",
        label: t("nav.help"),
        description: t("commandPalette.commands.help.description"),
        keywords: "help guide docs documentation support",
        icon: <IconHelpCircle size={16} stroke={1.8} aria-hidden="true" />,
        run: () => setPage("help")
      },
      {
        id: "settings",
        label: t("nav.settings"),
        description: t("commandPalette.commands.settings.description"),
        keywords: "settings system preferences user configuration",
        icon: <IconSettings size={16} stroke={1.8} aria-hidden="true" />,
        run: () => {
          setSettingsCategory("language");
          setPage("settings");
        }
      }
    ],
    [activeProjectId, setPage, setSettingsCategory, t]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredCommands = commands.filter((command) =>
    `${command.label} ${command.description} ${command.keywords}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );

  function closePalette() {
    setCommandOpen(false);
  }

  function runCommand(command: CommandItem) {
    if (command.disabled) {
      return;
    }

    command.run();
    closePalette();
  }

  return (
    <Modal
      opened={opened}
      onClose={closePalette}
      title={t("commandPalette.title")}
      centered
      radius="md"
      size="lg"
      overlayProps={{ backgroundOpacity: 0.28, blur: 2 }}
      transitionProps={{ duration: 0 }}
      styles={{
        content: {
          border: `1px solid ${workstationSurfaces.outline}`,
          background: workstationSurfaces.panel
        },
        header: {
          background: workstationSurfaces.panel,
          borderBottom: `1px solid ${workstationSurfaces.outline}`
        },
        title: {
          color: workstationSurfaces.text,
          fontWeight: 800
        }
      }}
    >
      <Stack gap="sm">
        <TextInput
          autoFocus
          label={t("commandPalette.search")}
          leftSection={<IconSearch size={16} stroke={1.8} aria-hidden="true" />}
          placeholder={t("commandPalette.placeholder")}
          radius="sm"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Group justify="space-between" gap="xs">
          <Text size="xs" c={workstationSurfaces.textMuted}>
            {t("commandPalette.hint")}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Kbd>Ctrl</Kbd>
            <Kbd>Shift</Kbd>
            <Kbd>P</Kbd>
          </Group>
        </Group>
        <Stack gap={4}>
          {filteredCommands.length > 0 ? (
            filteredCommands.map((command) => (
              <Button
                key={command.id}
                aria-label={command.label}
                color={command.disabled ? "gray" : "teal"}
                disabled={command.disabled}
                fullWidth
                justify="flex-start"
                leftSection={command.icon}
                radius="sm"
                size="md"
                variant="subtle"
                onClick={() => runCommand(command)}
                styles={{
                  root: {
                    height: "auto",
                    minHeight: 48,
                    paddingTop: 8,
                    paddingBottom: 8
                  },
                  inner: {
                    justifyContent: "flex-start"
                  },
                  label: {
                    width: "100%"
                  }
                }}
              >
                <Stack gap={2} align="flex-start" miw={0}>
                  <Text fw={800} size="sm" c={workstationSurfaces.text}>
                    {command.label}
                  </Text>
                  <Text size="xs" c={workstationSurfaces.textMuted}>
                    {command.description}
                  </Text>
                </Stack>
              </Button>
            ))
          ) : (
            <Box
              p="sm"
              bg={workstationSurfaces.panelAlt}
              style={{
                border: `1px solid ${workstationSurfaces.outline}`,
                borderRadius: 6
              }}
            >
              <Text size="sm" c={workstationSurfaces.textMuted}>
                {t("commandPalette.empty")}
              </Text>
            </Box>
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}

function GlobalTaskPopover({ onOpenTasks }: { onOpenTasks: () => void }) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const tasksQuery = useTasksQuery();
  const tasks = tasksQuery.data?.tasks ?? [];
  const activeTasks = tasks.filter((task) => isTaskActive(task));
  const failedTasks = tasks.filter((task) => task.status === "failed");
  const previewTasks = [
    ...activeTasks,
    ...failedTasks,
    ...tasks.filter((task) => !isTaskActive(task) && task.status !== "failed")
  ].slice(0, 4);
  const activeCount = activeTasks.length;
  const attentionCount = activeCount > 0 ? activeCount : failedTasks.length;
  const buttonColor = failedTasks.length > 0 ? "red" : activeCount > 0 ? "teal" : "gray";

  return (
    <Popover
      width={360}
      position="bottom-end"
      shadow="lg"
      withinPortal
      hideDetached={false}
      transitionProps={{ duration: 0 }}
      opened={opened}
      onChange={setOpened}
    >
      <Popover.Target>
        <Button
          type="button"
          aria-label={t("nav.taskQueue")}
          color={buttonColor}
          radius="sm"
          size="compact-xs"
          leftSection={<IconListCheck size={15} stroke={1.8} aria-hidden="true" />}
          rightSection={
            attentionCount > 0 ? (
              <Badge
                aria-hidden="true"
                color={buttonColor}
                radius="xl"
                size="xs"
                variant="filled"
                tt="none"
              >
                {attentionCount}
              </Badge>
            ) : null
          }
          variant={activeCount > 0 || failedTasks.length > 0 ? "light" : "subtle"}
          onClick={() => setOpened((current) => !current)}
        >
          {t("nav.taskQueue")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown
        aria-label={t("appShell.backgroundTasksPanel")}
        bg={workstationSurfaces.panel}
        style={{ borderColor: workstationSurfaces.outline }}
      >
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={800} size="sm">
              {t("appShell.backgroundTasks")}
            </Text>
            {tasksQuery.isFetching ? (
              <Badge color="teal" radius="sm" size="xs" variant="light">
                {t("appShell.tasksUpdating")}
              </Badge>
            ) : null}
          </Group>
          {tasksQuery.isError ? (
            <Text size="sm" c="red">
              {t("appShell.tasksUnavailable")}
            </Text>
          ) : null}
          {previewTasks.length > 0 ? (
            <Stack gap="xs">
              {previewTasks.map((task) => (
                <TaskPreviewCard key={task.taskId} task={task} />
              ))}
            </Stack>
          ) : (
            <Box
              p="sm"
              bg={workstationSurfaces.panelAlt}
              style={{
                border: `1px solid ${workstationSurfaces.outline}`,
                borderRadius: 6
              }}
            >
              <Text size="sm" c={workstationSurfaces.textMuted}>
                {t("appShell.noBackgroundTasks")}
              </Text>
            </Box>
          )}
          <Button
            fullWidth
            color="teal"
            radius="sm"
            size="xs"
            variant="light"
            onClick={() => {
              setOpened(false);
              onOpenTasks();
            }}
          >
            {t("appShell.openTaskQueue")}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function TaskPreviewCard({ task }: { task: TaskResponse }) {
  const { t } = useTranslation();
  const progress = Math.round(task.progress * 100);
  const displayMessage = displayTaskMessage(task.message, t);

  return (
    <Box
      p="sm"
      bg={workstationSurfaces.panelAlt}
      style={{
        border: `1px solid ${workstationSurfaces.outline}`,
        borderRadius: 6
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2} miw={0}>
            <Text fw={800} size="sm" truncate>
              {t(`tasks.types.${task.type}`)}
            </Text>
            <Text size="xs" c={workstationSurfaces.textMuted} truncate>
              {displayMessage}
            </Text>
          </Stack>
          <Badge color={statusColor(task.status)} radius="sm" size="xs" variant="light">
            {t(`status.${task.status}`)}
          </Badge>
        </Group>
        <Group gap="xs" wrap="nowrap" align="center">
          <Progress value={progress} color="teal" radius="xs" size="xs" style={{ flex: 1 }} />
          <Text size="xs" c={workstationSurfaces.textMuted} w={34} ta="right">
            {formatProgress(task.progress)}
          </Text>
        </Group>
      </Stack>
    </Box>
  );
}

function statusColor(status: TaskStatus) {
  if (status === "running") {
    return "blue";
  }
  if (status === "queued" || status === "canceling") {
    return "teal";
  }
  if (status === "failed") {
    return "red";
  }
  if (status === "canceled") {
    return "orange";
  }
  return "gray";
}

function formatProgress(progress: number) {
  return `${Math.round(progress * 100)}%`;
}

const systemUtilityItems: Array<{
  page: Extract<AppPage, "settings" | "help">;
  key: string;
  icon: typeof IconSettings;
}> = [
  { page: "settings", key: "nav.settings", icon: IconSettings },
  { page: "help", key: "nav.help", icon: IconHelpCircle }
];

const projectWorkspaceItems: Array<{ workspace: EditorWorkspace; key: string }> = [
  { workspace: "transcription", key: "editorWorkspaces.transcription" },
  { workspace: "translation", key: "editorWorkspaces.translation" },
  { workspace: "timing", key: "editorWorkspaces.timing" },
  { workspace: "style", key: "editorWorkspaces.style" },
  { workspace: "delivery", key: "editorWorkspaces.delivery" }
];

const workspaceInspectorModes: Record<EditorWorkspace, InspectorMode> = {
  transcription: "analysis",
  translation: "translation",
  timing: "line",
  style: "style",
  delivery: "export"
};
