import { Badge, Button, Group, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SubtitleLine } from "@diplomat/shared";

type LineInspectorProps = {
  line: SubtitleLine | null;
  busy: boolean;
  onChangeLine: (line: SubtitleLine) => void;
  onSave: (pendingLine?: SubtitleLine) => void;
};

function toInteger(value: number | string, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

export function LineInspector({ line, busy, onChangeLine, onSave }: LineInspectorProps) {
  const { t } = useTranslation();
  const [sourceDraft, setSourceDraft] = useState(line?.sourceText ?? "");
  const [translatedDraft, setTranslatedDraft] = useState(line?.translatedText ?? "");
  const committedDraftRef = useRef({
    lineId: line?.id ?? null,
    sourceText: line?.sourceText ?? "",
    translatedText: line?.translatedText ?? ""
  });

  useEffect(() => {
    setSourceDraft(line?.sourceText ?? "");
    setTranslatedDraft(line?.translatedText ?? "");
    committedDraftRef.current = {
      lineId: line?.id ?? null,
      sourceText: line?.sourceText ?? "",
      translatedText: line?.translatedText ?? ""
    };
  }, [line?.id, line?.sourceText, line?.translatedText]);

  function pendingTextLine() {
    if (!line) {
      return null;
    }

    const committed = committedDraftRef.current;
    const sourceChanged = sourceDraft !== committed.sourceText;
    const translationChanged = translatedDraft !== committed.translatedText;
    if (!sourceChanged && !translationChanged) {
      return null;
    }

    return {
      ...line,
      sourceText: sourceDraft,
      translatedText: translatedDraft,
      translationStatus: translationChanged ? "edited" : line.translationStatus,
      translationError: translationChanged ? null : line.translationError
    };
  }

  function commitTextDrafts() {
    const nextLine = pendingTextLine();
    if (!nextLine) {
      return null;
    }

    committedDraftRef.current = {
      lineId: nextLine.id,
      sourceText: nextLine.sourceText,
      translatedText: nextLine.translatedText
    };
    onChangeLine(nextLine);
    return nextLine;
  }

  function handleSave() {
    onSave(commitTextDrafts() ?? undefined);
  }

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
        value={sourceDraft}
        disabled={busy}
        onBlur={commitTextDrafts}
        onChange={(event) => setSourceDraft(event.currentTarget.value)}
      />

      <Textarea
        label={t("fields.translatedText")}
        minRows={5}
        value={translatedDraft}
        disabled={busy}
        onBlur={commitTextDrafts}
        onChange={(event) => setTranslatedDraft(event.currentTarget.value)}
      />

      <Group justify="flex-end">
        <Button type="button" size="xs" color="teal" onClick={handleSave} disabled={busy}>
          {t("actions.save")}
        </Button>
      </Group>
    </Stack>
  );
}
