import { Box, Stack, Text } from "@mantine/core";
import type {
  AnalysisJobRequest,
  SrtExportMode,
  SrtExportResponse,
  SubtitleLine,
  TranslationJobRequest
} from "@diplomat/shared";
import { useMediaQuery } from "@mantine/hooks";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { InspectorPanel } from "../components/InspectorPanel";
import { AnalysisInspector } from "../components/inspectors/AnalysisInspector";
import { ExportInspector } from "../components/inspectors/ExportInspector";
import { LineInspector } from "../components/inspectors/LineInspector";
import { TranslationInspector } from "../components/inspectors/TranslationInspector";
import { SubtitleGrid, type SubtitleGridFilter } from "../components/SubtitleGrid";
import { TimelineStrip } from "../components/TimelineStrip";
import { TopToolbar } from "../components/TopToolbar";
import { VideoPreviewPanel } from "../components/VideoPreviewPanel";
import { useUiStore } from "../state/uiStore";
import { analyzedDocumentFixture } from "../test/fixtures";

const defaultAnalysisConfig: AnalysisJobRequest = {
  provider: "fake",
  modelNameOrPath: null,
  device: "cpu",
  computeType: "int8",
  sourceLanguage: null,
  initialPrompt: null
};

const defaultTranslationConfig: TranslationJobRequest = {
  provider: "fake",
  sourceLanguage: "zh",
  targetLanguage: "en",
  mode: "missing_only",
  endpoint: null,
  apiKeyEnv: null
};

export function WorkbenchPage() {
  const { t } = useTranslation();
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const inspectorMode = useUiStore((state) => state.inspectorMode);
  const setInspectorMode = useUiStore((state) => state.setInspectorMode);
  const selectedLineId = useUiStore((state) => state.selectedLineId);
  const setSelectedLineId = useUiStore((state) => state.setSelectedLineId);
  const [subtitleDocument, setSubtitleDocument] = useState(analyzedDocumentFixture);
  const [subtitleFilter, setSubtitleFilter] = useState<SubtitleGridFilter>("all");
  const [analysisConfig, setAnalysisConfig] = useState(defaultAnalysisConfig);
  const [translationConfig, setTranslationConfig] = useState(defaultTranslationConfig);
  const [exportMode, setExportMode] = useState<SrtExportMode>("bilingual");
  const [exportResult, setExportResult] = useState<SrtExportResponse | null>(null);
  const layout = isNarrow ? "stacked" : "split";
  const canExport = subtitleDocument.lines.length > 0;
  const selectedLine = useMemo(
    () => subtitleDocument.lines.find((line) => line.id === selectedLineId) ?? null,
    [selectedLineId, subtitleDocument.lines]
  );

  function updateLine(nextLine: SubtitleLine) {
    setSubtitleDocument((currentDocument) => ({
      ...currentDocument,
      lines: currentDocument.lines.map((line) => (line.id === nextLine.id ? nextLine : line))
    }));
  }

  function handleExport() {
    setExportResult({
      projectId: analyzedDocumentFixture.projectId,
      exportPath: `fixture-${exportMode}.srt`,
      mode: exportMode
    });
  }

  function renderInspectorContent() {
    if (inspectorMode === "line") {
      return (
        <LineInspector
          line={selectedLine}
          busy={false}
          onChangeLine={updateLine}
          onSave={() => undefined}
        />
      );
    }

    if (inspectorMode === "analysis") {
      return (
        <AnalysisInspector
          config={analysisConfig}
          busy={false}
          onConfigChange={setAnalysisConfig}
          onStart={() => undefined}
          onCancel={() => undefined}
          onRetry={() => undefined}
        />
      );
    }

    if (inspectorMode === "translation") {
      return (
        <TranslationInspector
          config={translationConfig}
          busy={false}
          onConfigChange={setTranslationConfig}
          onStart={() => undefined}
          onCancel={() => undefined}
          onRetry={() => undefined}
        />
      );
    }

    if (inspectorMode === "export") {
      return (
        <ExportInspector
          mode={exportMode}
          result={exportResult}
          canExport={canExport}
          disabledReason={canExport ? null : t("inspector.exportDisabledNoLines")}
          busy={false}
          onModeChange={setExportMode}
          onExport={handleExport}
        />
      );
    }

    return (
      <Stack gap="sm">
        <Text size="sm" c="#334155">
          {t("status.ready")}
        </Text>
      </Stack>
    );
  }

  return (
    <Box
      component="main"
      aria-label={t("workbench.title")}
      bg="#e9edf2"
      style={{
        height: "calc(100vh - 84px)",
        minHeight: 620,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        borderRadius: 6
      }}
    >
      <TopToolbar
        canSave={false}
        canExport={canExport}
        onInspectorMode={setInspectorMode}
        onSave={() => undefined}
      />

      <Box
        data-testid="workbench-body"
        data-layout={layout}
        style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) 320px",
          gridTemplateRows: isNarrow ? "minmax(0, 1fr) minmax(260px, 40vh)" : undefined,
          minHeight: 0,
          overflow: isNarrow ? "auto" : "hidden"
        }}
      >
        <Box
          style={{
            display: "grid",
            gridTemplateRows: "minmax(240px, 45vh) minmax(0, 1fr) auto",
            minHeight: 0
          }}
        >
          <Box p="md" bg="#111827" style={{ minHeight: 0 }}>
            <VideoPreviewPanel sourceVideoPath={null} selectedLine={selectedLine} />
          </Box>

          <SubtitleGrid
            lines={subtitleDocument.lines}
            selectedLineId={selectedLineId}
            filter={subtitleFilter}
            onFilterChange={setSubtitleFilter}
            onSelectLine={setSelectedLineId}
          />

          <TimelineStrip durationMs={subtitleDocument.durationMs} lineCount={subtitleDocument.lines.length} />
        </Box>

        <InspectorPanel mode={inspectorMode} layout={isNarrow ? "stacked" : "side"}>
          {renderInspectorContent()}
        </InspectorPanel>
      </Box>
    </Box>
  );
}
