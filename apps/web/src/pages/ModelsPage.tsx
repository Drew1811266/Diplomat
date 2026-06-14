import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Group,
  Paper,
  Progress,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Tooltip,
  Title
} from "@mantine/core";
import {
  IconDownload,
  IconRefresh,
  IconPlayerStop,
  IconTrash
} from "@tabler/icons-react";
import type { ModelCatalogEntry, ModelInstallStatus, ModelTask } from "@diplomat/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskStatusSurface } from "../components/TaskStatusSurface";
import {
  useCancelModelDownloadMutation,
  useDeleteModelMutation,
  useDownloadModelMutation,
  useModelsQuery,
  useRetryModelDownloadMutation
} from "../queries/modelQueries";

type ModelTaskFilter = ModelTask | "all";

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function statusColor(status: ModelInstallStatus) {
  if (status === "installed") {
    return "teal";
  }
  if (status === "failed") {
    return "red";
  }
  if (status === "canceled") {
    return "orange";
  }
  if (status === "queued" || status === "downloading" || status === "verifying") {
    return "blue";
  }
  return "gray";
}

function isModelBusy(status: ModelInstallStatus) {
  return status === "queued" || status === "downloading" || status === "verifying";
}

function languageSupport(model: ModelCatalogEntry) {
  if (model.languagePairs.length > 0) {
    return model.languagePairs.map(([source, target]) => `${source} -> ${target}`).join(", ");
  }
  return model.languages.join(", ");
}

function progressValue(model: ModelCatalogEntry) {
  if (model.installation.totalBytes <= 0) {
    return 0;
  }
  return Math.min(
    100,
    Math.round((model.installation.downloadedBytes / model.installation.totalBytes) * 100)
  );
}

export function ModelsPage() {
  const { t } = useTranslation();
  const [taskFilter, setTaskFilter] = useState<ModelTaskFilter>("all");
  const models = useModelsQuery();
  const downloadModel = useDownloadModelMutation();
  const cancelDownload = useCancelModelDownloadMutation();
  const retryDownload = useRetryModelDownloadMutation();
  const deleteModel = useDeleteModelMutation();
  const mutationPending =
    downloadModel.isPending ||
    cancelDownload.isPending ||
    retryDownload.isPending ||
    deleteModel.isPending;
  const error =
    getErrorMessage(models.error) ??
    getErrorMessage(downloadModel.error) ??
    getErrorMessage(cancelDownload.error) ??
    getErrorMessage(retryDownload.error) ??
    getErrorMessage(deleteModel.error);
  const catalog = models.data?.models ?? [];
  const filteredModels = catalog.filter(
    (model) => taskFilter === "all" || model.task === taskFilter
  );

  function actionFor(model: ModelCatalogEntry) {
    if (model.installation.status === "not_installed") {
      return {
        label: t("models.actions.installModel", { name: model.name }),
        icon: IconDownload,
        color: "teal",
        run: () => downloadModel.mutate(model.modelId)
      };
    }
    if (isModelBusy(model.installation.status)) {
      return {
        label: t("models.actions.cancelModel", { name: model.name }),
        icon: IconPlayerStop,
        color: "orange",
        run: () => cancelDownload.mutate(model.modelId)
      };
    }
    if (model.installation.status === "failed" || model.installation.status === "canceled") {
      return {
        label: t("models.actions.retryModel", { name: model.name }),
        icon: IconRefresh,
        color: "blue",
        run: () => retryDownload.mutate(model.modelId)
      };
    }
    return {
      label: t("models.actions.deleteModel", { name: model.name }),
      icon: IconTrash,
      color: "red",
      run: () => deleteModel.mutate(model.modelId)
    };
  }

  return (
    <Box component="main" aria-label={t("models.title")} maw={1240}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Title order={2}>{t("models.title")}</Title>
            <Text size="sm" c="dimmed">
              {t("models.subtitle")}
            </Text>
          </Stack>
          <SegmentedControl
            aria-label={t("models.taskFilter")}
            value={taskFilter}
            onChange={(value) => setTaskFilter(value as ModelTaskFilter)}
            data={[
              { label: t("models.filters.all"), value: "all" },
              { label: t("models.filters.asr"), value: "asr" },
              { label: t("models.filters.translation"), value: "translation" }
            ]}
          />
        </Group>

        <TaskStatusSurface
          busy={models.isLoading || mutationPending}
          message={
            models.isLoading
              ? t("models.loading")
              : mutationPending
                ? t("models.updating")
                : t("models.catalogCount", { count: catalog.length })
          }
          error={error}
        />

        <Paper withBorder radius="md" p="md" bg="#ffffff">
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={3} size="h5">
                {t("models.catalog")}
              </Title>
              <Text size="xs" fw={700} c="dimmed">
                {filteredModels.length}/{catalog.length}
              </Text>
            </Group>

            {filteredModels.length > 0 ? (
              <Box w="100%" maw="100%" style={{ overflowX: "auto" }}>
                <Box style={{ minWidth: 1120 }}>
                  <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t("models.table.model")}</Table.Th>
                        <Table.Th>{t("models.table.task")}</Table.Th>
                        <Table.Th>{t("models.table.runtime")}</Table.Th>
                        <Table.Th>{t("models.table.languages")}</Table.Th>
                        <Table.Th>{t("models.table.size")}</Table.Th>
                        <Table.Th>{t("models.table.license")}</Table.Th>
                        <Table.Th>{t("models.table.status")}</Table.Th>
                        <Table.Th>{t("models.table.hardware")}</Table.Th>
                        <Table.Th aria-label={t("models.table.actions")} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredModels.map((model) => {
                        const action = actionFor(model);
                        const ActionIconComponent = action.icon;
                        const progress = progressValue(model);

                        return (
                          <Table.Tr key={model.modelId}>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text fw={700}>{model.name}</Text>
                                <Text size="xs" c="dimmed" ff="monospace">
                                  {model.modelId}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {model.termsSummary}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={4}>
                                <Badge variant="light">
                                  {t(`models.tasks.${model.task}`)}
                                </Badge>
                                <Badge variant="outline" color={model.tier === "light" ? "gray" : "violet"}>
                                  {t(`models.tiers.${model.tier}`)}
                                </Badge>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{model.runtime}</Text>
                              <Text size="xs" c="dimmed">
                                {model.provider}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{languageSupport(model)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm">{formatBytes(model.downloadSizeBytes)}</Text>
                                <Text size="xs" c="dimmed">
                                  {formatBytes(model.diskRequirementBytes)}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm">{model.licenseName}</Text>
                                <Anchor size="xs" href={model.licenseUrl} target="_blank" rel="noreferrer">
                                  {t("models.license")}
                                </Anchor>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={6}>
                                <Badge color={statusColor(model.installation.status)} variant="light">
                                  {t(`models.statuses.${model.installation.status}`)}
                                </Badge>
                                {isModelBusy(model.installation.status) ? (
                                  <Progress value={progress} size="xs" radius="xs" />
                                ) : null}
                                <Text size="xs" c="dimmed">
                                  {formatBytes(model.installation.downloadedBytes)} /{" "}
                                  {formatBytes(model.installation.totalBytes)}
                                </Text>
                                {model.availability.reason ? (
                                  <Text size="xs" c={model.availability.usable ? "dimmed" : "orange"}>
                                    {model.availability.reason}
                                  </Text>
                                ) : null}
                                {model.installation.errorMessage ? (
                                  <Text size="xs" c="red">
                                    {model.installation.errorMessage}
                                  </Text>
                                ) : null}
                                {model.installation.installedPath ? (
                                  <Text size="xs" c="dimmed" ff="monospace">
                                    {model.installation.installedPath}
                                  </Text>
                                ) : null}
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{model.recommendedHardware}</Text>
                              <Text size="xs" c="dimmed">
                                {model.version}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label={action.label} withArrow>
                                <ActionIcon
                                  aria-label={action.label}
                                  color={action.color}
                                  disabled={mutationPending}
                                  variant="light"
                                  onClick={action.run}
                                >
                                  <ActionIconComponent size={18} aria-hidden="true" />
                                </ActionIcon>
                              </Tooltip>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Box>
            ) : models.isLoading || models.isError ? null : (
              <Stack gap={2} py="xl" align="center">
                <Text fw={700}>{t("models.noModels")}</Text>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
