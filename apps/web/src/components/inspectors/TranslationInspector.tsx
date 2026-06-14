import { Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import type { ModelCatalogEntry, TranslationJobRequest } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type TranslationInspectorProps = {
  config: TranslationJobRequest;
  busy: boolean;
  modelCatalog?: ModelCatalogEntry[];
  selectedModelId?: string | null;
  canCancel?: boolean;
  canRetry?: boolean;
  onSelectedModelChange?: (modelId: string | null) => void;
  onConfigChange: (config: TranslationJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

const translationProviders: TranslationJobRequest["provider"][] = ["fake", "libretranslate"];
const translationModes: TranslationJobRequest["mode"][] = ["missing_only", "overwrite_all"];

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
  const translationModels = modelCatalog.filter((model) => model.task === "translation");
  const selectedModel =
    translationModels.find((model) => model.modelId === selectedModelId) ?? null;
  const selectedModelBlockMessage = selectedModel
    ? selectedModel.availability.usable
      ? t("inspector.localTranslationPending")
      : t("inspector.translationModelUnavailable")
    : null;
  const hasModelBlock = Boolean(selectedModelBlockMessage);

  function updateConfig<Key extends keyof TranslationJobRequest>(
    key: Key,
    value: TranslationJobRequest[Key]
  ) {
    onConfigChange({ ...config, [key]: value });
  }

  function handleStart() {
    if (!hasLanguageErrors && !hasModelBlock) {
      onStart();
    }
  }

  function handleRetry() {
    if (!hasLanguageErrors && !hasModelBlock) {
      onRetry();
    }
  }

  return (
    <Stack gap="sm">
      <NativeSelect
        label={t("fields.provider")}
        value={config.provider}
        data={translationProviders}
        disabled={busy}
        onChange={(event) =>
          updateConfig("provider", event.currentTarget.value as TranslationJobRequest["provider"])
        }
      />

      {translationModels.length > 0 ? (
        <Stack gap={4}>
          <NativeSelect
            label={t("fields.translationModel")}
            value={selectedModelId ?? ""}
            data={[
              { value: "", label: t("inspector.selectModel") },
              ...translationModels.map((model) => ({
                value: model.modelId,
                label: model.name
              }))
            ]}
            disabled={busy}
            onChange={(event) =>
              onSelectedModelChange?.(event.currentTarget.value || null)
            }
          />
          {selectedModelBlockMessage ? (
            <Text size="xs" c={selectedModel?.availability.usable ? "dimmed" : "orange"}>
              {selectedModelBlockMessage}
            </Text>
          ) : null}
          {selectedModel?.availability.reason ? (
            <Text size="xs" c="dimmed">
              {selectedModel.availability.reason}
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

      <Group justify="flex-end" gap="xs">
        <Button
          type="button"
          size="xs"
          color="teal"
          onClick={handleStart}
          disabled={busy || hasLanguageErrors || hasModelBlock}
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
          disabled={!canRetry || hasLanguageErrors || hasModelBlock}
        >
          {t("actions.retry")}
        </Button>
      </Group>
    </Stack>
  );
}
