import { Box, Stack, Text } from "@mantine/core";
import type {
  AnalysisJobRequest,
  SrtExportMode,
  SrtExportResponse,
  SubtitleDocument,
  SubtitleLine,
  TaskResponse,
  TranslationJobRequest
} from "@diplomat/shared";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";
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
import { useExportSrtMutation } from "../queries/exportQueries";
import { useProjectQuery } from "../queries/projectQueries";
import {
  useSaveSubtitleDocumentMutation,
  useSubtitleDocumentQuery
} from "../queries/subtitleQueries";
import {
  isTaskActive,
  useCreateAnalysisJobMutation,
  useCreateTranslationJobMutation
} from "../queries/taskQueries";
import { useUiStore } from "../state/uiStore";

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

const emptySubtitleLines: SubtitleLine[] = [];
const taskActiveExportReason = "Wait for analysis or translation to finish.";

export function WorkbenchPage() {
  const { t } = useTranslation();
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const activeProjectId = useUiStore((state) => state.activeProjectId);
  const inspectorMode = useUiStore((state) => state.inspectorMode);
  const setInspectorMode = useUiStore((state) => state.setInspectorMode);
  const selectedLineId = useUiStore((state) => state.selectedLineId);
  const setSelectedLineId = useUiStore((state) => state.setSelectedLineId);
  const project = useProjectQuery(activeProjectId);
  const subtitle = useSubtitleDocumentQuery(activeProjectId);
  const saveSubtitle = useSaveSubtitleDocumentMutation(activeProjectId);
  const createAnalysisJob = useCreateAnalysisJobMutation(activeProjectId);
  const createTranslationJob = useCreateTranslationJobMutation(activeProjectId);
  const exportSrt = useExportSrtMutation(activeProjectId);
  const [draftDocument, setDraftDocument] = useState<SubtitleDocument | null>(null);
  const [subtitleFilter, setSubtitleFilter] = useState<SubtitleGridFilter>("all");
  const [analysisConfig, setAnalysisConfig] = useState(defaultAnalysisConfig);
  const [translationConfig, setTranslationConfig] = useState(defaultTranslationConfig);
  const [exportMode, setExportMode] = useState<SrtExportMode>("bilingual");
  const [exportResult, setExportResult] = useState<SrtExportResponse | null>(null);
  const [latestTask, setLatestTask] = useState<TaskResponse | null>(null);
  const subtitleDocument = draftDocument ?? subtitle.data ?? null;
  const subtitleLines = subtitleDocument?.lines ?? emptySubtitleLines;
  const hasUnsavedChanges = Boolean(draftDocument);
  const layout = isNarrow ? "stacked" : "split";
  const hasSubtitleRows = subtitleLines.length > 0;
  const taskActive =
    isTaskActive(latestTask) || createAnalysisJob.isPending || createTranslationJob.isPending;
  const canExport = Boolean(
    activeProjectId && subtitleDocument && hasSubtitleRows && !hasUnsavedChanges && !taskActive
  );
  const exportDisabledReason = canExport
    ? null
    : taskActive
      ? taskActiveExportReason
      : hasUnsavedChanges
        ? t("inspector.exportDisabledUnsaved")
        : activeProjectId
          ? t("inspector.exportDisabledNoLines")
          : t("workbench.noProject");
  const selectedLine = useMemo(
    () => subtitleLines.find((line) => line.id === selectedLineId) ?? null,
    [selectedLineId, subtitleLines]
  );

  useEffect(() => {
    setDraftDocument(null);
  }, [activeProjectId, subtitle.dataUpdatedAt]);

  useEffect(() => {
    setExportResult(null);
    setLatestTask(null);
  }, [activeProjectId]);

  function updateLine(nextLine: SubtitleLine) {
    if (!subtitleDocument) {
      return;
    }

    setDraftDocument((currentDraft) => {
      const sourceDocument = currentDraft ?? subtitleDocument;

      return {
        ...sourceDocument,
        lines: sourceDocument.lines.map((line) => (line.id === nextLine.id ? nextLine : line))
      };
    });
  }

  async function handleSave() {
    if (!draftDocument || !activeProjectId) {
      return;
    }

    try {
      await saveSubtitle.mutateAsync(draftDocument);
      setDraftDocument(null);
      void subtitle.refetch();
    } catch {
      // Keep the draft in place so the user can retry a failed save.
    }
  }

  async function handleStartAnalysis() {
    if (!activeProjectId) {
      return;
    }

    try {
      setLatestTask(await createAnalysisJob.mutateAsync(analysisConfig));
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleStartTranslation() {
    if (!activeProjectId) {
      return;
    }

    try {
      setLatestTask(await createTranslationJob.mutateAsync(translationConfig));
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleExport() {
    if (!canExport) {
      return;
    }

    try {
      setExportResult(await exportSrt.mutateAsync(exportMode));
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  function renderInspectorContent() {
    if (inspectorMode === "line") {
      return (
        <LineInspector
          line={selectedLine}
          busy={saveSubtitle.isPending}
          onChangeLine={updateLine}
          onSave={() => void handleSave()}
        />
      );
    }

    if (inspectorMode === "analysis") {
      return (
        <AnalysisInspector
          config={analysisConfig}
          busy={!activeProjectId || taskActive}
          onConfigChange={setAnalysisConfig}
          onStart={() => void handleStartAnalysis()}
          onCancel={() => undefined}
          onRetry={() => undefined}
        />
      );
    }

    if (inspectorMode === "translation") {
      return (
        <TranslationInspector
          config={translationConfig}
          busy={!activeProjectId || taskActive}
          onConfigChange={setTranslationConfig}
          onStart={() => void handleStartTranslation()}
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
          disabledReason={exportDisabledReason}
          busy={exportSrt.isPending}
          onModeChange={setExportMode}
          onExport={() => void handleExport()}
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
        canSave={hasUnsavedChanges && !saveSubtitle.isPending}
        canExport={Boolean(activeProjectId)}
        onInspectorMode={setInspectorMode}
        onSave={() => void handleSave()}
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
            <VideoPreviewPanel
              sourceVideoPath={activeProjectId ? project.data?.sourceVideoPath ?? null : null}
              selectedLine={selectedLine}
            />
          </Box>

          <SubtitleGrid
            lines={subtitleLines}
            selectedLineId={selectedLineId}
            filter={subtitleFilter}
            onFilterChange={setSubtitleFilter}
            onSelectLine={setSelectedLineId}
          />

          <TimelineStrip
            durationMs={subtitleDocument?.durationMs ?? project.data?.durationMs ?? 0}
            lineCount={subtitleLines.length}
          />
        </Box>

        <InspectorPanel mode={inspectorMode} layout={isNarrow ? "stacked" : "side"}>
          {renderInspectorContent()}
        </InspectorPanel>
      </Box>
    </Box>
  );
}
