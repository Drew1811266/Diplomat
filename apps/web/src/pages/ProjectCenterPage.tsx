import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title
} from "@mantine/core";
import { IconFolderOpen, IconPlus, IconUpload } from "@tabler/icons-react";
import type { ProjectResponse } from "@diplomat/shared";
import { useTranslation } from "react-i18next";
import { TaskStatusSurface } from "../components/TaskStatusSurface";
import { useProjectsQuery } from "../queries/projectQueries";
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

export function ProjectCenterPage({ onOpenProject }: ProjectCenterPageProps) {
  const { t } = useTranslation();
  const worker = useWorkerHealthQuery();
  const projects = useProjectsQuery();
  const recentProjects = projects.data?.projects ?? [];
  const workerReady = worker.data?.status === "ok";

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
        busy={worker.isLoading || projects.isLoading}
        message={workerReady ? t("projectCenter.workerReady") : null}
        error={worker.error instanceof Error ? worker.error.message : null}
      />

      <Group gap="sm">
        <Button leftSection={<IconPlus size={18} />} variant="filled">
          {t("projectCenter.createProject")}
        </Button>
        <Button leftSection={<IconUpload size={18} />} variant="default">
          {t("projectCenter.importVideo")}
        </Button>
      </Group>

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
            <Box style={{ minWidth: 760, overflowX: "auto" }}>
              <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Project</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Languages</Table.Th>
                    <Table.Th>Subtitles</Table.Th>
                    <Table.Th>Duration</Table.Th>
                    <Table.Th aria-label="Project actions" />
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
                          {project.hasSubtitleDocument ? t("status.ready") : t("workbench.noDocument")}
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
  );
}
