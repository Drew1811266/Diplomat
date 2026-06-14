import { Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import type { ModelCatalogEntry, TranslationJobRequest } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type TranslationInspectorProps = {
  config: TranslationJobRequest;
  busy: boolean;
  modelCatalog?: ModelCatalogEntry[];
  selectedModelId?: string | null;
  allowDevelopmentControls?: boolean;
  canCancel?: boolean;
  canRetry?: boolean;
  onSelectedModelChange?: (modelId: string | null) => void;
  onConfigChange: (config: TranslationJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

const translationProviders: TranslationJobRequest["provider"][] = [
  "fake",
  "libretranslate",
  "ct2-marian",
  "local-llm"
];
const translationModes: TranslationJobRequest["mode"][] = ["missing_only", "overwrite_all"];
const devices: TranslationJobRequest["device"][] = ["cpu", "cuda"];
const computeTypes: TranslationJobRequest["computeType"][] = ["int8", "float16", "float32"];

function getLanguageError(value: string, requiredMessage: string, lengthMessage: string) {
  if (value.length === 0) {
    return requiredMessage;
  }

  if (value.length < 2 || value.length > 12) {
    return lengthMessage;
  }

  return null;
}

export function TranslationInspector({
  config,
  busy,
  modelCatalog = [],
  selectedModelId = null,
  allowDevelopmentControls = false,
  canCancel = true,
  canRetry = true,
  onSelectedModelChange,
  onConfigChange,
  onStart,
  onCancel,
  onRetry
}: TranslationInspectorProps) {
  const { t } = useTranslation();
  const languageLengthError = t("validation.languageCodeLength");
  const sourceLanguageError = getLanguageError(
    config.sourceLanguage,
    t("validation.requiredField", { field: t("fields.sourceLanguage") }),
    languageLengthError
  );
  const targetLanguageError = getLanguageError(
    config.targetLanguage,
    t("validation.requiredField", { field: t("fields.targetLanguage") }),
    languageLengthError
  );
  const hasLanguageErrors = Boolean(sourceLanguageError || targetLanguageError);
  const installedTranslationModels = modelCatalog.filter(
    (model) =>
      model.task === "translation" &&
      model.installation.status === "installed" &&
      model.availability.usable &&
      Boolean(model.installation.installedPath)
  );
  const activeModelId = config.modelId ?? selectedModelId ?? null;
  const selectedModel =
    installedTranslationModels.find((model) => model.modelId === activeModelId) ?? null;
  const selectedModelSupportsPair = Boolean(
    selectedModel?.languagePairs.some(
      ([sourceLanguage, targetLanguage]) =>
        sourceLanguage === config.sourceLanguage && targetLanguage === config.targetLanguage
    )
  );
  const hasModelBlock = allowDevelopmentControls
    ? false
    : !selectedModel || !selectedModelSupportsPair;
  const canUseConfig = !hasLanguageErrors && !hasModelBlock;
  const canStart = !busy && canUseConfig;

  function updateConfig<Key extends keyof TranslationJobRequest>(
    key: Key,
    value: TranslationJobRequest[Key]
  ) {
    onConfigChange({ ...config, [key]: value });
  }

  function handleStart() {
    if (canStart) {
      onStart();
    }
  }

  function handleRetry() {
    if (canUseConfig) {
      onRetry();
    }
  }

  function selectInstalledModel(modelId: string) {
    onSelectedModelChange?.(modelId || null);
    if (!modelId) {
      onConfigChange({ ...config, modelId: null, modelNameOrPath: null });
      return;
    }

    const model = installedTranslationModels.find((item) => item.modelId === modelId);
    if (!model) {
      return;
    }
    const [sourceLanguage, targetLanguage] = model.languagePairs[0] ?? [
      config.sourceLanguage,
      config.targetLanguage
    ];
    onConfigChange({
      ...config,
      provider: model.provider as TranslationJobRequest["provider"],
      modelId,
      modelNameOrPath: null,
      sourceLanguage,
      targetLanguage
    });
  }

  return (
    <Stack gap="sm">
      {allowDevelopmentControls ? (
        <NativeSelect
          label={t("fields.provider")}
          value={config.provider}
          data={translationProviders}
          disabled={busy}
          onChange={(event) =>
            updateConfig("provider", event.currentTarget.value as TranslationJobRequest["provider"])
          }
        />
      ) : null}

      {installedTranslationModels.length > 0 || !allowDevelopmentControls ? (
        <Stack gap={4}>
          <NativeSelect
            label={t("fields.translationModel")}
            value={selectedModel?.modelId ?? ""}
            data={[
              {
                value: "",
                label:
                  installedTranslationModels.length > 0
                    ? t("inspector.selectModel")
                    : t("inspector.noTranslationModelAvailable")
              },
              ...installedTranslationModels.map((model) => ({
                value: model.modelId,
                label: model.name
              }))
            ]}
            disabled={busy || installedTranslationModels.length === 0}
            onChange={(event) => selectInstalledModel(event.currentTarget.value)}
          />
          {!allowDevelopmentControls && installedTranslationModels.length === 0 ? (
            <Text size="xs" c="dimmed">
              {t("inspector.installTranslationModelFirst")}
            </Text>
          ) : null}
          {!allowDevelopmentControls && selectedModel && !selectedModelSupportsPair ? (
            <Text size="xs" c="orange">
              {t("inspector.translationPairUnsupported")}
            </Text>
          ) : null}
        </Stack>
      ) : null}

      <Group grow gap="xs" align="flex-start">
        <TextInput
          label={t("fields.sourceLanguage")}
          value={config.sourceLanguage}
          error={sourceLanguageError}
          disabled={busy}
          onChange={(event) => updateConfig("sourceLanguage", event.currentTarget.value)}
        />
        <TextInput
          label={t("fields.targetLanguage")}
          value={config.targetLanguage}
          error={targetLanguageError}
          disabled={busy}
          onChange={(event) => updateConfig("targetLanguage", event.currentTarget.value)}
        />
      </Group>

      <NativeSelect
        label={t("fields.translationMode")}
        value={config.mode}
        data={translationModes.map((mode) => ({
          value: mode,
          label: t(`translationModes.${mode}`)
        }))}
        disabled={busy}
        onChange={(event) =>
          updateConfig("mode", event.currentTarget.value as TranslationJobRequest["mode"])
        }
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

      {allowDevelopmentControls ? (
        <>
          <TextInput
            label={t("fields.endpoint")}
            value={config.endpoint ?? ""}
            disabled={busy}
            onChange={(event) => updateConfig("endpoint", event.currentTarget.value || null)}
          />

          <TextInput
            label={t("fields.apiKeyEnv")}
            value={config.apiKeyEnv ?? ""}
            disabled={busy}
            onChange={(event) => updateConfig("apiKeyEnv", event.currentTarget.value || null)}
          />
        </>
      ) : null}

      <Group justify="flex-end" gap="xs">
        <Button
          type="button"
          size="xs"
          color="teal"
          onClick={handleStart}
          disabled={!canStart}
        >
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
          onClick={handleRetry}
          disabled={!canRetry || !canUseConfig}
        >
          {t("actions.retry")}
        </Button>
      </Group>
    </Stack>
  );
}
