import { Badge, Box, Button, Group, Table, Text } from "@mantine/core";
import { useEffect, useMemo, useState, type KeyboardEvent, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import type { SubtitleLine, TranslationStatus } from "@diplomat/shared";
import { workstationSurfaces } from "../app/theme";
import type { TimingIssue } from "../lib/timingValidation";

export type SubtitleGridFilter = "all" | "missing";

type SubtitleGridProps = {
  lines: SubtitleLine[];
  selectedLineId: string | null;
  activeLineId?: string | null;
  timingIssuesByLineId?: Record<string, TimingIssue[]>;
  filter: SubtitleGridFilter;
  onFilterChange: (filter: SubtitleGridFilter) => void;
  onSelectLine: (lineId: string) => void;
};

const translationStatusColor: Record<TranslationStatus, string> = {
  not_requested: "gray",
  queued: "blue",
  translated: "green",
  edited: "yellow",
  failed: "red"
};
const virtualizedRowThreshold = 120;
const virtualizedWindowSize = 80;
const virtualizedRowHeight = 40;

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    milliseconds
  ).padStart(3, "0")}`;
}

function isMissingTranslation(line: SubtitleLine) {
  return !line.translatedText.trim() || line.translationStatus === "failed";
}

export function SubtitleGrid({
  lines,
  selectedLineId,
  activeLineId = null,
  timingIssuesByLineId = {},
  filter,
  onFilterChange,
  onSelectLine
}: SubtitleGridProps) {
  const { t } = useTranslation();
  const visibleLines = useMemo(
    () => (filter === "missing" ? lines.filter(isMissingTranslation) : lines),
    [filter, lines]
  );
  const shouldVirtualize = visibleLines.length > virtualizedRowThreshold;
  const [virtualStartIndex, setVirtualStartIndex] = useState(0);
  const visibleWindowSize = shouldVirtualize ? virtualizedWindowSize : visibleLines.length;
  const safeVirtualStartIndex = shouldVirtualize
    ? Math.min(virtualStartIndex, Math.max(0, visibleLines.length - visibleWindowSize))
    : 0;
  const renderedLines = shouldVirtualize
    ? visibleLines.slice(safeVirtualStartIndex, safeVirtualStartIndex + visibleWindowSize)
    : visibleLines;
  const topSpacerHeight = shouldVirtualize ? safeVirtualStartIndex * virtualizedRowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, visibleLines.length - safeVirtualStartIndex - renderedLines.length) *
      virtualizedRowHeight
    : 0;

  useEffect(() => {
    setVirtualStartIndex(0);
  }, [filter, lines]);

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, lineId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectLine(lineId);
    }
  }

  function handleGridScroll(event: UIEvent<HTMLDivElement>) {
    if (!shouldVirtualize) {
      return;
    }

    const nextStartIndex = Math.max(
      0,
      Math.floor(event.currentTarget.scrollTop / virtualizedRowHeight)
    );
    if (nextStartIndex !== virtualStartIndex) {
      setVirtualStartIndex(nextStartIndex);
    }
  }

  return (
    <Box
      component="section"
      role="region"
      aria-label={t("subtitleGrid.region")}
      bg={workstationSurfaces.panel}
      style={{
        minHeight: 0,
        borderTop: `1px solid ${workstationSurfaces.outline}`,
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "38px minmax(0, 1fr)"
      }}
    >
      <Group
        h={38}
        px="sm"
        justify="space-between"
        wrap="nowrap"
        style={{ borderBottom: `1px solid ${workstationSurfaces.outline}` }}
      >
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Text id="subtitle-grid-title" size="sm" fw={700} c={workstationSurfaces.text} truncate>
            {t("workbench.subtitleGrid")}
          </Text>
          <Badge size="sm" variant="light" color="gray">
            {t("subtitleGrid.rows", { count: visibleLines.length })}
          </Badge>
        </Group>
        <Group gap={6} wrap="nowrap" aria-label={t("subtitleGrid.filters.label")}>
          <Button
            type="button"
            size="compact-xs"
            variant={filter === "all" ? "filled" : "light"}
            color={filter === "all" ? "teal" : "gray"}
            onClick={() => onFilterChange("all")}
          >
            {t("subtitleGrid.filters.all")}
          </Button>
          <Button
            type="button"
            size="compact-xs"
            variant={filter === "missing" ? "filled" : "light"}
            color={filter === "missing" ? "teal" : "gray"}
            onClick={() => onFilterChange("missing")}
          >
            {t("subtitleGrid.filters.missing")}
          </Button>
        </Group>
      </Group>

      <Box
        data-testid="subtitle-grid-body"
        onScroll={handleGridScroll}
        style={{ minHeight: 0, overflow: "auto" }}
      >
        {visibleLines.length ? (
          <Table
            stickyHeader
            striped
            highlightOnHover
            withColumnBorders
            aria-label={t("workbench.subtitleGrid")}
            verticalSpacing={4}
            horizontalSpacing="xs"
            fz="xs"
            style={{ minWidth: 840 }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={116}>{t("subtitleGrid.columns.id")}</Table.Th>
                <Table.Th w={92}>{t("subtitleGrid.columns.start")}</Table.Th>
                <Table.Th w={92}>{t("subtitleGrid.columns.end")}</Table.Th>
                <Table.Th>{t("subtitleGrid.columns.source")}</Table.Th>
                <Table.Th>{t("subtitleGrid.columns.translation")}</Table.Th>
                <Table.Th w={92}>{t("subtitleGrid.columns.review")}</Table.Th>
                <Table.Th w={118}>{t("subtitleGrid.columns.status")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {topSpacerHeight > 0 ? (
                <Table.Tr aria-hidden="true" style={{ height: topSpacerHeight }}>
                  <Table.Td colSpan={7} p={0} style={{ border: 0 }} />
                </Table.Tr>
              ) : null}
              {renderedLines.map((line) => {
                const selected = line.id === selectedLineId;
                const active = line.id === activeLineId;
                const timingIssues = timingIssuesByLineId[line.id] ?? [];
                const qualityIssues = line.translationQualityIssues;
                const hasIssues = timingIssues.length > 0 || qualityIssues.length > 0;

                return (
                  <Table.Tr
                    key={line.id}
                    data-testid={`subtitle-row-${line.id}`}
                    data-active={active ? "true" : undefined}
                    data-has-issues={hasIssues ? "true" : undefined}
                    aria-selected={selected}
                    tabIndex={0}
                    onClick={() => onSelectLine(line.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, line.id)}
                    style={{
                      cursor: "pointer",
                      background: selected
                        ? "rgba(143, 216, 203, 0.20)"
                        : active
                          ? "rgba(143, 216, 203, 0.10)"
                          : undefined,
                      boxShadow: selected
                        ? "inset 3px 0 0 #0f766e"
                        : active
                          ? "inset 3px 0 0 #14b8a6"
                          : undefined
                    }}
                  >
                    <Table.Td>
                      <Button
                        type="button"
                        size="compact-xs"
                        variant="subtle"
                        color={selected ? "teal" : "gray"}
                        aria-label={t("subtitleGrid.selectLine", { id: line.id })}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectLine(line.id);
                        }}
                      >
                        {line.id}
                      </Button>
                    </Table.Td>
                    <Table.Td ff="monospace">{formatTimestamp(line.startMs)}</Table.Td>
                    <Table.Td ff="monospace">{formatTimestamp(line.endMs)}</Table.Td>
                    <Table.Td style={{ maxWidth: 280, overflowWrap: "anywhere" }}>
                      {line.sourceText || t("subtitleGrid.noSourceText")}
                    </Table.Td>
                    <Table.Td c={line.translatedText ? undefined : "dimmed"} style={{ maxWidth: 280, overflowWrap: "anywhere" }}>
                      {line.translatedText || t("subtitleGrid.noTranslatedText")}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color="gray">
                        {t(`subtitleGrid.reviewStatus.${line.reviewStatus}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="wrap">
                        <Badge size="xs" variant="light" color={translationStatusColor[line.translationStatus]}>
                          {t(`subtitleGrid.translationStatus.${line.translationStatus}`)}
                        </Badge>
                        {timingIssues.length ? (
                          <Badge size="xs" variant="light" color="red">
                            {t("subtitleGrid.timingIssueCount", { count: timingIssues.length })}
                          </Badge>
                        ) : null}
                        {qualityIssues.length ? (
                          <Badge size="xs" variant="light" color="orange">
                            {t("subtitleGrid.translationQualityIssueCount", {
                              count: qualityIssues.length
                            })}
                          </Badge>
                        ) : null}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {bottomSpacerHeight > 0 ? (
                <Table.Tr aria-hidden="true" style={{ height: bottomSpacerHeight }}>
                  <Table.Td colSpan={7} p={0} style={{ border: 0 }} />
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        ) : (
          <Box p="md">
            <Text size="sm" fw={700} c={workstationSurfaces.textMuted}>
              {lines.length ? t("subtitleGrid.noFilterMatches") : t("subtitleGrid.empty")}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
