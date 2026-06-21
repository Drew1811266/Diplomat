import { ActionIcon, Button, Group, Tooltip } from "@mantine/core";
import {
  IconDeviceFloppy,
  IconFileExport,
  IconMovie
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { workstationSurfaces } from "../app/theme";
import type { InspectorMode } from "../state/uiStore";

type TopToolbarProps = {
  canSave: boolean;
  canExport?: boolean;
  onImport?: () => void;
  onInspectorMode: (mode: InspectorMode) => void;
  onSave: () => void;
};

export function TopToolbar({
  canSave,
  canExport = true,
  onImport,
  onInspectorMode,
  onSave
}: TopToolbarProps) {
  const { t } = useTranslation();

  return (
    <Group
      role="toolbar"
      aria-label={t("workbench.labels.projectTools")}
      justify="space-between"
      gap="xs"
      wrap="nowrap"
      px="sm"
      py={6}
      bg={workstationSurfaces.panelAlt}
      style={{
        borderBottom: `1px solid ${workstationSurfaces.outline}`,
        minHeight: 44
      }}
    >
      <Group gap={6} wrap="nowrap">
        <Button
          type="button"
          variant="subtle"
          color="gray"
          size="xs"
          leftSection={<IconMovie size={16} aria-hidden />}
          disabled={!onImport}
          onClick={onImport}
        >
          {t("toolbar.import")}
        </Button>
      </Group>

      <Group gap={6} wrap="nowrap">
        <Tooltip label={t("toolbar.save")} withArrow>
          <ActionIcon
            type="button"
            aria-label={t("toolbar.save")}
            variant={canSave ? "filled" : "subtle"}
            color={canSave ? "teal" : "gray"}
            size="sm"
            disabled={!canSave}
            onClick={onSave}
          >
            <IconDeviceFloppy size={17} aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Button
          type="button"
          variant="subtle"
          color="gray"
          size="xs"
          leftSection={<IconFileExport size={16} aria-hidden />}
          disabled={!canExport}
          onClick={() => onInspectorMode("export")}
        >
          {t("toolbar.export")}
        </Button>
      </Group>
    </Group>
  );
}
