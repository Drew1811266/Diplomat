import { Alert, Badge, Box, Group, Loader, Paper, Progress, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

type TaskSurfaceStatus =
  | "ready"
  | "queued"
  | "running"
  | "canceling"
  | "completed"
  | "failed"
  | "canceled"
  | "blocked";

type TaskStatusSurfaceProps = {
  busy: boolean;
  message?: string | null;
  error?: string | null;
  status?: TaskSurfaceStatus;
  progress?: number | null;
  action?: ReactNode;
};

const statusColors: Record<TaskSurfaceStatus, string> = {
  ready: "gray",
  queued: "blue",
  running: "teal",
  canceling: "orange",
  completed: "green",
  failed: "red",
  canceled: "orange",
  blocked: "red"
};

export function TaskStatusSurface({
  busy,
  message,
  error,
  status,
  progress,
  action
}: TaskStatusSurfaceProps) {
  const { t } = useTranslation();
  const resolvedStatus: TaskSurfaceStatus = error ? "failed" : status ?? (busy ? "running" : "ready");
  const progressValue = typeof progress === "number" ? Math.min(Math.max(progress, 0), 1) * 100 : null;

  if (error) {
    return (
      <Alert
        color="red"
        icon={<IconAlertTriangle size={18} />}
        role="alert"
        title={t("status.failed")}
      >
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Text size="sm" fw={700} style={{ overflowWrap: "anywhere" }}>
            {error}
          </Text>
          {action}
        </Group>
      </Alert>
    );
  }

  return (
    <Paper
      role="status"
      aria-live="polite"
      withBorder
      radius="md"
      p="sm"
      style={{ minHeight: 44, background: "#ffffff" }}
    >
      <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
        <Group gap="xs" miw={0} wrap="nowrap">
          {busy ? <Loader size="xs" /> : null}
          <Badge color={statusColors[resolvedStatus]} radius="sm" tt="none" variant="light">
            {t(`status.${resolvedStatus}`)}
          </Badge>
          {message ? (
            <Text size="sm" fw={700} c="dimmed" truncate>
              {message}
            </Text>
          ) : null}
        </Group>
        {action}
      </Group>
      {progressValue !== null ? (
        <Box mt="xs">
          <Progress aria-label="Task progress" color={statusColors[resolvedStatus]} value={progressValue} size="sm" />
        </Box>
      ) : null}
    </Paper>
  );
}
