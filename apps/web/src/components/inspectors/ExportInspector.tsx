import { Button, NativeSelect, Stack, Text } from "@mantine/core";
import type { SrtExportMode, SrtExportResponse } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type ExportInspectorProps = {
  mode: SrtExportMode;
  result: SrtExportResponse | null;
  canExport: boolean;
  disabledReason: string | null;
  busy: boolean;
  onModeChange: (mode: SrtExportMode) => void;
  onExport: () => void;
};

const exportModes: SrtExportMode[] = ["source", "target", "bilingual"];

export function ExportInspector({
  mode,
  result,
  canExport,
  disabledReason,
  busy,
  onModeChange,
  onExport
}: ExportInspectorProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="sm">
      <NativeSelect
        label={t("fields.exportMode")}
        value={mode}
        data={exportModes.map((exportMode) => ({
          value: exportMode,
          label: t(`exportModes.${exportMode}`)
        }))}
        disabled={busy}
        onChange={(event) => onModeChange(event.currentTarget.value as SrtExportMode)}
      />

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
          {t("inspector.exportResult", { exportPath: result.exportPath })}
        </Text>
      ) : null}
    </Stack>
  );
}
