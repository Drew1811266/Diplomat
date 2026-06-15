import { Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import type { AnalysisJobRequest, ModelCatalogEntry } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type AnalysisInspectorProps = {
  config: AnalysisJobRequest;
  busy: boolean;
  modelCatalog?: ModelCatalogEntry[];
  allowDevelopmentControls?: boolean;
  canCancel?: boolean;
  canRetry?: boolean;
  onConfigChange: (config: AnalysisJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

const analysisProviders: AnalysisJobRequest["provider"][] = ["fake", "faster-whisper"];
const devices: AnalysisJobRequest["device"][] = ["cpu", "cuda"];
const computeTypes: AnalysisJobRequest["computeType"][] = ["int8", "float16", "float32"];

function selectedProfile(model: ModelCatalogEntry | null, device: string, computeType: string) {
  return (
    model?.runtimeProfiles.find(
      (profile) => profile.device === device && profile.computeType === computeType
    ) ?? null
  );
}

export function AnalysisInspector({
  config,
  busy,
  modelCatalog = [],
  allowDevelopmentControls = false,
  canCancel = true,
  canRetry = true,
  onConfigChange,
  onStart,
  onCancel,
  onRetry
}: AnalysisInspectorProps) {
  const { t } = useTranslation();
  const installedAsrModels = modelCatalog.filter(
    (model) =>
      model.task === "asr" &&
      model.installation.status === "installed" &&
      model.availability.usable &&
      Boolean(model.installation.installedPath)
  );
  const installedAsrModelId = installedAsrModels.some(
    (model) => model.modelId === config.modelId
  )
    ? config.modelId ?? ""
    : "";
  const selectedAsrModel =
    installedAsrModels.find((model) => model.modelId === installedAsrModelId) ?? null;
  const runtimeProfile = selectedProfile(selectedAsrModel, config.device, config.computeType);
  const profileBlocksStart = Boolean(runtimeProfile && !runtimeProfile.available);
  const canStart = allowDevelopmentControls
    ? !busy
    : !busy && Boolean(installedAsrModelId) && !profileBlocksStart;

  function updateConfig<Key extends keyof AnalysisJobRequest>(
    key: Key,
    value: AnalysisJobRequest[Key]
  ) {
    onConfigChange({ ...config, [key]: value });
  }

  function selectInstalledModel(modelId: string) {
    if (!modelId) {
      onConfigChange({ ...config, modelId: null, modelNameOrPath: null });
      return;
    }

    onConfigChange({
      ...config,
      provider: "faster-whisper",
      modelId,
      modelNameOrPath: null
    });
  }

  return (
    <Stack gap="sm">
      {allowDevelopmentControls ? (
        <NativeSelect
          label={t("fields.provider")}
          value={config.provider}
          data={analysisProviders}
          disabled={busy}
          onChange={(event) =>
            updateConfig("provider", event.currentTarget.value as AnalysisJobRequest["provider"])
          }
        />
      ) : null}

      {installedAsrModels.length > 0 || !allowDevelopmentControls ? (
        <NativeSelect
          label={t("fields.installedAsrModel")}
          value={installedAsrModelId}
          data={[
            {
              value: "",
              label:
                installedAsrModels.length > 0
                  ? t("inspector.selectModel")
                  : t("inspector.noAsrModelAvailable")
            },
            ...installedAsrModels.map((model) => ({
              value: model.modelId,
              label: model.name
            }))
          ]}
          disabled={busy || installedAsrModels.length === 0}
          onChange={(event) => selectInstalledModel(event.currentTarget.value)}
        />
      ) : (
        <TextInput
          label={t("fields.model")}
          value={config.modelNameOrPath ?? ""}
          disabled={busy}
          onChange={(event) => updateConfig("modelNameOrPath", event.currentTarget.value || null)}
        />
      )}

      {!allowDevelopmentControls && installedAsrModels.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("inspector.installAsrModelFirst")}
        </Text>
      ) : null}

      <TextInput
        label={t("fields.sourceLanguage")}
        value={config.sourceLanguage ?? ""}
        disabled={busy}
        onChange={(event) => updateConfig("sourceLanguage", event.currentTarget.value || null)}
      />

      <Group grow gap="xs" align="flex-start">
        <NativeSelect
          label={t("fields.device")}
          value={config.device}
          data={devices}
          disabled={busy}
          onChange={(event) => updateConfig("device", event.currentTarget.value)}
        />
        <NativeSelect
          label={t("fields.computeType")}
          value={config.computeType}
          data={computeTypes}
          disabled={busy}
          onChange={(event) => updateConfig("computeType", event.currentTarget.value)}
        />
      </Group>
      {runtimeProfile ? (
        <Text size="xs" c={runtimeProfile.available ? "dimmed" : "orange"}>
          {runtimeProfile.available
            ? t("inspector.runtimeProfile", {
                device: runtimeProfile.device,
                computeType: runtimeProfile.computeType,
                batchSize: runtimeProfile.batchSize
              })
            : (runtimeProfile.reason ?? runtimeProfile.notes)}
        </Text>
      ) : null}

      <TextInput
        label={t("fields.initialPrompt")}
        value={config.initialPrompt ?? ""}
        disabled={busy}
        onChange={(event) => updateConfig("initialPrompt", event.currentTarget.value || null)}
      />

      <Group justify="flex-end" gap="xs">
        <Button type="button" size="xs" color="teal" onClick={onStart} disabled={!canStart}>
          {t("actions.start")}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="light"
          color="gray"
          onClick={onCancel}
          disabled={!canCancel}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="light"
          color="gray"
          onClick={onRetry}
          disabled={!canRetry}
        >
          {t("actions.retry")}
        </Button>
      </Group>
    </Stack>
  );
}
