import {
  Button,
  ColorInput,
  Group,
  NativeSelect,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput
} from "@mantine/core";
import type {
  ExportValidationIssue,
  StylePreset,
  SubtitleExportFormat,
  SubtitleExportMode,
  SubtitleExportResponse,
  SubtitleStyle,
  TaskResponse
} from "@diplomat/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type VisibleExportIssue = Omit<ExportValidationIssue, "message"> & {
  message?: string;
};

type ExportInspectorProps = {
  surface?: "combined" | "style" | "delivery";
  format: SubtitleExportFormat;
  mode: SubtitleExportMode;
  result: SubtitleExportResponse | null;
  canExport: boolean;
  disabledReason: string | null;
  busy: boolean;
  validationIssues?: VisibleExportIssue[];
  style: SubtitleStyle;
  presets?: StylePreset[];
  activePresetId?: string | null;
  presetBusy?: boolean;
  showSafeArea?: boolean;
  latestTask?: TaskResponse | null;
  canCancelTask?: boolean;
  canRetryTask?: boolean;
  exportsDir?: string | null;
  onFormatChange: (format: SubtitleExportFormat) => void;
  onModeChange: (mode: SubtitleExportMode) => void;
  onStyleChange: (style: SubtitleStyle) => void;
  onCreatePreset?: (name: string, style: SubtitleStyle) => void;
  onUpdatePreset?: (presetId: string, input: { name?: string; style?: SubtitleStyle }) => void;
  onDeletePreset?: (presetId: string) => void;
  onApplyPreset?: (presetId: string) => void;
  onShowSafeAreaChange?: (showSafeArea: boolean) => void;
  onExport: () => void;
  onBurnInExport?: () => void;
  onCancelTask?: () => void;
  onRetryTask?: () => void;
  onOpenExportsFolder?: () => void;
};

const exportFormats: SubtitleExportFormat[] = ["srt", "vtt", "ass"];
const exportModes: SubtitleExportMode[] = ["source", "target", "bilingual"];
const alignments = ["left", "center", "right"];
const bilingualLayouts = ["source-above-target", "target_top"];

export function ExportInspector({
  surface = "combined",
  format,
  mode,
  result,
  canExport,
  disabledReason,
  busy,
  validationIssues = [],
  style,
  presets = [],
  activePresetId = null,
  presetBusy = false,
  showSafeArea = false,
  latestTask = null,
  canCancelTask = false,
  canRetryTask = false,
  exportsDir = null,
  onFormatChange,
  onModeChange,
  onStyleChange,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onApplyPreset,
  onShowSafeAreaChange,
  onExport,
  onBurnInExport,
  onCancelTask,
  onRetryTask,
  onOpenExportsFolder
}: ExportInspectorProps) {
  const { t } = useTranslation();
  const [selectedPresetId, setSelectedPresetId] = useState(activePresetId ?? presets[0]?.id ?? "");
  const [presetName, setPresetName] = useState("");
  const errors = validationIssues.filter((issue) => issue.severity === "error");
  const warnings = validationIssues.filter((issue) => issue.severity === "warning");
  const presetActionDisabled = presetBusy || !selectedPresetId;
  const exportTask = latestTask?.type === "export" ? latestTask : null;
  const exportTaskProgress = exportTask ? Math.round(exportTask.progress * 100) : 0;
  const showDeliveryControls = surface !== "style";
  const showStyleControls = surface !== "delivery";

  useEffect(() => {
    setSelectedPresetId(activePresetId ?? presets[0]?.id ?? "");
  }, [activePresetId, presets]);

  function patchStyle(update: Partial<SubtitleStyle>) {
    onStyleChange({ ...style, ...update });
  }

  return (
    <Stack gap="sm">
      {showDeliveryControls ? (
        <>
          <NativeSelect
            label={t("fields.exportFormat")}
            value={format}
            data={exportFormats.map((exportFormat) => ({
              value: exportFormat,
              label: t(`exportFormats.${exportFormat}`)
            }))}
            disabled={busy}
            onChange={(event) => onFormatChange(event.currentTarget.value as SubtitleExportFormat)}
          />

          <NativeSelect
            label={t("fields.exportMode")}
            value={mode}
            data={exportModes.map((exportMode) => ({
              value: exportMode,
              label: t(`exportModes.${exportMode}`)
            }))}
            disabled={busy}
            onChange={(event) => onModeChange(event.currentTarget.value as SubtitleExportMode)}
          />

          <Stack gap={4}>
            {errors.length > 0 ? (
              <Text size="sm" c="red">
                {t("validation.exportErrors", { count: errors.length })}
              </Text>
            ) : null}
            {warnings.length > 0 ? (
              <Text size="sm" c="yellow.8">
                {t("validation.exportWarnings", { count: warnings.length })}
              </Text>
            ) : null}
          </Stack>
        </>
      ) : null}

      {showStyleControls ? (
        <>
          <Stack gap="xs">
            <NativeSelect
              label={t("stylePresets.select")}
              value={selectedPresetId}
              data={presets.map((preset) => ({ value: preset.id, label: preset.name }))}
              disabled={presetBusy || presets.length === 0}
              onChange={(event) => setSelectedPresetId(event.currentTarget.value)}
            />
            <Group gap="xs" wrap="nowrap">
              <Button
                type="button"
                size="compact-xs"
                variant="light"
                disabled={presetActionDisabled}
                onClick={() => onApplyPreset?.(selectedPresetId)}
              >
                {t("stylePresets.apply")}
              </Button>
              <Button
                type="button"
                size="compact-xs"
                variant="light"
                disabled={presetActionDisabled}
                onClick={() => onUpdatePreset?.(selectedPresetId, { style })}
              >
                {t("stylePresets.update")}
              </Button>
              <Button
                type="button"
                size="compact-xs"
                variant="subtle"
                color="red"
                disabled={presetActionDisabled}
                onClick={() => onDeletePreset?.(selectedPresetId)}
              >
                {t("stylePresets.delete")}
              </Button>
            </Group>
            <Group gap="xs" wrap="nowrap" align="end">
              <TextInput
                label={t("stylePresets.name")}
                value={presetName}
                size="xs"
                style={{ flex: 1 }}
                onChange={(event) => setPresetName(event.currentTarget.value)}
              />
              <Button
                type="button"
                size="compact-xs"
                disabled={presetBusy || !presetName.trim()}
                onClick={() => {
                  const name = presetName.trim();
                  if (name) {
                    onCreatePreset?.(name, { ...style, name });
                    setPresetName("");
                  }
                }}
              >
                {t("stylePresets.save")}
              </Button>
              <Button
                type="button"
                size="compact-xs"
                variant="light"
                disabled={presetActionDisabled || !presetName.trim()}
                onClick={() => onUpdatePreset?.(selectedPresetId, { name: presetName.trim() })}
              >
                {t("stylePresets.rename")}
              </Button>
            </Group>
          </Stack>

          <SimpleGrid cols={2} spacing="xs">
            <TextInput
              label={t("styleEditor.fontFamily")}
              value={style.fontFamily}
              size="xs"
              onChange={(event) => patchStyle({ fontFamily: event.currentTarget.value })}
            />
            <NumberInput
              label={t("styleEditor.fontSize")}
              value={style.fontSize}
              size="xs"
              min={8}
              max={144}
              onChange={(value) => patchStyle({ fontSize: Number(value) || style.fontSize })}
            />
            <ColorInput
              label={t("styleEditor.primaryColor")}
              value={style.primaryColor}
              size="xs"
              onChange={(value) => patchStyle({ primaryColor: value })}
            />
            <ColorInput
              label={t("styleEditor.secondaryColor")}
              value={style.secondaryColor}
              size="xs"
              onChange={(value) => patchStyle({ secondaryColor: value })}
            />
            <NumberInput
              label={t("styleEditor.outline")}
              value={style.strokeWidth}
              size="xs"
              min={0}
              max={12}
              onChange={(value) => patchStyle({ strokeWidth: Number(value) || 0 })}
            />
            <NumberInput
              label={t("styleEditor.shadow")}
              value={style.shadow}
              size="xs"
              min={0}
              max={12}
              onChange={(value) => patchStyle({ shadow: Number(value) || 0 })}
            />
            <NativeSelect
              label={t("styleEditor.alignment")}
              value={style.alignment}
              data={alignments.map((alignment) => ({
                value: alignment,
                label: t(`styleEditor.alignments.${alignment}`)
              }))}
              onChange={(event) => patchStyle({ alignment: event.currentTarget.value })}
            />
            <NumberInput
              label={t("styleEditor.marginV")}
              value={style.marginV}
              size="xs"
              min={0}
              max={400}
              onChange={(value) => patchStyle({ marginV: Number(value) || 0 })}
            />
            <NumberInput
              label={t("styleEditor.lineSpacing")}
              value={style.lineSpacing}
              size="xs"
              min={0.8}
              max={2}
              step={0.05}
              onChange={(value) => patchStyle({ lineSpacing: Number(value) || style.lineSpacing })}
            />
            <NativeSelect
              label={t("styleEditor.bilingualLayout")}
              value={style.bilingualLayout}
              data={bilingualLayouts.map((layout) => ({
                value: layout,
                label: t(`styleEditor.bilingualLayouts.${layout}`)
              }))}
              onChange={(event) => patchStyle({ bilingualLayout: event.currentTarget.value })}
            />
            <ColorInput
              label={t("styleEditor.backgroundColor")}
              value={style.backgroundColor}
              size="xs"
              onChange={(value) => patchStyle({ backgroundColor: value })}
            />
            <NumberInput
              label={t("styleEditor.safeAreaMargin")}
              value={style.safeAreaMargin}
              size="xs"
              min={0}
              max={240}
              onChange={(value) => patchStyle({ safeAreaMargin: Number(value) || 0 })}
            />
          </SimpleGrid>

          <Group gap="md">
            <Switch
              label={t("styleEditor.backgroundBar")}
              checked={style.backgroundBar}
              onChange={(event) => patchStyle({ backgroundBar: event.currentTarget.checked })}
            />
            <Switch
              label={t("styleEditor.safeArea")}
              checked={showSafeArea}
              onChange={(event) => onShowSafeAreaChange?.(event.currentTarget.checked)}
            />
          </Group>
        </>
      ) : null}

      {showDeliveryControls ? (
        <>
          <Button type="button" size="xs" color="teal" onClick={onExport} disabled={busy || !canExport}>
            {t("toolbar.export")}
          </Button>

          {disabledReason ? (
            <Text size="sm" c="red">
              {disabledReason}
            </Text>
          ) : null}

          {result ? (
            <Text size="sm" c="teal">
              {t("inspector.exportResult", {
                format: t(`exportFormats.${result.format}`),
                exportPath: result.exportPath
              })}
            </Text>
          ) : null}

          <Stack gap="xs">
            <Button
              type="button"
              size="xs"
              variant="light"
              color="blue"
              onClick={onBurnInExport}
              disabled={busy || !canExport || !onBurnInExport}
            >
              {t("videoExport.render")}
            </Button>

            {exportTask ? (
              <Stack gap={4}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="sm" fw={700} c="dimmed">
                    {exportTask.message}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {exportTaskProgress}%
                  </Text>
                </Group>
                <Group gap="xs">
                  {canCancelTask ? (
                    <Button type="button" size="compact-xs" variant="light" onClick={onCancelTask}>
                      {t("videoExport.cancel")}
                    </Button>
                  ) : null}
                  {canRetryTask ? (
                    <Button type="button" size="compact-xs" variant="light" onClick={onRetryTask}>
                      {t("videoExport.retry")}
                    </Button>
                  ) : null}
                </Group>
                {exportTask.errorMessage ? (
                  <Text size="sm" c="red">
                    {exportTask.errorMessage}
                  </Text>
                ) : null}
              </Stack>
            ) : null}

            {exportsDir && onOpenExportsFolder ? (
              <Button type="button" size="compact-xs" variant="subtle" onClick={onOpenExportsFolder}>
                {t("videoExport.openExportsFolder")}
              </Button>
            ) : null}
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}
