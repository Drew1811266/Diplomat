import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  NativeSelect,
  Paper,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  Title
} from "@mantine/core";
import {
  IconBan,
  IconFileText,
  IconRefresh,
  IconSearch
} from "@tabler/icons-react";
import type { ProjectResponse, TaskResponse, TaskStatus, TaskType } from "@diplomat/shared";
import { useEffect, useMemo, useState, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { workstationSurfaces } from "../app/theme";
import { openPathInFileManager } from "../desktop";
import { displayTaskMessage } from "../lib/taskMessages";
import { useProjectsQuery } from "../queries/projectQueries";
import { isTaskActive, useCancelTaskMutation, useRetryTaskMutation, useTasksQuery } from "../queries/taskQueries";

const taskStatuses: Array<TaskStatus | "all"> = [
  "all",
  "queued",
  "running",
  "canceling",
  "failed",
  "completed",
  "canceled"
];
const taskTypes: Array<TaskType | "all"> = ["all", "analysis", "translation", "waveform", "export"];
const taskVirtualizedRowThreshold = 120;
const taskVirtualizedWindowSize = 80;
const taskVirtualizedRowHeight = 72;
const pipelineStageKeys = ["prepare", "segmentation", "asr", "translation", "export"] as const;
type PipelineStageKey = (typeof pipelineStageKeys)[number];
type PipelineStageStatus = "completed" | "running" | "queued" | "canceling" | "failed" | "canceled" | "waiting";

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

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function isCancelable(task: TaskResponse) {
  return task.status === "queued" || task.status === "running";
}

function isRetryable(task: TaskResponse) {
  return task.status === "failed" || task.status === "canceled";
}

function projectName(projects: ProjectResponse[], projectId: string) {
  return projects.find((project) => project.projectId === projectId)?.name ?? projectId;
}

function activePipelineStage(task: TaskResponse): PipelineStageKey {
  if (task.type === "analysis") {
    return "asr";
  }
  if (task.type === "translation") {
    return "translation";
  }
  if (task.type === "export") {
    return "export";
  }
  return "prepare";
}

function pipelineStatusFor(task: TaskResponse, stage: PipelineStageKey): PipelineStageStatus {
  const activeStage = activePipelineStage(task);
  const stageIndex = pipelineStageKeys.indexOf(stage);
  const activeIndex = pipelineStageKeys.indexOf(activeStage);

  if (stageIndex < activeIndex) {
    return "completed";
  }
  if (stageIndex > activeIndex) {
    return "waiting";
  }
  if (task.status === "completed") {
    return "completed";
  }
  return task.status;
}

function pipelineStatusColor(status: PipelineStageStatus) {
  if (status === "completed") {
    return "teal";
  }
  if (status === "running") {
    return "blue";
  }
  if (status === "failed") {
    return "red";
  }
  if (status === "canceled" || status === "canceling") {
    return "orange";
  }
  return "gray";
}

export function TasksPage() {
  const { t } = useTranslation();
  const tasksQuery = useTasksQuery();
  const projectsQuery = useProjectsQuery();
  const cancelTask = useCancelTaskMutation();
  const retryTask = useRetryTaskMutation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [taskWindowStartIndex, setTaskWindowStartIndex] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasks = tasksQuery.data?.tasks ?? [];
  const projects = projectsQuery.data?.projects ?? [];

  const metrics = useMemo(
    () => ({
      total: tasks.length,
      active: tasks.filter((task) => isTaskActive(task)).length,
      failed: tasks.filter((task) => task.status === "failed").length,
      completed: tasks.filter((task) => task.status === "completed").length
    }),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const taskProjectName = projectName(projects, task.projectId);
      const displayMessage = displayTaskMessage(task.message, t);
      const displayErrorMessage = task.errorMessage ? displayTaskMessage(task.errorMessage, t) : "";
      const matchesSearch =
        !query ||
        [
          task.taskId,
          task.type,
          task.status,
          task.message,
          task.errorMessage ?? "",
          displayMessage,
          displayErrorMessage,
          task.projectId,
          taskProjectName
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesType = typeFilter === "all" || task.type === typeFilter;
      const matchesProject = projectFilter === "all" || task.projectId === projectFilter;
      return matchesSearch && matchesStatus && matchesType && matchesProject;
    });
  }, [projectFilter, projects, search, statusFilter, t, tasks, typeFilter]);

  const shouldVirtualizeTasks = filteredTasks.length > taskVirtualizedRowThreshold;
  const maxTaskWindowStartIndex = Math.max(0, filteredTasks.length - taskVirtualizedWindowSize);
  const safeTaskWindowStartIndex = Math.min(taskWindowStartIndex, maxTaskWindowStartIndex);
  const renderedTasks = shouldVirtualizeTasks
    ? filteredTasks.slice(
        safeTaskWindowStartIndex,
        safeTaskWindowStartIndex + taskVirtualizedWindowSize
      )
    : filteredTasks;
  const taskTopSpacerHeight = shouldVirtualizeTasks
    ? safeTaskWindowStartIndex * taskVirtualizedRowHeight
    : 0;
  const taskBottomSpacerHeight = shouldVirtualizeTasks
    ? Math.max(
        0,
        (filteredTasks.length - safeTaskWindowStartIndex - renderedTasks.length) *
          taskVirtualizedRowHeight
      )
    : 0;

  useEffect(() => {
    setTaskWindowStartIndex(0);
  }, [projectFilter, search, statusFilter, tasks.length, typeFilter]);

  useEffect(() => {
    if (filteredTasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }
    if (!selectedTaskId || !filteredTasks.some((task) => task.taskId === selectedTaskId)) {
      setSelectedTaskId(filteredTasks[0]!.taskId);
    }
  }, [filteredTasks, selectedTaskId]);

  function handleTaskListScroll(event: UIEvent<HTMLDivElement>) {
    if (!shouldVirtualizeTasks) {
      return;
    }
    const nextStartIndex = Math.min(
      maxTaskWindowStartIndex,
      Math.max(0, Math.floor(event.currentTarget.scrollTop / taskVirtualizedRowHeight))
    );
    setTaskWindowStartIndex(nextStartIndex);
  }

  const statusOptions = taskStatuses.map((status) => ({
    value: status,
    label: status === "all" ? t("tasks.filters.allStatuses") : t(`status.${status}`)
  }));
  const typeOptions = taskTypes.map((type) => ({
    value: type,
    label: type === "all" ? t("tasks.filters.allTypes") : t(`tasks.types.${type}`)
  }));
  const projectOptions = [
    { value: "all", label: t("tasks.filters.allProjects") },
    ...Array.from(new Set(tasks.map((task) => task.projectId))).map((projectId) => ({
      value: projectId,
      label: projectName(projects, projectId)
    }))
  ];
  const selectedTask = filteredTasks.find((task) => task.taskId === selectedTaskId) ?? filteredTasks[0] ?? null;

  return (
    <Box component="main" aria-label={t("tasks.title")} maw={1280}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={1} size="h3">
              {t("tasks.title")}
            </Title>
            <Text c="dimmed" size="sm" mt={4}>
              {t("tasks.description")}
            </Text>
          </Box>
          {tasksQuery.isFetching ? (
            <Badge color="teal" variant="light" size="lg">
              {t("tasks.loading")}
            </Badge>
          ) : null}
        </Group>

        <Paper
          withBorder
          radius="md"
          p="md"
          bg={workstationSurfaces.panel}
          data-testid="tasks-queue-panel"
        >
          <Stack gap="md">
            <Group justify="space-between" gap="md" align="flex-end">
              <Stack gap={2}>
                <Title order={3} size="h5">
                  {t("tasks.queue.title")}
                </Title>
                <Text c="dimmed" size="sm">
                  {t("tasks.queue.description")}
                </Text>
                <Group data-testid="tasks-inline-summary" gap={6} mt={4}>
                  {(["total", "active", "failed", "completed"] as const).map((key) => (
                    <Badge key={key} color={key === "failed" && metrics[key] > 0 ? "red" : "gray"} variant="light">
                      {t(`tasks.metrics.${key}`)} {metrics[key]}
                    </Badge>
                  ))}
                </Group>
                <Text c="dimmed" size="xs" fw={700}>
                  {shouldVirtualizeTasks
                    ? t("tasks.visibleTaskCount", {
                        visible: renderedTasks.length,
                        total: filteredTasks.length
                      })
                    : `${filteredTasks.length}/${tasks.length}`}
                </Text>
              </Stack>
              <Group gap="sm" align="flex-end">
                <TextInput
                  label={t("tasks.filters.search")}
                  leftSection={<IconSearch size={16} aria-hidden="true" />}
                  placeholder={t("tasks.filters.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  w={260}
                />
                <Select
                  label={t("tasks.filters.status")}
                  data={statusOptions}
                  value={statusFilter}
                  onChange={(value) => setStatusFilter((value as TaskStatus | "all") ?? "all")}
                  allowDeselect={false}
                  w={160}
                />
                <Select
                  label={t("tasks.filters.type")}
                  data={typeOptions}
                  value={typeFilter}
                  onChange={(value) => setTypeFilter((value as TaskType | "all") ?? "all")}
                  allowDeselect={false}
                  w={160}
                />
                <NativeSelect
                  label={t("tasks.filters.project")}
                  data={projectOptions}
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.currentTarget.value)}
                  w={190}
                />
              </Group>
            </Group>

            {tasksQuery.isError ? (
              <Paper withBorder radius="md" p="md" bg={workstationSurfaces.panelAlt}>
                <Text fw={700}>{t("tasks.error")}</Text>
                <Text size="sm" c="dimmed">
                  {t("tasks.errorHint")}
                </Text>
              </Paper>
            ) : null}

            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 340px)",
                gap: 16,
                alignItems: "start"
              }}
            >
              <Box onScroll={handleTaskListScroll} style={{ overflow: "auto", maxHeight: 560 }}>
                <Table aria-label={t("tasks.queue.title")} verticalSpacing="md" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("tasks.table.task")}</Table.Th>
                      <Table.Th>{t("tasks.table.project")}</Table.Th>
                      <Table.Th>{t("tasks.table.status")}</Table.Th>
                      <Table.Th>{t("tasks.table.progress")}</Table.Th>
                      <Table.Th>{t("tasks.table.updated")}</Table.Th>
                      <Table.Th>{t("tasks.table.resource")}</Table.Th>
                      <Table.Th>{t("tasks.table.actions")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {taskTopSpacerHeight > 0 ? (
                      <Table.Tr aria-hidden="true">
                        <Table.Td colSpan={7} p={0} style={{ height: taskTopSpacerHeight }} />
                      </Table.Tr>
                    ) : null}
                    {renderedTasks.map((task) => {
                      const progress = Math.round(task.progress * 100);
                      const logPath = task.diagnosticLogPath;
                      const selected = selectedTask?.taskId === task.taskId;
                      return (
                        <Table.Tr
                          key={task.taskId}
                          data-testid={`task-row-${task.taskId}`}
                          aria-selected={selected}
                          style={{
                            background: selected ? "#e6fffb" : undefined
                          }}
                        >
                          <Table.Td>
                            <Stack gap={2}>
                              <Group gap="xs">
                                <Text fw={800}>{t(`tasks.types.${task.type}`)}</Text>
                                <Text size="xs" c="dimmed">
                                  {task.taskId}
                                </Text>
                              </Group>
                              <Text size="sm" c="dimmed">
                                {displayTaskMessage(task.message, t)}
                              </Text>
                              {task.errorMessage ? (
                                <Text size="xs" c="red">
                                  {displayTaskMessage(task.errorMessage, t)}
                                </Text>
                              ) : null}
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text fw={700}>{projectName(projects, task.projectId)}</Text>
                              <Text size="xs" c="dimmed">
                                {task.projectId}
                              </Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={statusColor(task.status)}
                              variant="light"
                              tt="none"
                              style={{ minWidth: 78 }}
                            >
                              {t(`status.${task.status}`)}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ minWidth: 180 }}>
                            <Stack gap={4}>
                              <Progress value={progress} size="xs" radius="xs" color="teal" />
                              <Text size="xs" c="dimmed">
                                {formatProgress(task.progress)}
                              </Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatTimestamp(task.updatedAt)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{t("tasks.resources.localRuntime")}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              <Tooltip label={t("tasks.details.title")}>
                                <ActionIcon
                                  aria-label={t("tasks.actions.viewDetails", { taskId: task.taskId })}
                                  variant={selected ? "light" : "subtle"}
                                  color="gray"
                                  onClick={() => setSelectedTaskId(task.taskId)}
                                >
                                  <IconFileText size={18} aria-hidden="true" />
                                </ActionIcon>
                              </Tooltip>
                              {isCancelable(task) ? (
                                <Tooltip label={t("actions.cancel")}>
                                  <ActionIcon
                                    aria-label={t("tasks.actions.cancelTask", { taskId: task.taskId })}
                                    variant="light"
                                    color="orange"
                                    onClick={() => cancelTask.mutate(task.taskId)}
                                    loading={cancelTask.isPending}
                                  >
                                    <IconBan size={18} aria-hidden="true" />
                                  </ActionIcon>
                                </Tooltip>
                              ) : null}
                              {isRetryable(task) ? (
                                <Tooltip label={t("actions.retry")}>
                                  <ActionIcon
                                    aria-label={t("tasks.actions.retryTask", { taskId: task.taskId })}
                                    variant="light"
                                    color="teal"
                                    onClick={() => retryTask.mutate({ taskId: task.taskId })}
                                    loading={retryTask.isPending}
                                  >
                                    <IconRefresh size={18} aria-hidden="true" />
                                  </ActionIcon>
                                </Tooltip>
                              ) : null}
                              {logPath ? (
                                <Tooltip label={t("actions.openLogs")}>
                                  <ActionIcon
                                    aria-label={t("tasks.actions.openLogs", { taskId: task.taskId })}
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => void openPathInFileManager(logPath)}
                                  >
                                    <IconFileText size={18} aria-hidden="true" />
                                  </ActionIcon>
                                </Tooltip>
                              ) : null}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                    {taskBottomSpacerHeight > 0 ? (
                      <Table.Tr aria-hidden="true">
                        <Table.Td colSpan={7} p={0} style={{ height: taskBottomSpacerHeight }} />
                      </Table.Tr>
                    ) : null}
                    {filteredTasks.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Text c="dimmed" ta="center" py="xl">
                            {tasks.length === 0 ? t("tasks.table.noTasks") : t("tasks.table.noMatches")}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              </Box>

              <Box
                component="section"
                role="region"
                aria-label={t("tasks.details.title")}
                p="sm"
                style={{
                  border: `1px solid ${workstationSurfaces.outline}`,
                  borderRadius: 6,
                  background: workstationSurfaces.panelAlt,
                  minWidth: 0
                }}
              >
                {selectedTask ? (
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" gap="xs">
                      <Stack gap={2} style={{ minWidth: 0 }}>
                        <Text fw={800}>{t("tasks.details.title")}</Text>
                        <Text size="sm" c="dimmed" truncate title={selectedTask.taskId}>
                          {selectedTask.taskId}
                        </Text>
                      </Stack>
                      <Badge color={statusColor(selectedTask.status)} variant="light">
                        {t(`status.${selectedTask.status}`)}
                      </Badge>
                    </Group>

                    <Box>
                      <Text size="xs" fw={800} c="dimmed">
                        {t("tasks.table.project")}
                      </Text>
                      <Text fw={700}>{projectName(projects, selectedTask.projectId)}</Text>
                    </Box>

                    <Box>
                      <Text size="xs" fw={800} c="dimmed">
                        {t("tasks.details.currentStep")}
                      </Text>
                      <Text size="sm">{displayTaskMessage(selectedTask.message, t)}</Text>
                      {selectedTask.errorMessage ? (
                        <Text size="xs" c="red" mt={4}>
                          {displayTaskMessage(selectedTask.errorMessage, t)}
                        </Text>
                      ) : null}
                    </Box>

                    <Stack gap="xs" aria-label={t("tasks.details.pipeline")}>
                      <Text size="xs" fw={800} c="dimmed">
                        {t("tasks.details.pipeline")}
                      </Text>
                      {pipelineStageKeys.map((stage) => {
                        const stageStatus = pipelineStatusFor(selectedTask, stage);
                        const activeStage = activePipelineStage(selectedTask) === stage;
                        const statusText = t(`tasks.pipelineStatuses.${stageStatus}`, {
                          progress: formatProgress(selectedTask.progress)
                        });
                        return (
                          <Box
                            key={stage}
                            p="xs"
                            style={{
                              border: `1px solid ${
                                activeStage ? workstationSurfaces.outlineStrong : workstationSurfaces.outline
                              }`,
                              borderRadius: 6,
                              background: activeStage ? "#ffffff" : workstationSurfaces.panelAlt
                            }}
                          >
                            <Group justify="space-between" gap="xs" wrap="nowrap">
                              <Text size="sm" fw={700}>
                                {t(`tasks.pipelineStages.${stage}`)}
                              </Text>
                              <Badge color={pipelineStatusColor(stageStatus)} variant="light" tt="none">
                                {statusText}
                              </Badge>
                            </Group>
                          </Box>
                        );
                      })}
                    </Stack>

                    <Group gap="xs">
                      {isRetryable(selectedTask) ? (
                        <Button
                          type="button"
                          size="xs"
                          color="teal"
                          variant="light"
                          leftSection={<IconRefresh size={16} aria-hidden="true" />}
                          loading={retryTask.isPending}
                          onClick={() => retryTask.mutate({ taskId: selectedTask.taskId })}
                        >
                          {t("tasks.actions.recoverFromCheckpoint")}
                        </Button>
                      ) : null}
                      {selectedTask.diagnosticLogPath ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="default"
                          leftSection={<IconFileText size={16} aria-hidden="true" />}
                          onClick={() => void openPathInFileManager(selectedTask.diagnosticLogPath!)}
                        >
                          {t("tasks.actions.openDiagnosticLog")}
                        </Button>
                      ) : null}
                    </Group>
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t("tasks.details.noSelection")}
                  </Text>
                )}
              </Box>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
