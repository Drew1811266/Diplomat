import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { IconFolderOpen, IconPlus, IconUpload } from "@tabler/icons-react";
import type { ProjectResponse } from "@diplomat/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskStatusSurface } from "../components/TaskStatusSurface";
import { pickVideoFile } from "../desktop";
import { useCreateProjectMutation, useProjectsQuery } from "../queries/projectQueries";
import { useWorkerHealthQuery } from "../queries/workerQueries";

type ProjectCenterPageProps = {
  onOpenProject: (projectId: string) => void;
};

function formatDuration(durationMs: number | null | undefined) {
  if (!durationMs || durationMs <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

export function ProjectCenterPage({ onOpenProject }: ProjectCenterPageProps) {
  const { t } = useTranslation();
  const worker = useWorkerHealthQuery();
  const projects = useProjectsQuery();
  const createProject = useCreateProjectMutation();
  const defaultProjectName = t("projectCenter.untitledProject");
  const [creationOpen, setCreationOpen] = useState(false);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [sourceVideoPath, setSourceVideoPath] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("zh");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [creationError, setCreationError] = useState<string | null>(null);
  const recentProjects = projects.data?.projects ?? [];
  const workerReady = worker.data?.status === "ok";
  const statusError =
    creationError ??
    getErrorMessage(createProject.error) ??
    getErrorMessage(worker.error) ??
    getErrorMessage(projects.error);

  function clearCreationFeedback() {
    setCreationError(null);
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

  return (
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
        busy={worker.isLoading || projects.isLoading || createProject.isPending}
        message={
          createProject.isPending
            ? t("projectCenter.creatingProject")
            : workerReady
              ? t("projectCenter.workerReady")
              : null
        }
        error={statusError}
      />

      <Group gap="sm">
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
              {recentProjects.length}
            </Text>
          </Group>

          {recentProjects.length > 0 ? (
            <Box w="100%" maw="100%" style={{ overflowX: "auto" }}>
              <Box style={{ minWidth: 760 }}>
                <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("projectCenter.table.project")}</Table.Th>
                      <Table.Th>{t("projectCenter.table.source")}</Table.Th>
                      <Table.Th>{t("projectCenter.table.languages")}</Table.Th>
                      <Table.Th>{t("projectCenter.table.subtitles")}</Table.Th>
                      <Table.Th>{t("projectCenter.table.duration")}</Table.Th>
                      <Table.Th aria-label={t("projectCenter.table.actions")} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {recentProjects.map((project) => (
                      <Table.Tr key={project.projectId}>
                        <Table.Td>
                          <Text fw={700}>{project.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed" maw={320} truncate>
                            {project.sourceVideoPath}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatLanguagePair(project)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={project.hasSubtitleDocument ? "teal" : "gray"} variant="light">
                            {project.hasSubtitleDocument
                              ? t("status.ready")
                              : t("workbench.noDocument")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatDuration(project.durationMs)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconFolderOpen size={16} />}
                            onClick={() => onOpenProject(project.projectId)}
                          >
                            {t("actions.open")}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
            </Box>
          ) : projects.isLoading || projects.isError ? null : (
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
  );
}
