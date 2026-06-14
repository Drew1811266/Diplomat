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
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { InspectorPanel } from "../components/InspectorPanel";
import { AnalysisInspector } from "../components/inspectors/AnalysisInspector";
import { ExportInspector } from "../components/inspectors/ExportInspector";
import { LineInspector } from "../components/inspectors/LineInspector";
import { TranslationInspector } from "../components/inspectors/TranslationInspector";
import { SubtitleGrid, type SubtitleGridFilter } from "../components/SubtitleGrid";
import { TaskStatusSurface } from "../components/TaskStatusSurface";
import { TimelineStrip } from "../components/TimelineStrip";
import { TopToolbar } from "../components/TopToolbar";
import { VideoPreviewPanel } from "../components/VideoPreviewPanel";
import { useExportSrtMutation } from "../queries/exportQueries";
import { useModelsQuery } from "../queries/modelQueries";
import { useProjectQuery } from "../queries/projectQueries";
import {
  useSaveSubtitleDocumentMutation,
  useSubtitleDocumentQuery
} from "../queries/subtitleQueries";
import {
  isTaskActive,
  useCancelTaskMutation,
  useCreateAnalysisJobMutation,
  useTaskQuery,
  useCreateTranslationJobMutation,
  useRetryTaskMutation
} from "../queries/taskQueries";
import { useUiStore } from "../state/uiStore";

const defaultAnalysisConfig: AnalysisJobRequest = {
  provider: "faster-whisper",
  modelId: null,
  modelNameOrPath: null,
  device: "cuda",
  computeType: "float16",
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function StatusNotice({
  title,
  message,
  tone = "info"
}: {
  title: string;
  message?: string | null;
  tone?: "info" | "error";
}) {
  return (
    <Box
      role={tone === "error" ? "alert" : "status"}
      p="sm"
      bg={tone === "error" ? "#fef2f2" : "#f8fafc"}
      style={{
        borderTop: "1px solid #cbd5e1",
        borderBottom: "1px solid #e2e8f0"
      }}
    >
      <Text size="sm" fw={800} c={tone === "error" ? "red" : "#334155"}>
        {title}
      </Text>
      {message ? (
        <Text size="sm" c={tone === "error" ? "red" : "dimmed"}>
          {message}
        </Text>
      ) : null}
    </Box>
  );
}

function ErrorMessage({ error }: { error: unknown }) {
  const message = getErrorMessage(error);

  return message ? <StatusNotice title={message} tone="error" /> : null;
}

export function WorkbenchPage() {
  const { t } = useTranslation();
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const activeProjectId = useUiStore((state) => state.activeProjectId);
  const setPage = useUiStore((state) => state.setPage);
  const inspectorMode = useUiStore((state) => state.inspectorMode);
  const setInspectorMode = useUiStore((state) => state.setInspectorMode);
  const selectedLineId = useUiStore((state) => state.selectedLineId);
  const setSelectedLineId = useUiStore((state) => state.setSelectedLineId);
  const project = useProjectQuery(activeProjectId);
  const subtitle = useSubtitleDocumentQuery(activeProjectId);
  const models = useModelsQuery(Boolean(activeProjectId));
  const saveSubtitle = useSaveSubtitleDocumentMutation(activeProjectId);
  const createAnalysisJob = useCreateAnalysisJobMutation(activeProjectId);
  const createTranslationJob = useCreateTranslationJobMutation(activeProjectId);
  const cancelTask = useCancelTaskMutation();
  const retryTask = useRetryTaskMutation();
  const exportSrt = useExportSrtMutation(activeProjectId);
  const [draftDocument, setDraftDocument] = useState<SubtitleDocument | null>(null);
  const [subtitleFilter, setSubtitleFilter] = useState<SubtitleGridFilter>("all");
  const [analysisConfig, setAnalysisConfig] = useState(defaultAnalysisConfig);
  const [translationConfig, setTranslationConfig] = useState(defaultTranslationConfig);
  const [selectedTranslationModelId, setSelectedTranslationModelId] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<SrtExportMode>("bilingual");
  const [exportResult, setExportResult] = useState<SrtExportResponse | null>(null);
  const [latestTask, setLatestTask] = useState<TaskResponse | null>(null);
  const [latestTaskId, setLatestTaskId] = useState<string | null>(null);
  const task = useTaskQuery(latestTaskId);
  const refetchedTaskId = useRef<string | null>(null);
  const polledTask = task.data;
  const subtitleDocument = draftDocument ?? subtitle.data ?? null;
  const subtitleLines = subtitleDocument?.lines ?? emptySubtitleLines;
  const modelCatalog = models.data?.models ?? [];
  const hasUnsavedChanges = Boolean(draftDocument);
  const layout = isNarrow ? "stacked" : "split";
  const hasSubtitleRows = subtitleLines.length > 0;
  const observedTask = polledTask ?? latestTask;
  const taskOperationPending = cancelTask.isPending || retryTask.isPending;
  const taskActive =
    isTaskActive(observedTask) ||
    createAnalysisJob.isPending ||
    createTranslationJob.isPending ||
    taskOperationPending;
  const canCancelTask = Boolean(observedTask && isTaskActive(observedTask) && !cancelTask.isPending);
  const canRetryCurrentTask = Boolean(
    observedTask &&
      (observedTask.status === "failed" || observedTask.status === "canceled") &&
      !retryTask.isPending
  );
  const canRetryAnalysisTask = Boolean(canRetryCurrentTask && observedTask?.type === "analysis");
  const canRetryTranslationTask = Boolean(
    canRetryCurrentTask && observedTask?.type === "translation"
  );
  const taskStatusMessage = observedTask
    ? `${t(`status.${observedTask.status}`)} · ${observedTask.message} · ${Math.round(
        observedTask.progress * 100
      )}%`
    : t("status.ready");
  const taskStatusError =
    observedTask?.errorMessage ??
    getErrorMessage(task.error) ??
    getErrorMessage(cancelTask.error) ??
    getErrorMessage(retryTask.error);
  const hasProjectError = project.isError;
  const hasSubtitleError = subtitle.isError;
  const dataBlocked = project.isPending || subtitle.isPending || hasProjectError || hasSubtitleError;
  const canExport = Boolean(
    activeProjectId &&
      subtitleDocument &&
      hasSubtitleRows &&
      !hasUnsavedChanges &&
      !taskActive &&
      !dataBlocked
  );
  const exportDisabledReason = canExport
    ? null
    : taskActive
      ? t("inspector.exportDisabledTaskActive")
      : hasUnsavedChanges
        ? t("inspector.exportDisabledUnsaved")
        : hasProjectError || hasSubtitleError
          ? t("inspector.exportDisabledDataError")
        : activeProjectId
          ? t("inspector.exportDisabledNoLines")
          : t("workbench.noProject");
  const selectedLine = useMemo(
    () => subtitleLines.find((line) => line.id === selectedLineId) ?? null,
    [selectedLineId, subtitleLines]
  );

  useEffect(() => {
    setDraftDocument(null);
  }, [activeProjectId]);

  useEffect(() => {
    setExportResult(null);
    setLatestTask(null);
    setLatestTaskId(null);
    refetchedTaskId.current = null;
    setSelectedTranslationModelId(null);
  }, [activeProjectId]);

  useEffect(() => {
    const finishedTask = polledTask;
    if (
      !finishedTask ||
      finishedTask.status !== "completed" ||
      refetchedTaskId.current === finishedTask.taskId
    ) {
      return;
    }

    refetchedTaskId.current = finishedTask.taskId;
    if (finishedTask.type === "analysis" || finishedTask.type === "translation") {
      void subtitle.refetch();
    }
  }, [polledTask, subtitle.refetch]);

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
      const nextTask = await createAnalysisJob.mutateAsync(analysisConfig);
      setLatestTask(nextTask);
      setLatestTaskId(nextTask.taskId);
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleStartTranslation() {
    if (!activeProjectId) {
      return;
    }

    try {
      const nextTask = await createTranslationJob.mutateAsync(translationConfig);
      setLatestTask(nextTask);
      setLatestTaskId(nextTask.taskId);
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleCancelTask() {
    if (!observedTask || !isTaskActive(observedTask)) {
      return;
    }

    try {
      const nextTask = await cancelTask.mutateAsync(observedTask.taskId);
      setLatestTask(nextTask);
      setLatestTaskId(nextTask.taskId);
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleRetryTask(config: AnalysisJobRequest | TranslationJobRequest) {
    if (
      !observedTask ||
      (observedTask.status !== "failed" && observedTask.status !== "canceled")
    ) {
      return;
    }

    try {
      const nextTask = await retryTask.mutateAsync({
        taskId: observedTask.taskId,
        config
      });
      refetchedTaskId.current = null;
      setLatestTask(nextTask);
      setLatestTaskId(nextTask.taskId);
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
        <Stack gap="sm">
          <ErrorMessage error={saveSubtitle.error} />
          <LineInspector
            line={selectedLine}
            busy={saveSubtitle.isPending}
            onChangeLine={updateLine}
            onSave={() => void handleSave()}
          />
        </Stack>
      );
    }

    if (inspectorMode === "analysis") {
      return (
        <Stack gap="sm">
          <ErrorMessage error={createAnalysisJob.error} />
          <AnalysisInspector
            config={analysisConfig}
            busy={!activeProjectId || taskActive}
            modelCatalog={modelCatalog}
            canCancel={canCancelTask}
            canRetry={canRetryAnalysisTask}
            onConfigChange={setAnalysisConfig}
            onStart={() => void handleStartAnalysis()}
            onCancel={() => void handleCancelTask()}
            onRetry={() => void handleRetryTask(analysisConfig)}
          />
        </Stack>
      );
    }

    if (inspectorMode === "translation") {
      return (
        <Stack gap="sm">
          <ErrorMessage error={createTranslationJob.error} />
          <TranslationInspector
            config={translationConfig}
            busy={!activeProjectId || taskActive}
            modelCatalog={modelCatalog}
            selectedModelId={selectedTranslationModelId}
            canCancel={canCancelTask}
            canRetry={canRetryTranslationTask}
            onSelectedModelChange={setSelectedTranslationModelId}
            onConfigChange={setTranslationConfig}
            onStart={() => void handleStartTranslation()}
            onCancel={() => void handleCancelTask()}
            onRetry={() => void handleRetryTask(translationConfig)}
          />
        </Stack>
      );
    }

    if (inspectorMode === "export") {
      return (
        <Stack gap="sm">
          <ErrorMessage error={exportSrt.error} />
          <ExportInspector
            mode={exportMode}
            result={exportResult}
            canExport={canExport}
            disabledReason={exportDisabledReason}
            busy={exportSrt.isPending}
            onModeChange={setExportMode}
            onExport={() => void handleExport()}
          />
        </Stack>
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

  function renderDataNotice() {
    if (!activeProjectId) {
      return null;
    }

    if (project.isPending) {
      return <StatusNotice title={t("workbench.loadingProject")} />;
    }

    if (project.isError) {
      return (
        <StatusNotice
          title={t("workbench.projectLoadError")}
          message={getErrorMessage(project.error)}
          tone="error"
        />
      );
    }

    if (subtitle.isPending) {
      return <StatusNotice title={t("workbench.loadingSubtitle")} />;
    }

    if (subtitle.isError) {
      return (
        <StatusNotice
          title={t("workbench.subtitleLoadError")}
          message={getErrorMessage(subtitle.error)}
          tone="error"
        />
      );
    }

    if (subtitle.data && subtitle.data.lines.length === 0) {
      return <StatusNotice title={t("workbench.noDocument")} />;
    }

    return null;
  }

  const dataNotice = renderDataNotice();

  return (
    <Box
      component="main"
      aria-label={t("workbench.title")}
      bg="#e9edf2"
      style={{
        height: "calc(100vh - 84px)",
        minHeight: 620,
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr)",
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        borderRadius: 6
      }}
    >
      <TopToolbar
        canSave={hasUnsavedChanges && !saveSubtitle.isPending}
        canExport={Boolean(activeProjectId)}
        onImport={() => setPage("projects")}
        onInspectorMode={setInspectorMode}
        onSave={() => void handleSave()}
      />

      <Box
        px="sm"
        py={4}
        bg="#ffffff"
        style={{
          borderBottom: "1px solid #dbe3ec"
        }}
      >
        <TaskStatusSurface
          busy={taskActive}
          message={taskStatusMessage}
          error={taskStatusError}
        />
      </Box>

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

          <Box
            style={{
              display: "grid",
              gridTemplateRows: dataNotice ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
              minHeight: 0,
              overflow: "hidden"
            }}
          >
            {dataNotice}
            <SubtitleGrid
              lines={subtitleLines}
              selectedLineId={selectedLineId}
              filter={subtitleFilter}
              onFilterChange={setSubtitleFilter}
              onSelectLine={setSelectedLineId}
            />
          </Box>

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
