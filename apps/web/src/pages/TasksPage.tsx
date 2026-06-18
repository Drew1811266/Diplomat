import { Badge, Box, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconActivityHeartbeat,
  IconFileExport,
  IconLanguage,
  IconRotateClockwise,
  IconScissors,
  type Icon
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

const taskStages = [
  { key: "segmentation", icon: IconScissors, color: "blue" },
  { key: "asr", icon: IconActivityHeartbeat, color: "teal" },
  { key: "translation", icon: IconLanguage, color: "violet" },
  { key: "export", icon: IconFileExport, color: "orange" }
] as const;

type TaskStageKey = (typeof taskStages)[number]["key"];

function TaskStageCard({
  stageKey,
  icon: StageIcon,
  color
}: {
  stageKey: TaskStageKey;
  icon: Icon;
  color: string;
}) {
  const { t } = useTranslation();

  return (
    <Paper withBorder radius="md" p="md" bg="#ffffff">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <ThemeIcon color={color} variant="light" radius="md" size={36}>
            <StageIcon size={20} aria-hidden="true" />
          </ThemeIcon>
          <Badge color="gray" variant="light">
            {t(`tasks.stages.${stageKey}.status`)}
          </Badge>
        </Group>
        <Stack gap={4}>
          <Title order={3} size="h5">
            {t(`tasks.stages.${stageKey}.title`)}
          </Title>
          <Text size="sm" c="dimmed">
            {t(`tasks.stages.${stageKey}.description`)}
          </Text>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function TasksPage() {
  const { t } = useTranslation();

  return (
    <Box component="main" aria-label={t("tasks.title")} maw={1120}>
      <Stack gap="md">
        <Box>
          <Title order={2}>{t("tasks.title")}</Title>
          <Text c="dimmed" size="sm" mt={4}>
            {t("tasks.description")}
          </Text>
        </Box>

        <Paper withBorder radius="md" p="md" bg="#ffffff">
          <Group justify="space-between" gap="md" align="center">
            <Stack gap={2}>
              <Title order={3} size="h5">
                {t("tasks.overview.title")}
              </Title>
              <Text c="dimmed" size="sm">
                {t("tasks.overview.description")}
              </Text>
            </Stack>
            <Badge color="teal" variant="light" size="lg">
              {t("status.ready")}
            </Badge>
          </Group>
        </Paper>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {taskStages.map(({ key, icon, color }) => (
            <TaskStageCard key={key} stageKey={key} icon={icon} color={color} />
          ))}
        </SimpleGrid>

        <Paper withBorder radius="md" p="md" bg="#ffffff">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon color="teal" variant="light" radius="md" size={36}>
              <IconRotateClockwise size={20} aria-hidden="true" />
            </ThemeIcon>
            <Stack gap={4}>
              <Title order={3} size="h5">
                {t("tasks.recovery.title")}
              </Title>
              <Text size="sm" c="dimmed">
                {t("tasks.recovery.description")}
              </Text>
            </Stack>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
}
