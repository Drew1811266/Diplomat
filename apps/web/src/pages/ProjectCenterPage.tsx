import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import {
  IconArchive,
  IconDotsVertical,
  IconFolderOpen,
  IconPlus,
  IconSearch,
  IconTrash
} from "@tabler/icons-react";
import type { ProjectResponse, ProjectStatus } from "@diplomat/shared";
import { useEffect, useState, type ReactNode, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { workstationSurfaces } from "../app/theme";
import { TaskStatusSurface } from "../components/TaskStatusSurface";
import { isDesktopRuntime, openPathInFileManager, pickProjectBackupFile } from "../desktop";
import { displayRuntimeErrorMessage } from "../lib/runtimeMessages";
import {
  useBackupProjectMutation,
  useCleanupProjectCacheMutation,
  useCleanupProjectExportsMutation,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useImportProjectMutation,
  useProjectsQuery
} from "../queries/projectQueries";
import { useUiStore } from "../state/uiStore";

type ProjectCenterPageProps = {
  onOpenProject: (projectId: string) => void;
};

type StatusFilter = ProjectStatus | "all";

const PROJECT_STATUSES: ProjectStatus[] = [
  "not_transcribed",
  "transcribed",
  "translated",
  "dirty_draft",
  "exported",
  "failed",
  "corrupted",
  "migration_failed"
];
const projectVirtualizedRowThreshold = 120;
const projectVirtualizedWindowSize = 80;
const projectVirtualizedRowHeight = 132;

function ProjectCardMeta({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Stack gap={2} style={{ minWidth: 104 }}>
      <Text size="xs" fw={800} c="dimmed">
        {label}
      </Text>
      <Box>{children}</Box>
    </Stack>
  );
}

function formatDuration(durationMs: number | null | undefined) {
  if (!durationMs || durationMs <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function formatUpdatedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatLanguagePair(project: ProjectResponse) {
  return project.targetLanguage
    ? `${project.sourceLanguage} -> ${project.targetLanguage}`
    : project.sourceLanguage;
}

function normalizeLanguageCode(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 ? trimmed : fallback;
}

function fileNameFromPath(path: string) {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

function projectMatchesSearch(project: ProjectResponse, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    project.projectId,
    project.name,
    project.sourceLanguage,
    project.targetLanguage ?? ""
  ].some((value) => value.toLowerCase().includes(normalized));
}

function statusBadgeColor(status: ProjectStatus) {
  if (status === "failed" || status === "corrupted" || status === "migration_failed") {
    return "red";
  }
  if (status === "exported" || status === "translated") {
    return "teal";
  }
  if (status === "dirty_draft") {
    return "orange";
  }
  return "gray";
}

export function ProjectCenterPage({ onOpenProject }: ProjectCenterPageProps) {
  const { t } = useTranslation();
  const projects = useProjectsQuery();
  const createProject = useCreateProjectMutation();
  const projectDefaults = useUiStore((state) => state.projectDefaults);
  const cleanupCache = useCleanupProjectCacheMutation();
  const cleanupExports = useCleanupProjectExportsMutation();
  const backupProject = useBackupProjectMutation();
  const importProject = useImportProjectMutation();
  const deleteProject = useDeleteProjectMutation();
  const defaultProjectName = t("projectCenter.untitledProject");
  const [creationOpen, setCreationOpen] = useState(false);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupPackagePath, setBackupPackagePath] = useState("");
  const [restoreName, setRestoreName] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null);
  const [deleteFiles, setDeleteFiles] = useState(true);
  const [projectWindowStartIndex, setProjectWindowStartIndex] = useState(0);
  const desktopBackupPickerAvailable = isDesktopRuntime();
  const recentProjects = projects.data?.projects ?? [];
  const filteredProjects = recentProjects.filter(
    (project) =>
      projectMatchesSearch(project, searchQuery) &&
      (statusFilter === "all" || project.diagnostics.status === statusFilter)
  );
  const shouldVirtualizeProjects = filteredProjects.length > projectVirtualizedRowThreshold;
  const projectWindowSize = shouldVirtualizeProjects
    ? projectVirtualizedWindowSize
    : filteredProjects.length;
  const safeProjectWindowStartIndex = shouldVirtualizeProjects
    ? Math.min(projectWindowStartIndex, Math.max(0, filteredProjects.length - projectWindowSize))
    : 0;
  const renderedProjects = shouldVirtualizeProjects
    ? filteredProjects.slice(
        safeProjectWindowStartIndex,
        safeProjectWindowStartIndex + projectWindowSize
      )
    : filteredProjects;
  const topProjectSpacerHeight = shouldVirtualizeProjects
    ? safeProjectWindowStartIndex * projectVirtualizedRowHeight
    : 0;
  const bottomProjectSpacerHeight = shouldVirtualizeProjects
    ? Math.max(0, filteredProjects.length - safeProjectWindowStartIndex - renderedProjects.length) *
      projectVirtualizedRowHeight
    : 0;
  const maintenancePending =
    cleanupCache.isPending ||
    cleanupExports.isPending ||
    backupProject.isPending ||
    importProject.isPending ||
    deleteProject.isPending;
  const statusError =
    creationError ??
    displayRuntimeErrorMessage(createProject.error, t("projectCenter.errors.createFailed")) ??
    displayRuntimeErrorMessage(cleanupCache.error, t("projectCenter.errors.maintenanceFailed")) ??
    displayRuntimeErrorMessage(cleanupExports.error, t("projectCenter.errors.maintenanceFailed")) ??
    displayRuntimeErrorMessage(backupProject.error, t("projectCenter.errors.maintenanceFailed")) ??
    displayRuntimeErrorMessage(importProject.error, t("projectCenter.errors.backupImportFailed")) ??
    displayRuntimeErrorMessage(deleteProject.error, t("projectCenter.errors.maintenanceFailed")) ??
    displayRuntimeErrorMessage(projects.error, t("projectCenter.errors.projectListFailed"));
  const statusMessage = createProject.isPending
    ? t("projectCenter.creatingProject")
    : maintenanceMessage;
  const statusBusy = projects.isLoading || createProject.isPending || maintenancePending;
  const showStatusSurface = statusBusy || Boolean(statusMessage || statusError);
  const statusOptions = [
    { value: "all", label: t("projectCenter.statusAll") },
    ...PROJECT_STATUSES.map((status) => ({
      value: status,
      label: t(`projectCenter.statuses.${status}`)
    }))
  ];

  useEffect(() => {
    setProjectWindowStartIndex(0);
  }, [searchQuery, statusFilter, recentProjects.length]);

  function handleProjectListScroll(event: UIEvent<HTMLDivElement>) {
    if (!shouldVirtualizeProjects) {
      return;
    }

    const nextStartIndex = Math.max(
      0,
      Math.floor(event.currentTarget.scrollTop / projectVirtualizedRowHeight)
    );
    if (nextStartIndex !== projectWindowStartIndex) {
      setProjectWindowStartIndex(nextStartIndex);
    }
  }

  function clearCreationFeedback() {
    setCreationError(null);
    setMaintenanceMessage(null);
    if (!createProject.isPending) {
      createProject.reset();
    }
  }

  function openCreationPanel() {
    setCreationOpen(true);
    clearCreationFeedback();
  }

  function openBackupImportDialog() {
    setBackupModalOpen(true);
    setMaintenanceMessage(null);
    if (!importProject.isPending) {
      importProject.reset();
    }
  }

  async function handleCreateProject() {
    setCreationOpen(true);
    clearCreationFeedback();

    const trimmedName = projectName.trim() || defaultProjectName;

    try {
      const project = await createProject.mutateAsync({
        name: trimmedName,
        sourceLanguage: normalizeLanguageCode(projectDefaults.sourceLanguage, "zh"),
        targetLanguage: normalizeLanguageCode(projectDefaults.targetLanguage, "en")
      });
      onOpenProject(project.projectId);
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleCleanupCache(project: ProjectResponse) {
    setMaintenanceMessage(null);
    try {
      const result = await cleanupCache.mutateAsync(project.projectId);
      setMaintenanceMessage(result.message);
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function handleCleanupExports(project: ProjectResponse) {
    setMaintenanceMessage(null);
    try {
      const result = await cleanupExports.mutateAsync(project.projectId);
      setMaintenanceMessage(result.message);
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function handleBackupProject(project: ProjectResponse) {
    setMaintenanceMessage(null);
    try {
      const result = await backupProject.mutateAsync(project.projectId);
      setMaintenanceMessage(
        `${t("projectCenter.backupPackagePath")}: ${result.packagePath}`
      );
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function handleImportBackup() {
    setMaintenanceMessage(null);
    try {
      const project = await importProject.mutateAsync({
        packagePath: backupPackagePath.trim(),
        restoreName: restoreName.trim() || null
      });
      setBackupModalOpen(false);
      onOpenProject(project.projectId);
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function handlePickBackupPackage() {
    const selected = await pickProjectBackupFile();
    if (selected) {
      setBackupPackagePath(selected);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setMaintenanceMessage(null);
    try {
      const result = await deleteProject.mutateAsync({
        projectId: deleteTarget.projectId,
        deleteFiles
      });
      setMaintenanceMessage(result.message);
      setDeleteTarget(null);
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  return (
    <>
      <Modal
        opened={Boolean(deleteTarget)}
        title={t("projectCenter.deleteProject")}
        onClose={() => setDeleteTarget(null)}
        centered
      >
        {deleteTarget ? (
          <Stack gap="sm">
            <Text size="sm">
              {t("projectCenter.deleteConfirmationBody", { name: deleteTarget.name })}
            </Text>
            <Checkbox
              label={t("projectCenter.deleteFiles")}
              checked={deleteFiles}
              onChange={(event) => setDeleteFiles(event.currentTarget.checked)}
            />
            <Group justify="flex-end" gap="xs">
              <Button type="button" variant="default" onClick={() => setDeleteTarget(null)}>
                {t("actions.cancel")}
              </Button>
              <Button
                type="button"
                color="red"
                leftSection={<IconTrash size={16} />}
                loading={deleteProject.isPending}
                onClick={() => void handleConfirmDelete()}
              >
                {t("projectCenter.confirmDelete")}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={backupModalOpen}
        title={t("projectCenter.importBackup")}
        onClose={() => setBackupModalOpen(false)}
        centered
      >
        <Stack gap="sm">
          {desktopBackupPickerAvailable ? (
            <Box
              p="sm"
              bg={workstationSurfaces.panelAlt}
              style={{
                border: `1px solid ${workstationSurfaces.outline}`,
                borderRadius: 6
              }}
            >
              <Group justify="space-between" align="center" gap="sm">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fw={800} size="sm">
                    {backupPackagePath
                      ? fileNameFromPath(backupPackagePath)
                      : t("projectCenter.noBackupPackageSelected")}
                  </Text>
                  {backupPackagePath ? (
                    <Text size="xs" c="dimmed" truncate title={backupPackagePath}>
                      {backupPackagePath}
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">
                      {t("projectCenter.chooseBackupHint")}
                    </Text>
                  )}
                </Stack>
                <Button
                  type="button"
                  variant="default"
                  disabled={importProject.isPending}
                  onClick={() => void handlePickBackupPackage()}
                >
                  {t("projectCenter.chooseBackupPackage")}
                </Button>
              </Group>
            </Box>
          ) : (
            <TextInput
              label={t("projectCenter.backupPackagePath")}
              value={backupPackagePath}
              placeholder="D:/backups/project.diplomat-project.zip"
              onChange={(event) => setBackupPackagePath(event.currentTarget.value)}
            />
          )}
          <TextInput
            label={t("projectCenter.restoreName")}
            value={restoreName}
            onChange={(event) => setRestoreName(event.currentTarget.value)}
          />
          <Group justify="flex-end" gap="xs">
            <Button
              type="button"
              variant="default"
              disabled={importProject.isPending}
              onClick={() => setBackupModalOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              leftSection={<IconArchive size={16} />}
              disabled={!backupPackagePath.trim()}
              loading={importProject.isPending}
              onClick={() => void handleImportBackup()}
            >
              {t("projectCenter.importBackup")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={creationOpen}
        title={t("projectCenter.creationTitle")}
        onClose={() => setCreationOpen(false)}
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t("projectCenter.creationNameOnlyHint")}
          </Text>
          <TextInput
            label={t("fields.projectName")}
            value={projectName}
            disabled={createProject.isPending}
            onChange={(event) => {
              clearCreationFeedback();
              setProjectName(event.currentTarget.value);
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button
              type="button"
              variant="default"
              disabled={createProject.isPending}
              onClick={() => setCreationOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              leftSection={<IconPlus size={16} />}
              loading={createProject.isPending}
              onClick={() => void handleCreateProject()}
            >
              {t("projectCenter.createProject")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Stack
        gap={0}
        h="calc(100vh - 68px)"
        mih={620}
        data-testid="project-library-browser"
        style={{
          overflow: "hidden",
          border: `1px solid ${workstationSurfaces.outline}`,
          borderRadius: 6,
          background: workstationSurfaces.panel
        }}
      >
        <Box
          component="section"
          role="region"
          aria-label={t("projectCenter.startupRegion")}
          px="md"
          py="sm"
          style={{
            borderBottom: `1px solid ${workstationSurfaces.outline}`,
            background: workstationSurfaces.panel
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between" align="center" gap="md" wrap="wrap">
              <Title order={1} size="h3" textWrap="nowrap">
                {t("projectCenter.title")}
              </Title>
              <Group gap="xs" wrap="nowrap">
                <Button
                  type="button"
                  leftSection={<IconPlus size={16} />}
                  variant="filled"
                  size="xs"
                  loading={createProject.isPending}
                  onClick={openCreationPanel}
                >
                  {t("projectCenter.newProject")}
                </Button>
                <Menu shadow="md" width={220} withinPortal={false}>
                  <Menu.Target>
                    <ActionIcon
                      type="button"
                      aria-label={t("projectCenter.projectLibraryActions")}
                      variant="default"
                      size={30}
                    >
                      <IconDotsVertical size={16} aria-hidden="true" />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconArchive size={14} aria-hidden="true" />}
                      disabled={importProject.isPending}
                      onClick={openBackupImportDialog}
                    >
                      {t("projectCenter.importBackup")}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>

            <Group gap="xs" align="flex-end" wrap="wrap">
              <TextInput
                aria-label={t("projectCenter.search")}
                placeholder={t("projectCenter.searchPlaceholder")}
                value={searchQuery}
                leftSection={<IconSearch size={16} aria-hidden="true" />}
                size="xs"
                style={{ flex: "1 1 320px", maxWidth: 560 }}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
              />
              <NativeSelect
                aria-label={t("projectCenter.statusFilter")}
                data={statusOptions}
                value={statusFilter}
                size="xs"
                style={{ width: 176 }}
                onChange={(event) => setStatusFilter(event.currentTarget.value as StatusFilter)}
              />
            </Group>
          </Stack>
        </Box>

        {showStatusSurface ? (
          <Box px="sm" py="xs" style={{ borderBottom: `1px solid ${workstationSurfaces.outline}` }}>
            <TaskStatusSurface
              busy={statusBusy}
              message={statusMessage}
              error={statusError}
            />
          </Box>
        ) : null}

        <Box
          component="section"
          role="region"
          aria-label={t("projectCenter.recentProjectCards")}
          style={{ minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}
        >
          <Group
            justify="space-between"
            h={40}
            px="md"
            wrap="nowrap"
            style={{
              borderBottom: `1px solid ${workstationSurfaces.outline}`,
              background: workstationSurfaces.panelAlt
            }}
          >
            <Text fw={800} size="sm">
              {t("projectCenter.recentProjects")}
            </Text>
            <Text size="xs" fw={700} c="dimmed">
              {shouldVirtualizeProjects
                ? t("projectCenter.visibleProjectCount", {
                    visible: renderedProjects.length,
                    total: filteredProjects.length
                  })
                : t("projectCenter.filteredProjectCount", {
                    visible: filteredProjects.length,
                    total: recentProjects.length
                  })}
            </Text>
          </Group>

            {filteredProjects.length > 0 ? (
              <Box
                w="100%"
                maw="100%"
                onScroll={handleProjectListScroll}
                style={{ overflow: "auto", minHeight: 0, flex: 1 }}
              >
                <Stack gap="xs" p="sm">
                  {topProjectSpacerHeight > 0 ? (
                    <Box aria-hidden="true" style={{ height: topProjectSpacerHeight }} />
                  ) : null}
                  {renderedProjects.map((project) => (
                    <Box
                      key={project.projectId}
                      component="article"
                      data-testid={`project-row-${project.projectId}`}
                      tabIndex={0}
                      title={t("projectCenter.openProjectRowHint", { name: project.name })}
                      p="sm"
                      onDoubleClick={() => onOpenProject(project.projectId)}
                      onKeyDown={(event) => {
                        if (event.currentTarget !== event.target || event.key !== "Enter") {
                          return;
                        }

                        event.preventDefault();
                        onOpenProject(project.projectId);
                      }}
                      style={{
                        minHeight: projectVirtualizedRowHeight - 12,
                        cursor: "pointer",
                        border: `1px solid ${workstationSurfaces.outline}`,
                        borderRadius: 6,
                        background: workstationSurfaces.panel
                      }}
                    >
                      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                        <Stack gap="xs" style={{ minWidth: 0, flex: 1 }}>
                          <Group gap="xs" align="center" wrap="wrap">
                            <Text fw={800} size="md" c={workstationSurfaces.text}>
                              {project.name}
                            </Text>
                            <Badge
                              color={statusBadgeColor(project.diagnostics.status)}
                              variant="light"
                            >
                              {t(`projectCenter.statuses.${project.diagnostics.status}`)}
                            </Badge>
                          </Group>

                          {project.diagnostics.warnings.length > 0 ? (
                            <Text size="xs" c="red">
                              {project.diagnostics.warnings
                                .map((warning) => warning.message)
                                .join("; ")}
                            </Text>
                          ) : null}

                          <Group gap="lg" align="flex-start" wrap="wrap">
                            <ProjectCardMeta label={t("projectCenter.cards.languages")}>
                              <Text size="sm" fw={650}>
                                {formatLanguagePair(project)}
                              </Text>
                            </ProjectCardMeta>
                            <ProjectCardMeta label={t("projectCenter.cards.subtitles")}>
                              <Badge
                                color={project.hasSubtitleDocument ? "teal" : "gray"}
                                variant="light"
                              >
                                {project.hasSubtitleDocument
                                  ? t("status.ready")
                                  : t("workbench.noDocument")}
                              </Badge>
                            </ProjectCardMeta>
                            <ProjectCardMeta label={t("projectCenter.cards.duration")}>
                              <Text size="sm">{formatDuration(project.durationMs)}</Text>
                            </ProjectCardMeta>
                            <ProjectCardMeta label={t("projectCenter.cards.updated")}>
                              <Text size="sm">{formatUpdatedAt(project.updatedAt)}</Text>
                            </ProjectCardMeta>
                            <ProjectCardMeta label={t("projectCenter.cards.diskUsage")}>
                              <Text size="sm">
                                {formatBytes(project.diagnostics.diskUsageBytes)}
                              </Text>
                            </ProjectCardMeta>
                          </Group>
                        </Stack>

                        <Group
                          gap={4}
                          wrap="nowrap"
                          onDoubleClick={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconFolderOpen size={16} />}
                            onClick={() => onOpenProject(project.projectId)}
                          >
                            {t("actions.open")}
                          </Button>
                          <Menu shadow="md" width={220} withinPortal={false}>
                            <Menu.Target>
                              <ActionIcon
                                variant="subtle"
                                aria-label={t("projectCenter.actionsFor", {
                                  name: project.name
                                })}
                              >
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                onClick={() => void openPathInFileManager(project.projectDir)}
                              >
                                {t("projectCenter.openProjectFolder")}
                              </Menu.Item>
                              <Menu.Item
                                onClick={() =>
                                  void openPathInFileManager(project.diagnostics.exportsDir)
                                }
                              >
                                {t("projectCenter.openExportsFolder")}
                              </Menu.Item>
                              <Menu.Item
                                onClick={() =>
                                  void openPathInFileManager(project.diagnostics.logsDir)
                                }
                              >
                                {t("projectCenter.openLogsFolder")}
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item onClick={() => void handleCleanupCache(project)}>
                                {t("projectCenter.cleanCache")}
                              </Menu.Item>
                              <Menu.Item onClick={() => void handleCleanupExports(project)}>
                                {t("projectCenter.cleanExports")}
                              </Menu.Item>
                              <Menu.Item onClick={() => void handleBackupProject(project)}>
                                {t("projectCenter.backupProject")}
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => {
                                  setDeleteFiles(true);
                                  setDeleteTarget(project);
                                }}
                              >
                                {t("projectCenter.deleteProject")}
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Group>
                    </Box>
                  ))}
                  {bottomProjectSpacerHeight > 0 ? (
                    <Box aria-hidden="true" style={{ height: bottomProjectSpacerHeight }} />
                  ) : null}
                </Stack>
              </Box>
            ) : projects.isLoading || projects.isError ? null : recentProjects.length > 0 ? (
              <Stack gap={2} py="xl" align="center">
                <Text fw={700}>{t("projectCenter.noFilterMatches")}</Text>
              </Stack>
            ) : (
              <Stack gap="xs" py="xl" align="center">
                <Text fw={700}>{t("projectCenter.noProjects")}</Text>
                <Text size="sm" c="dimmed">
                  {t("projectCenter.noProjectsHint")}
                </Text>
                <Button
                  type="button"
                  mt={4}
                  leftSection={<IconPlus size={16} aria-hidden="true" />}
                  loading={createProject.isPending}
                  onClick={openCreationPanel}
                >
                  {t("projectCenter.createProjectContainer")}
                </Button>
              </Stack>
            )}
        </Box>
      </Stack>
    </>
  );
}
