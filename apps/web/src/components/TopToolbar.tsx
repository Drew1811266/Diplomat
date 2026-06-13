import { ActionIcon, Button, Group, Tooltip } from "@mantine/core";
import {
  IconDeviceFloppy,
  IconFileExport,
  IconLanguage,
  IconMovie,
  IconSparkles
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { InspectorMode } from "../state/uiStore";

type TopToolbarProps = {
  canSave: boolean;
  canExport?: boolean;
  onInspectorMode: (mode: InspectorMode) => void;
  onSave: () => void;
};

export function TopToolbar({
  canSave,
  canExport = true,
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
      bg="#f8fafc"
      style={{
        borderBottom: "1px solid #cbd5e1",
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
        >
          {t("toolbar.import")}
        </Button>
        <Button
          type="button"
          variant="light"
          color="teal"
          size="xs"
          leftSection={<IconSparkles size={16} aria-hidden />}
          onClick={() => onInspectorMode("analysis")}
        >
          {t("toolbar.analyze")}
        </Button>
        <Button
          type="button"
          variant="subtle"
          color="gray"
          size="xs"
          leftSection={<IconLanguage size={16} aria-hidden />}
          onClick={() => onInspectorMode("translation")}
        >
          {t("toolbar.translate")}
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
