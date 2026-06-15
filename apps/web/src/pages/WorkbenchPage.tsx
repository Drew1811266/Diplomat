import { Box, Button, Group, Kbd, Modal, Stack, Text } from "@mantine/core";
import type {
  AnalysisJobRequest,
  BurnInExportRequest,
  SubtitleExportFormat,
  SubtitleExportMode,
  SubtitleExportResponse,
  SubtitleDocument,
  SubtitleLine,
  TaskResponse,
  TranslationJobRequest
} from "@diplomat/shared";
import { useMediaQuery } from "@mantine/hooks";
import { IconWaveSine } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { projectMediaUrl } from "../api";
import { openPathInFileManager } from "../desktop";
import { InspectorPanel } from "../components/InspectorPanel";
import { EditorCommandBar } from "../components/EditorCommandBar";
import { AnalysisInspector } from "../components/inspectors/AnalysisInspector";
import { ExportInspector } from "../components/inspectors/ExportInspector";
import { LineInspector } from "../components/inspectors/LineInspector";
import { TranslationInspector } from "../components/inspectors/TranslationInspector";
import { RecoveryPanel } from "../components/RecoveryPanel";
import { SubtitleGrid, type SubtitleGridFilter } from "../components/SubtitleGrid";
import { TaskStatusSurface } from "../components/TaskStatusSurface";
import { TimelineEditor } from "../components/TimelineEditor";
import { TimelineStrip } from "../components/TimelineStrip";
import { TopToolbar } from "../components/TopToolbar";
import { VideoPreviewPanel } from "../components/VideoPreviewPanel";
import {
  isEditableShortcutTarget,
  mergeSubtitleLine,
  offsetSubtitleLines,
  redoHistory,
  splitSubtitleLine,
  undoHistory,
  updateHistory,
  type OffsetScope
} from "../lib/subtitleEditing";
import {
  defaultSubtitleStyle,
  hasBlockingTimingIssues,
  subtitleStyleWithDefaults
} from "../lib/subtitleStyles";
import { validateSubtitleTiming } from "../lib/timingValidation";
import { useSubtitleExportMutation } from "../queries/exportQueries";
import { useModelsQuery } from "../queries/modelQueries";
import { useProjectQuery } from "../queries/projectQueries";
import {
  useApplyStylePresetMutation,
  useCreateStylePresetMutation,
  useDeleteStylePresetMutation,
  useStylePresetsQuery,
  useUpdateStylePresetMutation
} from "../queries/stylePresetQueries";
import {
  useCreateSubtitleSnapshotMutation,
  useDeleteSubtitleDraftMutation,
  useRestoreSubtitleSnapshotMutation,
  useSaveSubtitleDocumentMutation,
  useSaveSubtitleDraftMutation,
  useSubtitleDocumentQuery,
  useSubtitleDraftQuery,
  useSubtitleSnapshotsQuery
} from "../queries/subtitleQueries";
import {
  isTaskActive,
  useCancelTaskMutation,
  useCreateAnalysisJobMutation,
  useCreateBurnInExportJobMutation,
  useTaskQuery,
  useCreateTranslationJobMutation,
  useRetryTaskMutation
} from "../queries/taskQueries";
import {
  useCreateWaveformJobMutation,
  useWaveformQuery
} from "../queries/waveformQueries";
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
  provider: "ct2-marian",
  modelId: null,
  modelNameOrPath: null,
  sourceLanguage: "zh",
  targetLanguage: "en",
  mode: "missing_only",
  device: "cuda",
  computeType: "float16",
  batchSize: 8,
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
  const subtitleDraft = useSubtitleDraftQuery(activeProjectId);
  const subtitleSnapshots = useSubtitleSnapshotsQuery(activeProjectId);
  const models = useModelsQuery(Boolean(activeProjectId));
  const saveSubtitle = useSaveSubtitleDocumentMutation(activeProjectId);
  const saveDraft = useSaveSubtitleDraftMutation(activeProjectId);
  const deleteDraft = useDeleteSubtitleDraftMutation(activeProjectId);
  const createSnapshot = useCreateSubtitleSnapshotMutation(activeProjectId);
  const restoreSnapshot = useRestoreSubtitleSnapshotMutation(activeProjectId);
  const createAnalysisJob = useCreateAnalysisJobMutation(activeProjectId);
  const createTranslationJob = useCreateTranslationJobMutation(activeProjectId);
  const waveform = useWaveformQuery(activeProjectId);
  const createWaveformJob = useCreateWaveformJobMutation(activeProjectId);
  const cancelTask = useCancelTaskMutation();
  const retryTask = useRetryTaskMutation();
  const exportSubtitles = useSubtitleExportMutation(activeProjectId);
  const createBurnInExportJob = useCreateBurnInExportJobMutation(activeProjectId);
  const stylePresets = useStylePresetsQuery(activeProjectId);
  const createStylePreset = useCreateStylePresetMutation(activeProjectId);
  const updateStylePreset = useUpdateStylePresetMutation(activeProjectId);
  const deleteStylePreset = useDeleteStylePresetMutation(activeProjectId);
  const applyStylePreset = useApplyStylePresetMutation(activeProjectId);
  const [draftDocument, setDraftDocument] = useState<SubtitleDocument | null>(null);
  const [historyPast, setHistoryPast] = useState<SubtitleDocument[]>([]);
  const [historyFuture, setHistoryFuture] = useState<SubtitleDocument[]>([]);
  const [subtitleFilter, setSubtitleFilter] = useState<SubtitleGridFilter>("all");
  const [offsetMs, setOffsetMs] = useState(0);
  const [offsetScope, setOffsetScope] = useState<OffsetScope>("selected");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [analysisConfig, setAnalysisConfig] = useState(defaultAnalysisConfig);
  const [translationConfig, setTranslationConfig] = useState(defaultTranslationConfig);
  const [exportFormat, setExportFormat] = useState<SubtitleExportFormat>("srt");
  const [exportMode, setExportMode] = useState<SubtitleExportMode>("bilingual");
  const [exportResult, setExportResult] = useState<SubtitleExportResponse | null>(null);
  const [styleDraft, setStyleDraft] = useState(defaultSubtitleStyle);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [latestTask, setLatestTask] = useState<TaskResponse | null>(null);
  const [latestTaskId, setLatestTaskId] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [seekRequestMs, setSeekRequestMs] = useState<number | null>(null);
  const task = useTaskQuery(latestTaskId);
  const refetchedTaskId = useRef<string | null>(null);
  const lastAutosavedDraftRef = useRef<string | null>(null);
  const polledTask = task.data;
  const serverDraft = subtitleDraft.data ?? null;
  const snapshotSummaries = subtitleSnapshots.data?.snapshots ?? [];
  const subtitleDocument = draftDocument ?? subtitle.data ?? null;
  const subtitleLines = subtitleDocument?.lines ?? emptySubtitleLines;
  const modelCatalog = models.data?.models ?? [];
  const stylePresetList = stylePresets.data?.presets ?? [];
  const activeStylePreset =
    stylePresetList.find((preset) => preset.id === stylePresets.data?.activePresetId) ??
    stylePresetList[0] ??
    null;
  const hasUnsavedChanges = Boolean(draftDocument);
  const hasUnresolvedDraft = hasUnsavedChanges || Boolean(serverDraft);
  const recoveryPanelVisible = Boolean(serverDraft || snapshotSummaries.length > 0);
  const layout = isNarrow ? "stacked" : "split";
  const hasSubtitleRows = subtitleLines.length > 0;
  const timingValidation = useMemo(() => validateSubtitleTiming(subtitleLines), [subtitleLines]);
  const hasTimingExportErrors = hasBlockingTimingIssues(timingValidation);
  const observedTask = polledTask ?? latestTask;
  const taskOperationPending = cancelTask.isPending || retryTask.isPending;
  const taskActive =
    isTaskActive(observedTask) ||
    createAnalysisJob.isPending ||
    createTranslationJob.isPending ||
    createWaveformJob.isPending ||
    createBurnInExportJob.isPending ||
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
  const canRetryExportTask = Boolean(canRetryCurrentTask && observedTask?.type === "export");
  const taskStatusMessage = observedTask
    ? `${t(`status.${observedTask.status}`)} · ${observedTask.message} · ${Math.round(
        observedTask.progress * 100
      )}%`
    : t("status.ready");
  const taskStatusError =
    observedTask?.errorMessage ??
    getErrorMessage(task.error) ??
    getErrorMessage(createWaveformJob.error) ??
    getErrorMessage(createBurnInExportJob.error) ??
    getErrorMessage(cancelTask.error) ??
    getErrorMessage(retryTask.error);
  const hasProjectError = project.isError;
  const hasSubtitleError = subtitle.isError;
  const dataBlocked = project.isPending || subtitle.isPending || hasProjectError || hasSubtitleError;
  const canExport = Boolean(
    activeProjectId &&
      subtitleDocument &&
      hasSubtitleRows &&
      !hasUnresolvedDraft &&
      !taskActive &&
      !dataBlocked &&
      !hasTimingExportErrors
  );
  const exportDisabledReason = canExport
    ? null
    : taskActive
      ? t("inspector.exportDisabledTaskActive")
      : hasUnresolvedDraft
        ? t("inspector.exportDisabledUnsaved")
        : hasProjectError || hasSubtitleError
          ? t("inspector.exportDisabledDataError")
          : hasTimingExportErrors
            ? t("inspector.exportDisabledTiming")
            : activeProjectId
              ? t("inspector.exportDisabledNoLines")
              : t("workbench.noProject");
  const selectedLine = useMemo(
    () => subtitleLines.find((line) => line.id === selectedLineId) ?? null,
    [selectedLineId, subtitleLines]
  );
  const activeLineId = useMemo(
    () =>
      subtitleLines.find(
        (line) => currentTimeMs >= line.startMs && currentTimeMs < line.endMs
      )?.id ?? null,
    [currentTimeMs, subtitleLines]
  );
  const mediaUrl = activeProjectId ? projectMediaUrl(activeProjectId) : null;
  const timelineDurationMs = subtitleDocument?.durationMs ?? project.data?.durationMs ?? 0;
  const canEditSubtitle = Boolean(subtitleDocument && hasSubtitleRows && !saveSubtitle.isPending);
  const recoveryBusy =
    saveSubtitle.isPending ||
    saveDraft.isPending ||
    deleteDraft.isPending ||
    createSnapshot.isPending ||
    restoreSnapshot.isPending;

  useEffect(() => {
    setDraftDocument(null);
    setHistoryPast([]);
    setHistoryFuture([]);
    setOffsetMs(0);
    setOffsetScope("selected");
    setShortcutsOpen(false);
    setExportFormat("srt");
    setStyleDraft(defaultSubtitleStyle);
    setShowSafeArea(false);
    lastAutosavedDraftRef.current = null;
  }, [activeProjectId]);

  useEffect(() => {
    setExportResult(null);
    setLatestTask(null);
    setLatestTaskId(null);
    refetchedTaskId.current = null;
    setTranslationConfig(defaultTranslationConfig);
    setCurrentTimeMs(0);
    setSeekRequestMs(null);
  }, [activeProjectId]);

  useEffect(() => {
    const nextStyle = subtitleStyleWithDefaults(
      activeStylePreset?.style ?? subtitleDocument?.styles[0] ?? defaultSubtitleStyle
    );
    setStyleDraft(nextStyle);
  }, [activeProjectId, activeStylePreset?.id, activeStylePreset?.style, subtitleDocument?.styles]);

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
      void subtitleSnapshots.refetch();
    }
    if (finishedTask.type === "waveform") {
      void waveform.refetch();
    }
    if (finishedTask.type === "export") {
      void project.refetch();
    }
  }, [polledTask, project.refetch, subtitle.refetch, subtitleSnapshots.refetch, waveform.refetch]);

  useEffect(() => {
    if (!activeProjectId || !draftDocument) {
      return undefined;
    }

    const serializedDraft = JSON.stringify(draftDocument);
    if (lastAutosavedDraftRef.current === serializedDraft) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      lastAutosavedDraftRef.current = serializedDraft;
      void saveDraft.mutateAsync(draftDocument).catch(() => {
        lastAutosavedDraftRef.current = null;
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [activeProjectId, draftDocument, saveDraft]);

  function resetEditingHistory() {
    setHistoryPast([]);
    setHistoryFuture([]);
  }

  function setPresentDocument(nextDocument: SubtitleDocument) {
    if (subtitle.data && nextDocument === subtitle.data) {
      setDraftDocument(null);
      return;
    }

    setDraftDocument(nextDocument);
  }

  function commitDraftDocument(nextDocument: SubtitleDocument) {
    if (!subtitleDocument || nextDocument === subtitleDocument) {
      return;
    }

    const nextHistory = updateHistory(
      {
        past: historyPast,
        present: subtitleDocument,
        future: historyFuture
      },
      nextDocument
    );
    setHistoryPast(nextHistory.past);
    setHistoryFuture(nextHistory.future);
    setDraftDocument(nextHistory.present);
  }

  function updateLine(nextLine: SubtitleLine) {
    if (!subtitleDocument) {
      return;
    }

    commitDraftDocument({
      ...subtitleDocument,
      lines: subtitleDocument.lines.map((line) => (line.id === nextLine.id ? nextLine : line))
    });
  }

  function handleUndo() {
    if (!subtitleDocument || historyPast.length === 0) {
      return;
    }

    const nextHistory = undoHistory({
      past: historyPast,
      present: subtitleDocument,
      future: historyFuture
    });
    setHistoryPast(nextHistory.past);
    setHistoryFuture(nextHistory.future);
    setPresentDocument(nextHistory.present);
  }

  function handleRedo() {
    if (!subtitleDocument || historyFuture.length === 0) {
      return;
    }

    const nextHistory = redoHistory({
      past: historyPast,
      present: subtitleDocument,
      future: historyFuture
    });
    setHistoryPast(nextHistory.past);
    setHistoryFuture(nextHistory.future);
    setPresentDocument(nextHistory.present);
  }

  function handleSelectLine(lineId: string) {
    setSelectedLineId(lineId);
    const line = subtitleLines.find((candidate) => candidate.id === lineId);
    if (line) {
      setSeekRequestMs(line.startMs);
      setCurrentTimeMs(line.startMs);
    }
  }

  function handleTimelineSeek(timeMs: number) {
    setSeekRequestMs(timeMs);
    setCurrentTimeMs(timeMs);
  }

  function handleSplitLine() {
    if (!subtitleDocument) {
      return;
    }

    const targetLineId = selectedLineId ?? activeLineId;
    if (!targetLineId) {
      return;
    }

    commitDraftDocument(splitSubtitleLine(subtitleDocument, targetLineId, currentTimeMs));
  }

  function handleMergeLine(direction: "previous" | "next") {
    if (!subtitleDocument || !selectedLineId) {
      return;
    }

    commitDraftDocument(mergeSubtitleLine(subtitleDocument, selectedLineId, direction));
  }

  async function handleApplyOffset() {
    if (!subtitleDocument || !activeProjectId || offsetMs === 0) {
      return;
    }

    const nextDocument = offsetSubtitleLines(subtitleDocument, {
      scope: offsetScope,
      selectedLineId,
      currentTimeMs,
      offsetMs
    });
    if (nextDocument === subtitleDocument) {
      return;
    }

    try {
      await createSnapshot.mutateAsync({
        reason: "batch_timing",
        label: t("recovery.batchTimingSnapshotLabel"),
        document: subtitleDocument
      });
      commitDraftDocument(nextDocument);
    } catch {
      // Keep the document unchanged if the safety snapshot cannot be created.
    }
  }

  function handleRestoreDraft() {
    if (!serverDraft) {
      return;
    }

    lastAutosavedDraftRef.current = JSON.stringify(serverDraft.document);
    setDraftDocument(serverDraft.document);
    resetEditingHistory();
  }

  async function handleDiscardDraft() {
    if (!activeProjectId) {
      return;
    }

    try {
      await deleteDraft.mutateAsync();
      lastAutosavedDraftRef.current = null;
      setDraftDocument(null);
      resetEditingHistory();
    } catch {
      // Mutation state surfaces the failure; keep draft recovery visible.
    }
  }

  async function handleCreateSnapshot() {
    if (!activeProjectId || !subtitleDocument) {
      return;
    }

    try {
      await createSnapshot.mutateAsync({
        reason: "manual",
        label: t("recovery.manualSnapshotLabel"),
        document: subtitleDocument
      });
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    if (!activeProjectId) {
      return;
    }

    try {
      await restoreSnapshot.mutateAsync(snapshotId);
      lastAutosavedDraftRef.current = null;
      setDraftDocument(null);
      resetEditingHistory();
      void subtitle.refetch();
    } catch {
      // Mutation state surfaces the failure; keep the current document visible.
    }
  }

  async function handleSave() {
    if (!draftDocument || !activeProjectId) {
      return;
    }

    try {
      await saveSubtitle.mutateAsync(draftDocument);
      lastAutosavedDraftRef.current = null;
      setDraftDocument(null);
      resetEditingHistory();
      void subtitle.refetch();
    } catch {
      // Keep the draft in place so the user can retry a failed save.
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifierPressed = event.ctrlKey || event.metaKey;

      if (modifierPressed && key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (modifierPressed && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (!modifierPressed && !event.altKey && key === "s") {
        event.preventDefault();
        handleSplitLine();
        return;
      }

      if (!modifierPressed && !event.altKey && key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeLineId, currentTimeMs, historyFuture, historyPast, selectedLineId, subtitleDocument]);

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

  async function handleCreateWaveform() {
    if (!activeProjectId) {
      return;
    }

    try {
      const nextTask = await createWaveformJob.mutateAsync();
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

  async function handleRetryTask(config?: AnalysisJobRequest | TranslationJobRequest | BurnInExportRequest) {
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
      setExportResult(
        await exportSubtitles.mutateAsync({
          format: exportFormat,
          mode: exportMode,
          stylePresetId: stylePresets.data?.activePresetId ?? null,
          style: styleDraft
        })
      );
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleBurnInExport() {
    if (!canExport) {
      return;
    }

    try {
      const nextTask = await createBurnInExportJob.mutateAsync({
        mode: exportMode,
        stylePresetId: stylePresets.data?.activePresetId ?? null,
        style: styleDraft,
        outputPath: null,
        videoCodec: "libx264",
        crf: 18,
        preset: "medium"
      });
      refetchedTaskId.current = null;
      setLatestTask(nextTask);
      setLatestTaskId(nextTask.taskId);
    } catch {
      // Mutation state surfaces the failure; avoid throwing from the UI event.
    }
  }

  async function handleOpenExportsFolder() {
    const exportsDir = project.data?.diagnostics.exportsDir;
    if (!exportsDir) {
      return;
    }
    await openPathInFileManager(exportsDir);
  }

  async function handleCreateStylePreset(name: string, style: typeof styleDraft) {
    try {
      await createStylePreset.mutateAsync({ name, style });
      void stylePresets.refetch();
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function handleUpdateStylePreset(
    presetId: string,
    input: { name?: string; style?: typeof styleDraft }
  ) {
    try {
      await updateStylePreset.mutateAsync({ presetId, input });
      void stylePresets.refetch();
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function handleDeleteStylePreset(presetId: string) {
    try {
      await deleteStylePreset.mutateAsync(presetId);
      void stylePresets.refetch();
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function handleApplyStylePreset(presetId: string) {
    try {
      const applied = await applyStylePreset.mutateAsync(presetId);
      setStyleDraft(subtitleStyleWithDefaults(applied.style));
      void subtitle.refetch();
      void stylePresets.refetch();
    } catch {
      // Mutation state surfaces the failure.
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
            canCancel={canCancelTask}
            canRetry={canRetryTranslationTask}
            onConfigChange={setTranslationConfig}
            onStart={() => void handleStartTranslation()}
            onCancel={() => void handleCancelTask()}
            onRetry={() => void handleRetryTask(translationConfig)}
          />
        </Stack>
      );
    }

    if (inspectorMode === "export") {
      const exportError =
        exportSubtitles.error ??
        createBurnInExportJob.error ??
        createStylePreset.error ??
        updateStylePreset.error ??
        deleteStylePreset.error ??
        applyStylePreset.error;
      const presetBusy =
        stylePresets.isPending ||
        createStylePreset.isPending ||
        updateStylePreset.isPending ||
        deleteStylePreset.isPending ||
        applyStylePreset.isPending;
      return (
        <Stack gap="sm">
          <ErrorMessage error={exportError} />
          <ExportInspector
            format={exportFormat}
            mode={exportMode}
            result={exportResult}
            canExport={canExport}
            disabledReason={exportDisabledReason}
            busy={exportSubtitles.isPending || createBurnInExportJob.isPending}
            validationIssues={timingValidation.issues}
            style={styleDraft}
            presets={stylePresetList}
            activePresetId={stylePresets.data?.activePresetId ?? null}
            presetBusy={presetBusy}
            showSafeArea={showSafeArea}
            latestTask={observedTask}
            canCancelTask={canCancelTask && observedTask?.type === "export"}
            canRetryTask={canRetryExportTask}
            exportsDir={project.data?.diagnostics.exportsDir ?? null}
            onFormatChange={setExportFormat}
            onModeChange={setExportMode}
            onStyleChange={setStyleDraft}
            onCreatePreset={(name, style) => void handleCreateStylePreset(name, style)}
            onUpdatePreset={(presetId, input) => void handleUpdateStylePreset(presetId, input)}
            onDeletePreset={(presetId) => void handleDeleteStylePreset(presetId)}
            onApplyPreset={(presetId) => void handleApplyStylePreset(presetId)}
            onShowSafeAreaChange={setShowSafeArea}
            onExport={() => void handleExport()}
            onBurnInExport={() => void handleBurnInExport()}
            onCancelTask={() => void handleCancelTask()}
            onRetryTask={() => void handleRetryTask()}
            onOpenExportsFolder={() => void handleOpenExportsFolder()}
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
  const timelinePanel =
    activeProjectId && subtitleDocument ? (
      <Box
        style={{
          minHeight: 156,
          display: "grid",
          gridTemplateRows: waveform.data ? "minmax(0, 1fr)" : "auto minmax(0, 1fr)"
        }}
      >
        {waveform.data ? null : (
          <Box
            px="sm"
            py={6}
            bg="#0f172a"
            style={{ borderTop: "1px solid #1e293b" }}
          >
            <Button
              type="button"
              size="compact-xs"
              variant="light"
              color="cyan"
              leftSection={<IconWaveSine size={14} />}
              disabled={!activeProjectId || taskActive}
              loading={createWaveformJob.isPending}
              onClick={() => void handleCreateWaveform()}
            >
              {t("timelineEditor.generateWaveform")}
            </Button>
          </Box>
        )}
        <TimelineEditor
          durationMs={timelineDurationMs}
          currentTimeMs={currentTimeMs}
          lines={subtitleLines}
          waveform={waveform.data ?? null}
          selectedLineId={selectedLineId}
          activeLineId={activeLineId}
          timingIssuesByLineId={timingValidation.byLineId}
          onSelectLine={handleSelectLine}
          onSeek={handleTimelineSeek}
          onChangeLine={updateLine}
        />
      </Box>
    ) : (
      <TimelineStrip durationMs={timelineDurationMs} lineCount={subtitleLines.length} />
    );

  return (
    <>
      <Box
        component="main"
        aria-label={t("workbench.title")}
        bg="#e9edf2"
        style={{
          height: "calc(100vh - 84px)",
          minHeight: 620,
          display: "grid",
          gridTemplateRows: recoveryPanelVisible
            ? "auto auto auto auto minmax(0, 1fr)"
            : "auto auto auto minmax(0, 1fr)",
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

      <EditorCommandBar
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        canEdit={canEditSubtitle}
        offsetMs={offsetMs}
        offsetScope={offsetScope}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSplit={handleSplitLine}
        onMergePrevious={() => handleMergeLine("previous")}
        onMergeNext={() => handleMergeLine("next")}
        onOffsetMsChange={setOffsetMs}
        onOffsetScopeChange={setOffsetScope}
        onApplyOffset={() => void handleApplyOffset()}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <RecoveryPanel
        draft={serverDraft}
        snapshots={snapshotSummaries}
        busy={recoveryBusy}
        onRestoreDraft={handleRestoreDraft}
        onDiscardDraft={() => void handleDiscardDraft()}
        onCreateSnapshot={() => void handleCreateSnapshot()}
        onRestoreSnapshot={(snapshotId) => void handleRestoreSnapshot(snapshotId)}
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
          data-testid="workbench-media-stack"
          style={{
            display: "grid",
            gridTemplateRows: "minmax(200px, 34vh) minmax(140px, 1fr) auto",
            minHeight: 0
          }}
        >
          <Box p="md" bg="#111827" style={{ minHeight: 0 }}>
            <VideoPreviewPanel
              mediaUrl={mediaUrl}
              selectedLine={selectedLine}
              previewStyle={styleDraft}
              showSafeArea={showSafeArea}
              seekRequestMs={seekRequestMs}
              onTimeUpdate={setCurrentTimeMs}
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
              activeLineId={activeLineId}
              timingIssuesByLineId={timingValidation.byLineId}
              filter={subtitleFilter}
              onFilterChange={setSubtitleFilter}
              onSelectLine={handleSelectLine}
            />
          </Box>

          {timelinePanel}
        </Box>

        <InspectorPanel mode={inspectorMode} layout={isNarrow ? "stacked" : "side"}>
          {renderInspectorContent()}
        </InspectorPanel>
      </Box>
      </Box>

      <Modal
        opened={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title={t("shortcuts.title")}
        size="sm"
      >
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{t("shortcuts.split")}</Text>
            <Kbd>S</Kbd>
          </Group>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{t("shortcuts.undo")}</Text>
            <Group gap={4} wrap="nowrap">
              <Kbd>Ctrl</Kbd>
              <Kbd>Z</Kbd>
            </Group>
          </Group>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{t("shortcuts.redo")}</Text>
            <Group gap={4} wrap="nowrap">
              <Kbd>Ctrl</Kbd>
              <Kbd>Y</Kbd>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
