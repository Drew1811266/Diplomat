import { Alert, Group, Loader, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

type TaskStatusSurfaceProps = {
  busy: boolean;
  message?: string | null;
  error?: string | null;
};

export function TaskStatusSurface({ busy, message, error }: TaskStatusSurfaceProps) {
  const { t } = useTranslation();

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={18} />} title={t("status.failed")}>
        {error}
      </Alert>
    );
  }

  return (
    <Group role="status" aria-live="polite" gap="xs" mih={28}>
      {busy ? <Loader size="xs" /> : null}
      {message ? (
        <Text size="sm" fw={700} c="dimmed">
          {message}
        </Text>
      ) : null}
    </Group>
  );
}
