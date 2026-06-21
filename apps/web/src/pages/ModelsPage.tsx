import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  NativeSelect,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  Title
} from "@mantine/core";
import {
  IconDownload,
  IconChevronDown,
  IconChevronUp,
  IconSearch,
  IconRefresh,
  IconPlayerStop,
  IconSettings,
  IconTrash
} from "@tabler/icons-react";
import type { ModelCatalogEntry, ModelInstallStatus, ModelTask } from "@diplomat/shared";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useState, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { TaskStatusSurface } from "../components/TaskStatusSurface";
import { workstationSurfaces } from "../app/theme";
import { useUiStore } from "../state/uiStore";
import {
  useCancelModelDownloadMutation,
  useDeleteModelMutation,
  useDownloadModelMutation,
  useModelsQuery,
  useRetryModelDownloadMutation
} from "../queries/modelQueries";

type ModelTaskFilter = ModelTask | "all";
type ModelInstallStatusFilter = ModelInstallStatus | "all";

type ModelsContentProps = {
  showHeader?: boolean;
};

const modelVirtualizedRowThreshold = 120;
const modelVirtualizedWindowSize = 80;
const modelVirtualizedRowHeight = 96;

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

function displayRuntimeMessage(message: string) {
  return message.replaceAll("Worker runtime", "local runtime").replaceAll("Worker", "local runtime");
}

const commonModelReasonKeys: Record<string, string> = {
  "Model is not installed.": "models.reasons.modelNotInstalled",
  "Model license acceptance is required.": "models.reasons.modelLicenseAcceptanceRequired",
  "Model license acceptance record is incomplete.":
    "models.reasons.modelLicenseAcceptanceIncomplete"
};

function displayModelMessage(message: string, t: TFunction) {
  const sanitizedMessage = displayRuntimeMessage(message).trim();
  const reasonKey = commonModelReasonKeys[sanitizedMessage];
  return reasonKey ? t(reasonKey) : sanitizedMessage;
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

function availableProfileCount(model: ModelCatalogEntry) {
  return model.runtimeProfiles.filter((profile) => profile.available).length;
}

function recommendedModelForTask(catalog: ModelCatalogEntry[], task: ModelTask) {
  const candidates = catalog.filter((model) => model.task === task);

  return (
    candidates.find(
      (model) => model.installation.status === "installed" && model.availability.usable
    ) ??
    candidates.find((model) => isModelBusy(model.installation.status)) ??
    candidates.find(
      (model) => model.installation.status === "not_installed" && model.tier === "light"
    ) ??
    candidates.find((model) => model.tier === "light") ??
    candidates.find((model) => model.installation.status === "not_installed") ??
    candidates[0] ??
    null
  );
}

export function ModelsContent({ showHeader = true }: ModelsContentProps) {
  const { t } = useTranslation();
  const setPage = useUiStore((state) => state.setPage);
  const setSettingsCategory = useUiStore((state) => state.setSettingsCategory);
  const [taskFilter, setTaskFilter] = useState<ModelTaskFilter>("all");
  const [installStatusFilter, setInstallStatusFilter] = useState<ModelInstallStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
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
    getErrorMessage(downloadModel.error) ??
    getErrorMessage(cancelDownload.error) ??
    getErrorMessage(retryDownload.error) ??
    getErrorMessage(deleteModel.error);
  const catalog = models.data?.models ?? [];
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredModels = useMemo(
    () =>
      catalog.filter((model) => {
        if (taskFilter !== "all" && model.task !== taskFilter) {
          return false;
        }

        if (installStatusFilter !== "all" && model.installation.status !== installStatusFilter) {
          return false;
        }

        if (!normalizedSearchQuery) {
          return true;
        }

        const searchableText = [
          model.name,
          model.modelId,
          model.runtime,
          model.provider,
          model.version,
          model.licenseName,
          model.recommendedHardware,
          model.termsSummary,
          model.languages.join(" "),
          languageSupport(model)
        ]
          .join(" ")
          .toLocaleLowerCase();

        return searchableText.includes(normalizedSearchQuery);
      }),
    [catalog, installStatusFilter, normalizedSearchQuery, taskFilter]
  );
  const [modelWindowStartIndex, setModelWindowStartIndex] = useState(0);
  const shouldVirtualizeModels = filteredModels.length > modelVirtualizedRowThreshold;
  const maxModelWindowStartIndex = Math.max(0, filteredModels.length - modelVirtualizedWindowSize);
  const safeModelWindowStartIndex = Math.min(modelWindowStartIndex, maxModelWindowStartIndex);
  const renderedModels = shouldVirtualizeModels
    ? filteredModels.slice(
        safeModelWindowStartIndex,
        safeModelWindowStartIndex + modelVirtualizedWindowSize
      )
    : filteredModels;
  const modelTopSpacerHeight = shouldVirtualizeModels
    ? safeModelWindowStartIndex * modelVirtualizedRowHeight
    : 0;
  const modelBottomSpacerHeight = shouldVirtualizeModels
    ? Math.max(
        0,
        (filteredModels.length - safeModelWindowStartIndex - renderedModels.length) *
          modelVirtualizedRowHeight
      )
    : 0;
  const selectedModel =
    filteredModels.find((model) => model.modelId === selectedModelId) ?? filteredModels[0] ?? null;
  const installedCount = catalog.filter((model) => model.installation.status === "installed").length;
  const usableCount = catalog.filter((model) => model.availability.usable).length;
  const activeDownloadCount = catalog.filter((model) => isModelBusy(model.installation.status)).length;
  const profileCount = catalog.reduce(
    (count, model) => count + availableProfileCount(model),
    0
  );
  const recommendedModels = useMemo(
    () => [
      { task: "asr" as const, model: recommendedModelForTask(catalog, "asr") },
      { task: "translation" as const, model: recommendedModelForTask(catalog, "translation") }
    ],
    [catalog]
  );

  useEffect(() => {
    setModelWindowStartIndex(0);
  }, [taskFilter, installStatusFilter, normalizedSearchQuery, catalog.length]);

  function handleModelListScroll(event: UIEvent<HTMLDivElement>) {
    if (!shouldVirtualizeModels) {
      return;
    }
    const nextStartIndex = Math.min(
      maxModelWindowStartIndex,
      Math.max(0, Math.floor(event.currentTarget.scrollTop / modelVirtualizedRowHeight))
    );
    setModelWindowStartIndex(nextStartIndex);
  }

  function openRuntimeSettings() {
    setSettingsCategory("runtime");
    setPage("settings");
  }

  const filterControls = (
    <Group justify="flex-end" align="flex-end" gap="xs" wrap="wrap">
      <TextInput
        aria-label={t("models.search")}
        leftSection={<IconSearch size={15} aria-hidden="true" />}
        placeholder={t("models.searchPlaceholder")}
        radius="sm"
        size="xs"
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
        style={{ flex: "1 1 220px", maxWidth: 320 }}
      />
      <NativeSelect
        aria-label={t("models.statusFilter")}
        data={[
          { label: t("models.statusFilters.all"), value: "all" },
          { label: t("models.statuses.installed"), value: "installed" },
          { label: t("models.statuses.not_installed"), value: "not_installed" },
          { label: t("models.statuses.downloading"), value: "downloading" },
          { label: t("models.statuses.queued"), value: "queued" },
          { label: t("models.statuses.verifying"), value: "verifying" },
          { label: t("models.statuses.failed"), value: "failed" },
          { label: t("models.statuses.canceled"), value: "canceled" }
        ]}
        radius="sm"
        size="xs"
        value={installStatusFilter}
        onChange={(event) =>
          setInstallStatusFilter(event.currentTarget.value as ModelInstallStatusFilter)
        }
        style={{ width: 188 }}
      />
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
      <Button
        type="button"
        disabled={models.isFetching}
        leftSection={<IconRefresh size={15} aria-hidden="true" />}
        radius="sm"
        size="xs"
        variant="default"
        onClick={() => void models.refetch()}
      >
        {t("models.refresh")}
      </Button>
    </Group>
  );

  function actionFor(model: ModelCatalogEntry) {
    if (model.installation.status === "not_installed") {
      return {
        label: t("models.actions.installModel", { name: model.name }),
        shortLabel: t("models.actionLabels.install"),
        icon: IconDownload,
        color: "teal",
        run: () => downloadModel.mutate(model.modelId)
      };
    }
    if (isModelBusy(model.installation.status)) {
      return {
        label: t("models.actions.cancelModel", { name: model.name }),
        shortLabel: t("models.actionLabels.cancel"),
        icon: IconPlayerStop,
        color: "orange",
        run: () => cancelDownload.mutate(model.modelId)
      };
    }
    if (model.installation.status === "failed" || model.installation.status === "canceled") {
      return {
        label: t("models.actions.retryModel", { name: model.name }),
        shortLabel: t("models.actionLabels.retry"),
        icon: IconRefresh,
        color: "blue",
        run: () => retryDownload.mutate(model.modelId)
      };
    }
    return {
      label: t("models.actions.deleteModel", { name: model.name }),
      shortLabel: t("models.actionLabels.delete"),
      icon: IconTrash,
      color: "red",
      run: () => deleteModel.mutate(model.modelId)
    };
  }

  return (
    <Stack gap="md">
      {showHeader ? (
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={4}>
            <Title order={1}>{t("models.title")}</Title>
            <Text size="sm" c="dimmed">
              {t("models.subtitle")}
            </Text>
          </Stack>
        </Group>
      ) : null}

      <TaskStatusSurface
        busy={models.isLoading || mutationPending}
        message={
          models.isLoading
            ? t("models.loading")
            : models.isError
              ? t("models.catalogUnavailableTitle")
              : mutationPending
                ? t("models.updating")
                : t("models.catalogCount", { count: catalog.length })
        }
        error={error}
      />

      {models.isError ? (
        <Paper role="alert" withBorder radius="md" p="lg" bg={workstationSurfaces.panel}>
          <Stack gap="sm" maw={720}>
            <Stack gap={4}>
              <Text fw={800}>{t("models.catalogUnavailableTitle")}</Text>
              <Text size="sm" c="dimmed">
                {t("models.catalogUnavailableBody")}
              </Text>
            </Stack>
            <Group>
              <Button
                leftSection={<IconSettings size={18} aria-hidden="true" />}
                variant="light"
                color="teal"
                onClick={openRuntimeSettings}
              >
                {t("models.openRuntimeSettings")}
              </Button>
            </Group>
          </Stack>
        </Paper>
      ) : (
        <>
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" gap="md">
              <Stack gap={2}>
                <Title order={2} size="h4">
                  {t("models.recommendedSetup")}
                </Title>
                <Text size="sm" c="dimmed">
                  {t("models.recommendedSetupDescription")}
                </Text>
              </Stack>
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {recommendedModels.map(({ task, model }) => {
                const action = model ? actionFor(model) : null;
                const ActionIconComponent = action?.icon;
                const progress = model ? progressValue(model) : 0;

                return (
                  <Paper key={task} withBorder radius="md" p="md" bg={workstationSurfaces.panel}>
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                        <Stack gap={3} style={{ minWidth: 0 }}>
                          <Text size="xs" fw={800} c="dimmed">
                            {t(`models.recommendedTasks.${task}`)}
                          </Text>
                          <Title order={3} size="h5" style={{ lineHeight: 1.2 }}>
                            {model?.name ?? t("models.recommendedEmpty")}
                          </Title>
                          {model ? (
                            <Text size="xs" c="dimmed" ff="monospace" truncate>
                              {model.modelId}
                            </Text>
                          ) : null}
                        </Stack>
                        {model ? (
                          <Badge color={statusColor(model.installation.status)} variant="light" tt="none">
                            {t(`models.statuses.${model.installation.status}`)}
                          </Badge>
                        ) : null}
                      </Group>

                      {model ? (
                        <>
                          <Group gap={6}>
                            <Badge variant="outline">{t(`models.tasks.${model.task}`)}</Badge>
                            <Badge variant="light" color={model.tier === "light" ? "gray" : "teal"}>
                              {t(`models.tiers.${model.tier}`)}
                            </Badge>
                            <Badge color={availableProfileCount(model) > 0 ? "teal" : "gray"} variant="light">
                              {t("models.profileAvailability", {
                                available: availableProfileCount(model),
                                total: model.runtimeProfiles.length
                              })}
                            </Badge>
                          </Group>
                          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                            <ReadonlyModelDetail
                              label={t("models.table.runtime")}
                              value={model.runtime}
                            />
                            <ReadonlyModelDetail
                              label={t("models.table.languages")}
                              value={languageSupport(model)}
                            />
                            <ReadonlyModelDetail
                              label={t("models.table.size")}
                              value={formatBytes(model.downloadSizeBytes)}
                            />
                          </SimpleGrid>
                          {isModelBusy(model.installation.status) ? (
                            <Stack gap={4}>
                              <Progress value={progress} size="xs" radius="xs" />
                              <Text size="xs" c="dimmed">
                                {formatBytes(model.installation.downloadedBytes)} /{" "}
                                {formatBytes(model.installation.totalBytes)}
                              </Text>
                            </Stack>
                          ) : null}
                          {model.availability.reason ? (
                            <Text size="xs" c={model.availability.usable ? "dimmed" : "orange"}>
                              {displayModelMessage(model.availability.reason, t)}
                            </Text>
                          ) : null}
                          <Group justify="space-between" gap="sm" align="center" mt="auto">
                            <Text size="xs" c="dimmed" style={{ flex: "1 1 220px" }}>
                              {model.recommendedHardware}
                            </Text>
                            {action && ActionIconComponent ? (
                              <Button
                                type="button"
                                aria-label={action.label}
                                color={action.color}
                                disabled={mutationPending}
                                leftSection={<ActionIconComponent size={16} aria-hidden="true" />}
                                loading={mutationPending}
                                radius="sm"
                                size="xs"
                                variant={model.installation.status === "installed" ? "default" : "light"}
                                onClick={action.run}
                              >
                                {action.shortLabel}
                              </Button>
                            ) : null}
                          </Group>
                        </>
                      ) : (
                        <Text size="sm" c="dimmed">
                          {t("models.recommendedEmptyDescription")}
                        </Text>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <Paper withBorder radius="md" p="md" bg={workstationSurfaces.panel}>
              <Text size="xs" fw={800} c="dimmed">
                {t("models.summary.installed")}
              </Text>
              <Title order={3} size="h4">
                {installedCount}/{catalog.length}
              </Title>
            </Paper>
            <Paper withBorder radius="md" p="md" bg={workstationSurfaces.panel}>
              <Text size="xs" fw={800} c="dimmed">
                {t("models.summary.usable")}
              </Text>
              <Title order={3} size="h4">
                {usableCount}
              </Title>
            </Paper>
            <Paper withBorder radius="md" p="md" bg={workstationSurfaces.panel}>
              <Text size="xs" fw={800} c="dimmed">
                {t("models.summary.activeDownloads")}
              </Text>
              <Title order={3} size="h4">
                {activeDownloadCount}
              </Title>
            </Paper>
            <Paper withBorder radius="md" p="md" bg={workstationSurfaces.panel}>
              <Text size="xs" fw={800} c="dimmed">
                {t("models.summary.runtimeProfiles")}
              </Text>
              <Title order={3} size="h4">
                {profileCount}
              </Title>
            </Paper>
          </SimpleGrid>

          <Group justify="space-between" align="center" gap="md">
            <Stack gap={2}>
              <Text fw={800}>{t("models.advancedCatalog")}</Text>
              <Text size="sm" c="dimmed">
                {t("models.advancedCatalogDescription")}
              </Text>
            </Stack>
            <Button
              type="button"
              aria-controls="models-advanced-catalog"
              aria-expanded={catalogOpen}
              color="gray"
              radius="sm"
              rightSection={catalogOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              variant={catalogOpen ? "light" : "default"}
              onClick={() => setCatalogOpen((open) => !open)}
            >
              {t("models.advancedCatalog")}
            </Button>
          </Group>

          {catalogOpen ? (
            <Paper
              id="models-advanced-catalog"
              component="section"
              role="region"
              aria-label={t("models.advancedCatalog")}
              withBorder
              radius="md"
              p="md"
              bg={workstationSurfaces.panel}
            >
              <Box className="diplomat-responsive-split">
                <Stack gap="sm" style={{ minWidth: 0 }}>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Title order={3} size="h5">
                        {t("models.catalog")}
                      </Title>
                      <Text size="xs" fw={700} c="dimmed">
                        {shouldVirtualizeModels
                          ? t("models.visibleCatalogCount", {
                              visible: renderedModels.length,
                              total: filteredModels.length
                            })
                          : `${filteredModels.length}/${catalog.length}`}
                      </Text>
                    </Group>
                    {filterControls}
                  </Stack>

              {filteredModels.length > 0 ? (
                <Box
                  w="100%"
                  maw="100%"
                  onScroll={handleModelListScroll}
                  style={{ overflow: "auto", maxHeight: 620 }}
                >
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
                        {modelTopSpacerHeight > 0 ? (
                          <Table.Tr aria-hidden="true">
                            <Table.Td colSpan={9} p={0} style={{ height: modelTopSpacerHeight }} />
                          </Table.Tr>
                        ) : null}
                        {renderedModels.map((model) => {
                          const action = actionFor(model);
                          const ActionIconComponent = action.icon;
                          const progress = progressValue(model);
                          const selected = selectedModel?.modelId === model.modelId;

                          return (
                            <Table.Tr
                              key={model.modelId}
                              data-testid={`model-row-${model.modelId}`}
                              aria-selected={selected}
                              tabIndex={0}
                              onClick={() => setSelectedModelId(model.modelId)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedModelId(model.modelId);
                                }
                              }}
                              style={{
                                cursor: "pointer",
                                background: selected ? workstationSurfaces.panelAlt : undefined
                              }}
                            >
                              <Table.Td>
                                <Stack gap={2}>
                                  <Text fw={700}>
                                    {selected
                                      ? `${model.name} ${t("models.details.selected")}`
                                      : model.name}
                                  </Text>
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
                                      {displayModelMessage(model.availability.reason, t)}
                                    </Text>
                                  ) : null}
                                  {model.installation.errorMessage ? (
                                    <Text size="xs" c="red">
                                      {displayModelMessage(model.installation.errorMessage, t)}
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
                                <Group gap={4} mt={6}>
                                  <Badge color={availableProfileCount(model) > 0 ? "teal" : "gray"} variant="light">
                                    {t("models.profileAvailability", {
                                      available: availableProfileCount(model),
                                      total: model.runtimeProfiles.length
                                    })}
                                  </Badge>
                                  {model.runtimeProfiles.some((profile) => profile.recommended) ? (
                                    <Badge color="blue" variant="outline">
                                      {t("models.recommendedProfile")}
                                    </Badge>
                                  ) : null}
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                <Tooltip label={action.label} withArrow>
                                  <ActionIcon
                                    aria-label={action.label}
                                    color={action.color}
                                    disabled={mutationPending}
                                    variant="light"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      action.run();
                                    }}
                                  >
                                    <ActionIconComponent size={18} aria-hidden="true" />
                                  </ActionIcon>
                                </Tooltip>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                        {modelBottomSpacerHeight > 0 ? (
                          <Table.Tr aria-hidden="true">
                            <Table.Td colSpan={9} p={0} style={{ height: modelBottomSpacerHeight }} />
                          </Table.Tr>
                        ) : null}
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

            <Box
              component="aside"
              role="complementary"
              aria-label={t("models.details.title")}
              p="md"
              style={{
                border: `1px solid ${workstationSurfaces.outline}`,
                borderRadius: 6,
                background: workstationSurfaces.panelAlt,
                minHeight: 360
              }}
            >
              {selectedModel ? (
                <Stack gap="sm">
                  <Stack gap={4}>
                    <Text size="xs" fw={800} c="dimmed">
                      {t("models.details.title")}
                    </Text>
                    <Title order={3} size="h5">
                      {selectedModel.name}
                    </Title>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {selectedModel.modelId}
                    </Text>
                  </Stack>
                  <Group gap={6}>
                    <Badge color={statusColor(selectedModel.installation.status)} variant="light">
                      {t(`models.statuses.${selectedModel.installation.status}`)}
                    </Badge>
                    <Badge variant="outline">{t(`models.tasks.${selectedModel.task}`)}</Badge>
                  </Group>
                  <Title order={4} size="h6">
                    {t("models.details.packageDetails")}
                  </Title>
                  <Stack gap={8}>
                    <ReadonlyModelDetail label={t("models.table.runtime")} value={selectedModel.runtime} />
                    <ReadonlyModelDetail label={t("models.table.languages")} value={languageSupport(selectedModel)} />
                    <ReadonlyModelDetail label={t("models.table.size")} value={formatBytes(selectedModel.downloadSizeBytes)} />
                    <ReadonlyModelDetail label={t("models.table.license")} value={selectedModel.licenseName} />
                    <ReadonlyModelDetail label={t("models.table.hardware")} value={selectedModel.recommendedHardware} />
                  </Stack>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("models.details.empty")}
                </Text>
              )}
            </Box>
          </Box>
          </Paper>
          ) : null}
        </>
      )}
    </Stack>
  );
}

export function ModelsPage() {
  const { t } = useTranslation();

  return (
    <Box component="main" aria-label={t("models.title")} maw={1240}>
      <ModelsContent />
    </Box>
  );
}

function ReadonlyModelDetail({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={800} c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  );
}
