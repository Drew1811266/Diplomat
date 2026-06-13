import { Box, Paper, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

export function TasksPage() {
  const { t } = useTranslation();

  return (
    <Box component="main" aria-label={t("tasks.title")} maw={920}>
      <Paper withBorder radius="md" p="lg" bg="#ffffff">
        <Stack gap="xs">
          <Title order={2}>{t("tasks.title")}</Title>
          <Text c="dimmed" size="sm">
            {t("tasks.description")}
          </Text>
        </Stack>
      </Paper>
    </Box>
  );
}
