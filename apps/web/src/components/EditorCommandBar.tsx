import { ActionIcon, Box, Button, Group, NumberInput, SegmentedControl, Tooltip } from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowsJoin,
  IconArrowsMoveHorizontal,
  IconCut,
  IconHelpCircle
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { workstationSurfaces } from "../app/theme";
import type { OffsetScope } from "../lib/subtitleEditing";

type EditorCommandBarProps = {
  canUndo: boolean;
  canRedo: boolean;
  canEdit: boolean;
  offsetMs: number;
  offsetScope: OffsetScope;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: () => void;
  onMergePrevious: () => void;
  onMergeNext: () => void;
  onOffsetMsChange: (value: number) => void;
  onOffsetScopeChange: (scope: OffsetScope) => void;
  onApplyOffset: () => void;
  onOpenShortcuts: () => void;
};

function CommandIcon({
  label,
  disabled,
  onClick,
  children
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        type="button"
        aria-label={label}
        variant="subtle"
        color="gray"
        size="sm"
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </ActionIcon>
    </Tooltip>
  );
}

export function EditorCommandBar({
  canUndo,
  canRedo,
  canEdit,
  offsetMs,
  offsetScope,
  onUndo,
  onRedo,
  onSplit,
  onMergePrevious,
  onMergeNext,
  onOffsetMsChange,
  onOffsetScopeChange,
  onApplyOffset,
  onOpenShortcuts
}: EditorCommandBarProps) {
  const { t } = useTranslation();

  return (
    <Box
      role="toolbar"
      aria-label={t("editorCommands.toolbar")}
      bg={workstationSurfaces.panelAlt}
      px="sm"
      py={6}
      style={{
        borderBottom: `1px solid ${workstationSurfaces.outline}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        minHeight: 44,
        overflowX: "auto"
      }}
    >
      <Group gap={4} wrap="nowrap">
        <CommandIcon label={t("editorCommands.undo")} disabled={!canUndo} onClick={onUndo}>
          <IconArrowBackUp size={17} aria-hidden />
        </CommandIcon>
        <CommandIcon label={t("editorCommands.redo")} disabled={!canRedo} onClick={onRedo}>
          <IconArrowForwardUp size={17} aria-hidden />
        </CommandIcon>
        <CommandIcon label={t("editorCommands.split")} disabled={!canEdit} onClick={onSplit}>
          <IconCut size={17} aria-hidden />
        </CommandIcon>
        <CommandIcon
          label={t("editorCommands.mergePrevious")}
          disabled={!canEdit}
          onClick={onMergePrevious}
        >
          <IconArrowsJoin size={17} aria-hidden />
        </CommandIcon>
        <CommandIcon
          label={t("editorCommands.mergeNext")}
          disabled={!canEdit}
          onClick={onMergeNext}
        >
          <IconArrowsJoin size={17} aria-hidden style={{ transform: "rotate(180deg)" }} />
        </CommandIcon>
      </Group>

      <Group gap={6} wrap="nowrap">
        <NumberInput
          aria-label={t("editorCommands.offsetMs")}
          value={offsetMs}
          min={-60_000}
          max={60_000}
          step={50}
          size="xs"
          w={112}
          disabled={!canEdit}
          allowDecimal={false}
          onChange={(value) => {
            const nextValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
            onOffsetMsChange(Math.trunc(nextValue));
          }}
        />
        <SegmentedControl
          size="xs"
          aria-label={t("editorCommands.offsetScope")}
          value={offsetScope}
          disabled={!canEdit}
          onChange={(value) => onOffsetScopeChange(value as OffsetScope)}
          data={[
            { label: t("editorCommands.scopes.selected"), value: "selected" },
            { label: t("editorCommands.scopes.all"), value: "all" },
            { label: t("editorCommands.scopes.afterPlayhead"), value: "after_playhead" }
          ]}
        />
        <Button
          type="button"
          size="compact-xs"
          variant="light"
          color="teal"
          leftSection={<IconArrowsMoveHorizontal size={15} aria-hidden />}
          disabled={!canEdit}
          onClick={onApplyOffset}
        >
          {t("editorCommands.applyOffset")}
        </Button>
        <CommandIcon label={t("editorCommands.shortcuts")} onClick={onOpenShortcuts}>
          <IconHelpCircle size={17} aria-hidden />
        </CommandIcon>
      </Group>
    </Box>
  );
}
