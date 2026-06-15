import { Badge, Button, Group, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { SubtitleLine } from "@diplomat/shared";

type LineInspectorProps = {
  line: SubtitleLine | null;
  busy: boolean;
  onChangeLine: (line: SubtitleLine) => void;
  onSave: () => void;
};

function toInteger(value: number | string, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

export function LineInspector({ line, busy, onChangeLine, onSave }: LineInspectorProps) {
  const { t } = useTranslation();

  if (!line) {
    return (
      <Text size="sm" c="#475569">
        {t("inspector.emptyLine")}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" ff="monospace" fw={800} c="#0f172a" truncate>
          {line.id}
        </Text>
        <Badge size="sm" variant="light" color={line.translationStatus === "failed" ? "red" : "teal"}>
          {t(`subtitleGrid.translationStatus.${line.translationStatus}`)}
        </Badge>
      </Group>

      {line.translationQualityIssues.length ? (
        <Stack gap={4}>
          <Text size="xs" fw={800} c="orange">
            {t("inspector.translationQualityIssues")}
          </Text>
          {line.translationQualityIssues.map((issue, index) => (
            <Text key={`${issue.code}-${issue.termId ?? index}`} size="xs" c="#92400e">
              {issue.message}
            </Text>
          ))}
        </Stack>
      ) : null}

      <Group grow gap="xs" align="flex-start">
        <NumberInput
          label={t("fields.startMs")}
          min={0}
          value={line.startMs}
          disabled={busy}
          clampBehavior="strict"
          onChange={(value) => onChangeLine({ ...line, startMs: toInteger(value, line.startMs) })}
        />
        <NumberInput
          label={t("fields.endMs")}
          min={0}
          value={line.endMs}
          disabled={busy}
          clampBehavior="strict"
          onChange={(value) => onChangeLine({ ...line, endMs: toInteger(value, line.endMs) })}
        />
      </Group>

      <Textarea
        label={t("fields.sourceText")}
        minRows={5}
        value={line.sourceText}
        disabled={busy}
        onChange={(event) => onChangeLine({ ...line, sourceText: event.currentTarget.value })}
      />

      <Textarea
        label={t("fields.translatedText")}
        minRows={5}
        value={line.translatedText}
        disabled={busy}
        onChange={(event) =>
          onChangeLine({
            ...line,
            translatedText: event.currentTarget.value,
            translationStatus: "edited",
            translationError: null
          })
        }
      />

      <Group justify="flex-end">
        <Button type="button" size="xs" color="teal" onClick={onSave} disabled={busy}>
          {t("actions.save")}
        </Button>
      </Group>
    </Stack>
  );
}
