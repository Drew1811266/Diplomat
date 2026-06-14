import { Badge, Box, Button, Group, Stack, Text } from "@mantine/core";
import { IconCamera, IconHistory, IconRotateClockwise, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { SubtitleDraftResponse, SubtitleSnapshotSummary } from "@diplomat/shared";

type RecoveryPanelProps = {
  draft: SubtitleDraftResponse | null;
  snapshots: SubtitleSnapshotSummary[];
  busy: boolean;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
};

function snapshotLabel(snapshot: SubtitleSnapshotSummary) {
  return snapshot.label || snapshot.reason.replaceAll("_", " ");
}

export function RecoveryPanel({
  draft,
  snapshots,
  busy,
  onRestoreDraft,
  onDiscardDraft,
  onCreateSnapshot,
  onRestoreSnapshot
}: RecoveryPanelProps) {
  const { t } = useTranslation();
  const visibleSnapshots = snapshots.slice(0, 5);

  if (!draft && visibleSnapshots.length === 0) {
    return null;
  }

  return (
    <Box
      component="section"
      role="region"
      aria-label={t("recovery.region")}
      px="sm"
      py={6}
      bg="#f8fafc"
      style={{
        borderBottom: "1px solid #dbe3ec",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 8,
        alignItems: "center"
      }}
    >
      <Stack gap={4} style={{ minWidth: 0 }}>
        {draft ? (
          <Group gap="xs" wrap="wrap">
            <Badge size="sm" color="yellow" variant="light">
              {t("recovery.autosavedDraft")}
            </Badge>
            <Text size="xs" c="#475569">
              {t("recovery.draftMeta", { count: draft.lineCount, updatedAt: draft.updatedAt })}
            </Text>
          </Group>
        ) : null}
        {visibleSnapshots.length ? (
          <Group gap={6} wrap="wrap">
            <Text size="xs" fw={700} c="#334155">
              {t("recovery.snapshots")}
            </Text>
            {visibleSnapshots.map((snapshot) => {
              const label = snapshotLabel(snapshot);
              return (
                <Button
                  key={snapshot.snapshotId}
                  type="button"
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconHistory size={14} aria-hidden />}
                  aria-label={t("recovery.restoreSnapshot", { label })}
                  disabled={busy}
                  onClick={() => onRestoreSnapshot(snapshot.snapshotId)}
                >
                  {label}
                </Button>
              );
            })}
          </Group>
        ) : null}
      </Stack>

      <Group gap={6} wrap="nowrap">
        {draft ? (
          <>
            <Button
              type="button"
              size="compact-xs"
              color="teal"
              variant="light"
              leftSection={<IconRotateClockwise size={14} aria-hidden />}
              disabled={busy}
              onClick={onRestoreDraft}
            >
              {t("recovery.restoreDraft")}
            </Button>
            <Button
              type="button"
              size="compact-xs"
              color="red"
              variant="subtle"
              leftSection={<IconTrash size={14} aria-hidden />}
              disabled={busy}
              onClick={onDiscardDraft}
            >
              {t("recovery.discardDraft")}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          size="compact-xs"
          color="gray"
          variant="light"
          leftSection={<IconCamera size={14} aria-hidden />}
          disabled={busy}
          onClick={onCreateSnapshot}
        >
          {t("recovery.createSnapshot")}
        </Button>
      </Group>
    </Box>
  );
}
