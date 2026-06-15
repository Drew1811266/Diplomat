import {
  ActionIcon,
  Button,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import type { ModelCatalogEntry, TranslationJobRequest } from "@diplomat/shared";
import { IconPlus, IconTrash } from "@tabler/icons-react";
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
type TranslationGlossaryEntry = TranslationJobRequest["glossary"][number];

function getLanguageError(value: string, requiredMessage: string, lengthMessage: string) {
  if (value.length === 0) {
    return requiredMessage;
  }

  if (value.length < 2 || value.length > 12) {
    return lengthMessage;
  }

  return null;
}

function selectedProfile(model: ModelCatalogEntry | null, device: string, computeType: string) {
  return (
    model?.runtimeProfiles.find(
      (profile) => profile.device === device && profile.computeType === computeType
    ) ?? null
  );
}

function nextGlossaryId(
  glossary: TranslationGlossaryEntry[],
  sourceLanguage: string,
  targetLanguage: string
) {
  const prefix = `${sourceLanguage}-${targetLanguage}-term`;
  let index = glossary.length + 1;
  while (glossary.some((entry) => entry.id === `${prefix}-${index}`)) {
    index += 1;
  }
  return `${prefix}-${index}`;
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
  const runtimeProfile = selectedProfile(selectedModel, config.device, config.computeType);
  const profileBlocksStart = Boolean(runtimeProfile && !runtimeProfile.available);
  const hasGlossaryErrors = config.glossary.some(
    (entry) => !entry.sourceText.trim() || !entry.targetText.trim()
  );
  const canUseConfig =
    !hasLanguageErrors && !hasModelBlock && !profileBlocksStart && !hasGlossaryErrors;
  const canStart = !busy && canUseConfig;

  function updateConfig<Key extends keyof TranslationJobRequest>(
    key: Key,
    value: TranslationJobRequest[Key]
  ) {
    onConfigChange({ ...config, [key]: value });
  }

  function updateSourceLanguage(value: string) {
    onConfigChange({
      ...config,
      sourceLanguage: value,
      glossary: config.glossary.map((entry) => ({ ...entry, sourceLanguage: value }))
    });
  }

  function updateTargetLanguage(value: string) {
    onConfigChange({
      ...config,
      targetLanguage: value,
      glossary: config.glossary.map((entry) => ({ ...entry, targetLanguage: value }))
    });
  }

  function addGlossaryEntry() {
    onConfigChange({
      ...config,
      glossary: [
        ...config.glossary,
        {
          id: nextGlossaryId(config.glossary, config.sourceLanguage, config.targetLanguage),
          sourceText: "",
          targetText: "",
          sourceLanguage: config.sourceLanguage,
          targetLanguage: config.targetLanguage,
          caseSensitive: false
        }
      ]
    });
  }

  function updateGlossaryEntry(index: number, patch: Partial<TranslationGlossaryEntry>) {
    onConfigChange({
      ...config,
      glossary: config.glossary.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      )
    });
  }

  function removeGlossaryEntry(index: number) {
    onConfigChange({
      ...config,
      glossary: config.glossary.filter((_, currentIndex) => currentIndex !== index)
    });
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
      targetLanguage,
      glossary: config.glossary.map((entry) => ({
        ...entry,
        sourceLanguage,
        targetLanguage
      }))
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
          onChange={(event) => updateSourceLanguage(event.currentTarget.value)}
        />
        <TextInput
          label={t("fields.targetLanguage")}
          value={config.targetLanguage}
          error={targetLanguageError}
          disabled={busy}
          onChange={(event) => updateTargetLanguage(event.currentTarget.value)}
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

      <Stack gap={6}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="sm" fw={700} c="#0f172a">
            {t("fields.glossary")}
          </Text>
          <Button
            type="button"
            size="compact-xs"
            variant="light"
            color="teal"
            leftSection={<IconPlus size={14} aria-hidden />}
            onClick={addGlossaryEntry}
            disabled={busy || hasLanguageErrors}
          >
            {t("actions.addTerm")}
          </Button>
        </Group>
        {config.glossary.length ? (
          config.glossary.map((entry, index) => (
            <Group key={entry.id} gap="xs" align="flex-start" wrap="nowrap">
              <TextInput
                label={t("fields.sourceTerm")}
                value={entry.sourceText}
                error={
                  entry.sourceText.trim()
                    ? null
                    : t("validation.requiredField", { field: t("fields.sourceTerm") })
                }
                disabled={busy}
                style={{ flex: 1 }}
                onChange={(event) =>
                  updateGlossaryEntry(index, { sourceText: event.currentTarget.value })
                }
              />
              <TextInput
                label={t("fields.targetTerm")}
                value={entry.targetText}
                error={
                  entry.targetText.trim()
                    ? null
                    : t("validation.requiredField", { field: t("fields.targetTerm") })
                }
                disabled={busy}
                style={{ flex: 1 }}
                onChange={(event) =>
                  updateGlossaryEntry(index, { targetText: event.currentTarget.value })
                }
              />
              <Tooltip label={t("actions.removeTerm")}>
                <ActionIcon
                  type="button"
                  aria-label={t("actions.removeTerm")}
                  variant="light"
                  color="red"
                  mt={24}
                  disabled={busy}
                  onClick={() => removeGlossaryEntry(index)}
                >
                  <IconTrash size={16} aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))
        ) : (
          <Text size="xs" c="dimmed">
            {t("inspector.emptyGlossary")}
          </Text>
        )}
      </Stack>

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
