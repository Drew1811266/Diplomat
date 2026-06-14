import { Button, Group, NativeSelect, Stack, TextInput } from "@mantine/core";
import type { AnalysisJobRequest, ModelCatalogEntry } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type AnalysisInspectorProps = {
  config: AnalysisJobRequest;
  busy: boolean;
  modelCatalog?: ModelCatalogEntry[];
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

export function AnalysisInspector({
  config,
  busy,
  modelCatalog = [],
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
  const installedAsrModelPath = installedAsrModels.some(
    (model) => model.installation.installedPath === config.modelNameOrPath
  )
    ? config.modelNameOrPath ?? ""
    : "";

  function updateConfig<Key extends keyof AnalysisJobRequest>(
    key: Key,
    value: AnalysisJobRequest[Key]
  ) {
    onConfigChange({ ...config, [key]: value });
  }

  function selectInstalledModel(installedPath: string) {
    if (!installedPath) {
      onConfigChange({ ...config, modelNameOrPath: null });
      return;
    }

    onConfigChange({
      ...config,
      provider: "faster-whisper",
      modelNameOrPath: installedPath
    });
  }

  return (
    <Stack gap="sm">
      <NativeSelect
        label={t("fields.provider")}
        value={config.provider}
        data={analysisProviders}
        disabled={busy}
        onChange={(event) =>
          updateConfig("provider", event.currentTarget.value as AnalysisJobRequest["provider"])
        }
      />

      {installedAsrModels.length > 0 ? (
        <NativeSelect
          label={t("fields.installedAsrModel")}
          value={installedAsrModelPath}
          data={[
            { value: "", label: t("inspector.selectModel") },
            ...installedAsrModels.map((model) => ({
              value: model.installation.installedPath ?? "",
              label: model.name
            }))
          ]}
          disabled={busy}
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

      <TextInput
        label={t("fields.initialPrompt")}
        value={config.initialPrompt ?? ""}
        disabled={busy}
        onChange={(event) => updateConfig("initialPrompt", event.currentTarget.value || null)}
      />

      <Group justify="flex-end" gap="xs">
        <Button type="button" size="xs" color="teal" onClick={onStart} disabled={busy}>
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
