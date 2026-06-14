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
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import {
  IconArchive,
  IconDotsVertical,
  IconFolderOpen,
  IconPlus,
  IconTrash,
  IconUpload
} from "@tabler/icons-react";
import type { ProjectResponse, ProjectStatus } from "@diplomat/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskStatusSurface } from "../components/TaskStatusSurface";
import { openPathInFileManager, pickVideoFile } from "../desktop";
import {
  useBackupProjectMutation,
  useCleanupProjectCacheMutation,
  useCleanupProjectExportsMutation,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useImportProjectMutation,
  useProjectsQuery
} from "../queries/projectQueries";
import { useWorkerHealthQuery } from "../queries/workerQueries";

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function deriveProjectName(sourceVideoPath: string, fallbackName: string) {
  const filename = sourceVideoPath.split(/[\\/]/).pop()?.trim();
  if (!filename) {
    return fallbackName;
  }

  return filename.replace(/\.[^.]+$/, "") || fallbackName;
}

function isLanguageCodeValid(value: string) {
  return value.length >= 2 && value.length <= 12;
}

function projectMatchesSearch(project: ProjectResponse, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    project.projectId,
    project.name,
    project.sourceVideoPath,
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
  const worker = useWorkerHealthQuery();
  const projects = useProjectsQuery();
  const createProject = useCreateProjectMutation();
  const cleanupCache = useCleanupProjectCacheMutation();
  const cleanupExports = useCleanupProjectExportsMutation();
  const backupProject = useBackupProjectMutation();
  const importProject = useImportProjectMutation();
  const deleteProject = useDeleteProjectMutation();
  const defaultProjectName = t("projectCenter.untitledProject");
  const [creationOpen, setCreationOpen] = useState(false);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [sourceVideoPath, setSourceVideoPath] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("zh");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [creationError, setCreationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [backupPackagePath, setBackupPackagePath] = useState("");
  const [restoreName, setRestoreName] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null);
  const [deleteFiles, setDeleteFiles] = useState(true);
  const recentProjects = projects.data?.projects ?? [];
  const filteredProjects = recentProjects.filter(
    (project) =>
      projectMatchesSearch(project, searchQuery) &&
      (statusFilter === "all" || project.diagnostics.status === statusFilter)
  );
  const workerReady = worker.data?.status === "ok";
  const maintenancePending =
    cleanupCache.isPending ||
    cleanupExports.isPending ||
    backupProject.isPending ||
    importProject.isPending ||
    deleteProject.isPending;
  const statusError =
    creationError ??
    getErrorMessage(createProject.error) ??
    getErrorMessage(cleanupCache.error) ??
    getErrorMessage(cleanupExports.error) ??
    getErrorMessage(backupProject.error) ??
    getErrorMessage(importProject.error) ??
    getErrorMessage(deleteProject.error) ??
    getErrorMessage(worker.error) ??
    getErrorMessage(projects.error);
  const statusOptions = [
    { value: "all", label: t("projectCenter.statusAll") },
    ...PROJECT_STATUSES.map((status) => ({
      value: status,
      label: t(`projectCenter.statuses.${status}`)
    }))
  ];

  function clearCreationFeedback() {
    setCreationError(null);
    setMaintenanceMessage(null);
    if (!createProject.isPending) {
      createProject.reset();
    }
  }

  async function handleImportVideo() {
    setCreationOpen(true);
    clearCreationFeedback();

    const pickedPath = await pickVideoFile();
    if (!pickedPath) {
      return;
    }

    setSourceVideoPath(pickedPath);
    setProjectName((currentName) =>
      currentName.trim() === "" ||
      currentName === defaultProjectName ||
      currentName === "Untitled Project"
        ? deriveProjectName(pickedPath, defaultProjectName)
        : currentName
    );
  }

  async function handleCreateProject() {
    setCreationOpen(true);
    clearCreationFeedback();

    const trimmedName = projectName.trim() || defaultProjectName;
    const trimmedSourceVideoPath = sourceVideoPath.trim();
    const trimmedSourceLanguage = sourceLanguage.trim();
    const trimmedTargetLanguage = targetLanguage.trim();

    if (!trimmedSourceVideoPath) {
      setCreationError(
        t("validation.requiredField", { field: t("fields.sourceVideoPath") })
      );
      return;
    }

    if (!isLanguageCodeValid(trimmedSourceLanguage)) {
      setCreationError(t("validation.languageCodeLength"));
      return;
    }

    if (trimmedTargetLanguage && !isLanguageCodeValid(trimmedTargetLanguage)) {
      setCreationError(t("validation.languageCodeLength"));
      return;
    }

    try {
      const project = await createProject.mutateAsync({
        name: trimmedName,
        sourceVideoPath: trimmedSourceVideoPath,
        sourceLanguage: trimmedSourceLanguage,
        targetLanguage: trimmedTargetLanguage || null
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
      onOpenProject(project.projectId);
    } catch {
      // Mutation state surfaces the failure.
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

      <Stack gap="md" maw={1180}>
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Title order={2}>{t("projectCenter.title")}</Title>
            <Text c="dimmed" size="sm">
              {t("projectCenter.description")}
            </Text>
          </Stack>
          <Badge
            color={workerReady ? "teal" : "gray"}
            variant={workerReady ? "filled" : "light"}
            size="lg"
          >
            {workerReady ? t("projectCenter.workerReady") : t("projectCenter.workerUnavailable")}
          </Badge>
        </Group>

        <TaskStatusSurface
          busy={worker.isLoading || projects.isLoading || createProject.isPending || maintenancePending}
          message={
            createProject.isPending
              ? t("projectCenter.creatingProject")
              : maintenanceMessage ?? (workerReady ? t("projectCenter.workerReady") : null)
          }
          error={statusError}
        />

        <Group gap="sm" align="flex-end">
          <TextInput
            label={t("projectCenter.search")}
            placeholder={t("projectCenter.searchPlaceholder")}
            value={searchQuery}
            style={{ flex: "1 1 260px" }}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
          />
          <NativeSelect
            label={t("projectCenter.statusFilter")}
            data={statusOptions}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.currentTarget.value as StatusFilter)}
          />
          <Button
            type="button"
            leftSection={<IconPlus size={18} />}
            variant="filled"
            loading={createProject.isPending}
            onClick={() => void handleCreateProject()}
          >
            {t("projectCenter.createProject")}
          </Button>
          <Button
            type="button"
            leftSection={<IconUpload size={18} />}
            variant="default"
            disabled={createProject.isPending}
            onClick={() => void handleImportVideo()}
          >
            {t("projectCenter.importVideo")}
          </Button>
        </Group>

        <Paper withBorder radius="md" p="md" bg="#ffffff">
          <Stack gap="sm">
            <Title order={3} size="h5">
              {t("projectCenter.importBackup")}
            </Title>
            <Group grow align="flex-end">
              <TextInput
                label={t("projectCenter.backupPackagePath")}
                value={backupPackagePath}
                placeholder="D:/backups/project.diplomat-project.zip"
                onChange={(event) => setBackupPackagePath(event.currentTarget.value)}
              />
              <TextInput
                label={t("projectCenter.restoreName")}
                value={restoreName}
                onChange={(event) => setRestoreName(event.currentTarget.value)}
              />
              <Button
                type="button"
                leftSection={<IconArchive size={16} />}
                loading={importProject.isPending}
                onClick={() => void handleImportBackup()}
              >
                {t("projectCenter.importBackup")}
              </Button>
            </Group>
          </Stack>
        </Paper>

        {creationOpen ? (
          <Paper withBorder radius="md" p="md" bg="#ffffff">
            <Stack gap="sm">
              <Stack gap={2}>
                <Title order={3} size="h5">
                  {t("projectCenter.creationTitle")}
                </Title>
                <Text size="sm" c="dimmed">
                  {t("projectCenter.importFallbackHint")}
                </Text>
              </Stack>

              <TextInput
                label={t("fields.projectName")}
                value={projectName}
                disabled={createProject.isPending}
                onChange={(event) => {
                  clearCreationFeedback();
                  setProjectName(event.currentTarget.value);
                }}
              />
              <TextInput
                label={t("fields.sourceVideoPath")}
                value={sourceVideoPath}
                error={
                  creationError ===
                  t("validation.requiredField", { field: t("fields.sourceVideoPath") })
                    ? creationError
                    : undefined
                }
                disabled={createProject.isPending}
                placeholder="D:/media/source.mp4"
                onChange={(event) => {
                  clearCreationFeedback();
                  setSourceVideoPath(event.currentTarget.value);
                }}
              />
              <Group grow gap="xs" align="flex-start">
                <TextInput
                  label={t("fields.sourceLanguage")}
                  value={sourceLanguage}
                  disabled={createProject.isPending}
                  onChange={(event) => {
                    clearCreationFeedback();
                    setSourceLanguage(event.currentTarget.value);
                  }}
                />
                <TextInput
                  label={t("fields.targetLanguage")}
                  value={targetLanguage}
                  disabled={createProject.isPending}
                  onChange={(event) => {
                    clearCreationFeedback();
                    setTargetLanguage(event.currentTarget.value);
                  }}
                />
              </Group>
            </Stack>
          </Paper>
        ) : null}

        <Paper withBorder radius="md" p="md" bg="#ffffff">
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={3} size="h5">
                {t("projectCenter.recentProjects")}
              </Title>
              <Text size="xs" fw={700} c="dimmed">
                {filteredProjects.length}/{recentProjects.length}
              </Text>
            </Group>

            {filteredProjects.length > 0 ? (
              <Box w="100%" maw="100%" style={{ overflowX: "auto" }}>
                <Box style={{ minWidth: 980 }}>
                  <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t("projectCenter.table.project")}</Table.Th>
                        <Table.Th>{t("projectCenter.table.source")}</Table.Th>
                        <Table.Th>{t("projectCenter.table.languages")}</Table.Th>
                        <Table.Th>{t("projectCenter.statusFilter")}</Table.Th>
                        <Table.Th>{t("projectCenter.table.subtitles")}</Table.Th>
                        <Table.Th>{t("projectCenter.table.duration")}</Table.Th>
                        <Table.Th>{t("projectCenter.diskUsage")}</Table.Th>
                        <Table.Th>{t("projectCenter.updated")}</Table.Th>
                        <Table.Th aria-label={t("projectCenter.table.actions")} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredProjects.map((project) => (
                        <Table.Tr key={project.projectId}>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text fw={700}>{project.name}</Text>
                              {project.diagnostics.warnings.length > 0 ? (
                                <Text size="xs" c="red">
                                  {project.diagnostics.warnings
                                    .map((warning) => warning.message)
                                    .join("; ")}
                                </Text>
                              ) : null}
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed" maw={260} truncate>
                              {project.sourceVideoPath}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatLanguagePair(project)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={statusBadgeColor(project.diagnostics.status)}
                              variant="light"
                            >
                              {t(`projectCenter.statuses.${project.diagnostics.status}`)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={project.hasSubtitleDocument ? "teal" : "gray"}
                              variant="light"
                            >
                              {project.hasSubtitleDocument
                                ? t("status.ready")
                                : t("workbench.noDocument")}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatDuration(project.durationMs)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatBytes(project.diagnostics.diskUsageBytes)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatUpdatedAt(project.updatedAt)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} wrap="nowrap">
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
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Box>
            ) : projects.isLoading || projects.isError ? null : recentProjects.length > 0 ? (
              <Stack gap={2} py="xl" align="center">
                <Text fw={700}>{t("projectCenter.noFilterMatches")}</Text>
              </Stack>
            ) : (
              <Stack gap={2} py="xl" align="center">
                <Text fw={700}>{t("projectCenter.noProjects")}</Text>
                <Text size="sm" c="dimmed">
                  {t("projectCenter.noProjectsHint")}
                </Text>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </>
  );
}
