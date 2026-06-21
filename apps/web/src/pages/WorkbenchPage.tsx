import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Kbd,
  Modal,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  VisuallyHidden
} from "@mantine/core";
import type {
  AnalysisJobRequest,
  BurnInExportRequest,
  ProjectMediaAsset,
  SubtitleExportFormat,
  SubtitleExportMode,
  SubtitleExportResponse,
  SubtitleDocument,
  SubtitleLine,
  TaskResponse,
  TranslationJobRequest,
  TranslationSettingsResponse
} from "@diplomat/shared";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconFileText,
  IconFolderOpen,
  IconMovie,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconWaveSine
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { projectMediaUrl } from "../api";
import {
  listenForDroppedVideoFiles,
  openPathInFileManager,
  pickVideoFile,
  pickVideoFiles
} from "../desktop";
import { workstationSurfaces } from "../app/theme";
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
import {
  displayRuntimeErrorMessage as displayWorkbenchErrorMessage,
  displayRuntimeMessage,
  getErrorMessage,
  isTechnicalRuntimeErrorMessage
} from "../lib/runtimeMessages";
import { createLanguageSelectData } from "../lib/languageOptions";
import { validateSubtitleTiming } from "../lib/timingValidation";
import { useSubtitleExportMutation } from "../queries/exportQueries";
import { useModelsQuery } from "../queries/modelQueries";
import {
  useDeleteProjectMediaAssetMutation,
  useProjectQuery,
  useSaveTranslationSettingsMutation,
  useTranslationSettingsQuery,
  useUpdateProjectSourceMediaMutation
} from "../queries/projectQueries";
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
import {
  defaultWorkspaceLayout,
  useUiStore,
  type EditorWorkspace,
  type HelpTopic,
  type InspectorMode,
  type ProjectDefaults
} from "../state/uiStore";

const defaultAnalysisConfig: AnalysisJobRequest = {
  provider: "faster-whisper",
  modelId: null,
  modelNameOrPath: null,
  device: "cpu",
  computeType: "int8",
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
  device: "cpu",
  computeType: "int8",
  batchSize: 8,
  endpoint: null,
  apiKeyEnv: null,
  glossary: []
};

const workspaceInspectorModes: Record<EditorWorkspace, InspectorMode> = {
  transcription: "analysis",
  translation: "translation",
  timing: "line",
  style: "style",
  delivery: "export"
};

function normalizeLanguageCode(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 ? trimmed : fallback;
}

function fileNameFromPath(sourcePath: string) {
  return sourcePath.replace(/\\/g, "/").split("/").pop() || sourcePath;
}

function translationConfigFromDefaults(defaults: ProjectDefaults): TranslationJobRequest {
  return {
    ...defaultTranslationConfig,
    sourceLanguage: normalizeLanguageCode(defaults.sourceLanguage, defaultTranslationConfig.sourceLanguage),
    targetLanguage: normalizeLanguageCode(defaults.targetLanguage, defaultTranslationConfig.targetLanguage)
  };
}

const emptySubtitleLines: SubtitleLine[] = [];
const collapsedDockSize = 32;
const inspectorResizeBounds = {
  min: 280,
  max: 480
} as const;
const timelineResizeBounds = {
  min: 120,
  max: 360
} as const;

const inspectorHelpTopicByMode: Record<
  "line" | "analysis" | "translation" | "style" | "export" | "settings-lite",
  HelpTopic
> = {
  line: "timingQa",
  analysis: "transcription",
  translation: "translation",
  style: "style",
  export: "export",
  "settings-lite": "projectsMedia"
};

function clampPanelSize(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function capturePointer(element: Element, pointerId: number) {
  const target = element as Element & { setPointerCapture?: (pointerId: number) => void };
  target.setPointerCapture?.(pointerId);
}

function releasePointer(element: Element, pointerId: number) {
  const target = element as Element & { releasePointerCapture?: (pointerId: number) => void };
  target.releasePointerCapture?.(pointerId);
}

function translationSettingsToConfig(settings: TranslationSettingsResponse): TranslationJobRequest {
  const { projectId: _projectId, updatedAt: _updatedAt, ...config } = settings;
  return config;
}

function serializeTranslationConfig(config: TranslationJobRequest) {
  return JSON.stringify(config);
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
      bg={tone === "error" ? "rgba(190, 18, 60, 0.12)" : workstationSurfaces.panelAlt}
      style={{
        borderTop: `1px solid ${workstationSurfaces.outline}`,
        borderBottom: `1px solid ${workstationSurfaces.outline}`
      }}
    >
      <Text size="sm" fw={800} c={tone === "error" ? "red" : workstationSurfaces.text}>
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

function ErrorMessage({
  error,
  fallbackTitle,
  fallbackMessage
}: {
  error: unknown;
  fallbackTitle?: string;
  fallbackMessage?: string;
}) {
  const message = getErrorMessage(error);
  const technical = message ? isTechnicalRuntimeErrorMessage(message) : false;

  if (!message) {
    return null;
  }

  return (
    <StatusNotice
      title={technical && fallbackTitle ? fallbackTitle : displayRuntimeMessage(message)}
      message={technical ? fallbackMessage : null}
      tone="error"
    />
  );
}

function CurrentProjectSettingsPanel({
  translationConfig,
  exportMode,
  busy,
  onTranslationConfigChange,
  onExportModeChange
}: {
  translationConfig: TranslationJobRequest;
  exportMode: SubtitleExportMode;
  busy: boolean;
  onTranslationConfigChange: (config: TranslationJobRequest) => void;
  onExportModeChange: (mode: SubtitleExportMode) => void;
}) {
  const { t } = useTranslation();
  const languageOptions = createLanguageSelectData(t, [
    translationConfig.sourceLanguage,
    translationConfig.targetLanguage
  ]);

  function updateSourceLanguage(value: string) {
    onTranslationConfigChange({
      ...translationConfig,
      sourceLanguage: value,
      glossary: translationConfig.glossary.map((entry) => ({
        ...entry,
        sourceLanguage: value
      }))
    });
  }

  function updateTargetLanguage(value: string) {
    onTranslationConfigChange({
      ...translationConfig,
      targetLanguage: value,
      glossary: translationConfig.glossary.map((entry) => ({
        ...entry,
        targetLanguage: value
      }))
    });
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c={workstationSurfaces.textMuted}>
        {t("inspector.projectSettingsDescription")}
      </Text>
      <Group grow gap="xs" align="flex-start">
        <NativeSelect
          label={t("fields.sourceLanguage")}
          value={translationConfig.sourceLanguage}
          data={languageOptions}
          disabled={busy}
          onChange={(event) => updateSourceLanguage(event.currentTarget.value)}
        />
        <NativeSelect
          label={t("fields.targetLanguage")}
          value={translationConfig.targetLanguage}
          data={languageOptions}
          disabled={busy}
          onChange={(event) => updateTargetLanguage(event.currentTarget.value)}
        />
      </Group>
      <NativeSelect
        label={t("fields.exportMode")}
        value={exportMode}
        disabled={busy}
        data={[
          { label: t("exportModes.source"), value: "source" },
          { label: t("exportModes.target"), value: "target" },
          { label: t("exportModes.bilingual"), value: "bilingual" }
        ]}
        onChange={(event) => onExportModeChange(event.currentTarget.value as SubtitleExportMode)}
      />
    </Stack>
  );
}

export function WorkbenchPage() {
  const { t } = useTranslation();
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const activeProjectId = useUiStore((state) => state.activeProjectId);
  const inspectorMode = useUiStore((state) => state.inspectorMode);
  const editorWorkspace = useUiStore((state) => state.editorWorkspace);
  const workspaceLayouts = useUiStore((state) => state.workspaceLayouts);
  const setWorkspaceLayout = useUiStore((state) => state.setWorkspaceLayout);
  const setEditorWorkspace = useUiStore((state) => state.setEditorWorkspace);
  const setInspectorMode = useUiStore((state) => state.setInspectorMode);
  const selectedLineId = useUiStore((state) => state.selectedLineId);
  const setSelectedLineId = useUiStore((state) => state.setSelectedLineId);
  const projectDefaults = useUiStore((state) => state.projectDefaults);
  const setHelpTopic = useUiStore((state) => state.setHelpTopic);
  const setPage = useUiStore((state) => state.setPage);
  const project = useProjectQuery(activeProjectId);
  const projectSourceVideoPath = project.data?.sourceVideoPath ?? null;
  const projectMediaProjectId = activeProjectId && projectSourceVideoPath ? activeProjectId : null;
  const subtitle = useSubtitleDocumentQuery(projectMediaProjectId);
  const subtitleDraft = useSubtitleDraftQuery(projectMediaProjectId);
  const subtitleSnapshots = useSubtitleSnapshotsQuery(projectMediaProjectId);
  const models = useModelsQuery(Boolean(activeProjectId));
  const saveSubtitle = useSaveSubtitleDocumentMutation(activeProjectId);
  const saveDraft = useSaveSubtitleDraftMutation(activeProjectId);
  const deleteDraft = useDeleteSubtitleDraftMutation(activeProjectId);
  const createSnapshot = useCreateSubtitleSnapshotMutation(activeProjectId);
  const restoreSnapshot = useRestoreSubtitleSnapshotMutation(activeProjectId);
  const updateSourceMedia = useUpdateProjectSourceMediaMutation(activeProjectId);
  const deleteMediaAsset = useDeleteProjectMediaAssetMutation(activeProjectId);
  const translationSettings = useTranslationSettingsQuery(activeProjectId);
  const saveTranslationSettings = useSaveTranslationSettingsMutation(activeProjectId);
  const createAnalysisJob = useCreateAnalysisJobMutation(activeProjectId);
  const createTranslationJob = useCreateTranslationJobMutation(activeProjectId);
  const waveform = useWaveformQuery(projectMediaProjectId);
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
  const [translationConfig, setTranslationConfig] = useState(() =>
    translationConfigFromDefaults(projectDefaults)
  );
  const [exportFormat, setExportFormat] = useState<SubtitleExportFormat>("srt");
  const [exportMode, setExportMode] = useState<SubtitleExportMode>(() => projectDefaults.exportMode);
  const [exportResult, setExportResult] = useState<SubtitleExportResponse | null>(null);
  const [styleDraft, setStyleDraft] = useState(defaultSubtitleStyle);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [latestTask, setLatestTask] = useState<TaskResponse | null>(null);
  const [latestTaskId, setLatestTaskId] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [seekRequestMs, setSeekRequestMs] = useState<number | null>(null);
  const task = useTaskQuery(latestTaskId);
  const projectDefaultsRef = useRef(projectDefaults);
  const refetchedTaskId = useRef<string | null>(null);
  const lastAutosavedDraftRef = useRef<string | null>(null);
  const lastSavedTranslationSettingsRef = useRef<string | null>(null);
  const inspectorResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const timelineResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const polledTask = task.data;
  const serverDraft = subtitleDraft.data ?? null;
  const snapshotSummaries = subtitleSnapshots.data?.snapshots ?? [];
  const subtitleDocument = draftDocument ?? subtitle.data ?? null;
  const subtitleLines = subtitleDocument?.lines ?? emptySubtitleLines;
  const projectMediaAssets = project.data?.mediaAssets ?? [];
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
  const workspaceLayout = workspaceLayouts[editorWorkspace];
  const productionStageInspectorMode = workspaceInspectorModes[editorWorkspace];
  const inspectorColumnWidth = workspaceLayout.inspectorCollapsed
    ? collapsedDockSize
    : workspaceLayout.inspectorWidth;
  const timelineDockHeight = workspaceLayout.bottomCollapsed
    ? collapsedDockSize
    : workspaceLayout.bottomDockHeight;
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
    deleteMediaAsset.isPending ||
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
    ? observedTask.message
    : t("status.ready");
  const taskStatusError =
    observedTask?.errorMessage ??
    getErrorMessage(updateSourceMedia.error) ??
    getErrorMessage(deleteMediaAsset.error) ??
    getErrorMessage(translationSettings.error) ??
    getErrorMessage(saveTranslationSettings.error) ??
    getErrorMessage(task.error) ??
    getErrorMessage(createWaveformJob.error) ??
    getErrorMessage(createBurnInExportJob.error) ??
    getErrorMessage(cancelTask.error) ??
    getErrorMessage(retryTask.error);
  const hasProjectError = project.isError;
  const hasSubtitleError = subtitle.isError;
  const subtitleQueryActive = Boolean(projectMediaProjectId);
  const dataBlocked =
    project.isPending ||
    (subtitleQueryActive && subtitle.isPending) ||
    hasProjectError ||
    (subtitleQueryActive && hasSubtitleError);
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
  const mediaUrl = activeProjectId && projectSourceVideoPath ? projectMediaUrl(activeProjectId) : null;
  const timelineDurationMs = subtitleDocument?.durationMs ?? project.data?.durationMs ?? 0;
  const canEditSubtitle = Boolean(subtitleDocument && hasSubtitleRows && !saveSubtitle.isPending);
  const recoveryBusy =
    saveSubtitle.isPending ||
    saveDraft.isPending ||
    deleteDraft.isPending ||
    createSnapshot.isPending ||
    restoreSnapshot.isPending;

  useEffect(() => {
    projectDefaultsRef.current = projectDefaults;
  }, [projectDefaults]);

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
    lastSavedTranslationSettingsRef.current = null;
    setTranslationConfig(translationConfigFromDefaults(projectDefaultsRef.current));
    setExportMode(projectDefaultsRef.current.exportMode);
    setCurrentTimeMs(0);
    setSeekRequestMs(null);
  }, [activeProjectId]);

  useEffect(() => {
    if (!translationSettings.data) {
      return;
    }

    const nextConfig = translationSettingsToConfig(translationSettings.data);
    lastSavedTranslationSettingsRef.current = serializeTranslationConfig(nextConfig);
    setTranslationConfig(nextConfig);
  }, [translationSettings.data]);

  useEffect(() => {
    if (!activeProjectId || !translationSettings.data) {
      return undefined;
    }

    const serializedConfig = serializeTranslationConfig(translationConfig);
    if (lastSavedTranslationSettingsRef.current === serializedConfig) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void saveTranslationSettings.mutateAsync(translationConfig).catch(() => {
        // Mutation state surfaces the failure in the project status area.
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [activeProjectId, saveTranslationSettings, translationConfig, translationSettings.data]);

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

  useEffect(() => {
    if (!activeProjectId) {
      return undefined;
    }

    let unlisten: (() => void) | null = null;
    let disposed = false;
    void listenForDroppedVideoFiles((paths) => {
      void importVideoPaths(paths);
    })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }
        unlisten = cleanup;
      })
      .catch(() => {
        // Drag-and-drop is best-effort; the toolbar import button remains available.
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [activeProjectId]);

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

  function resetProjectMediaState() {
    setDraftDocument(null);
    resetEditingHistory();
    setSelectedLineId(null);
    setCurrentTimeMs(0);
    setSeekRequestMs(null);
    setLatestTask(null);
    setLatestTaskId(null);
    refetchedTaskId.current = null;
  }

  async function importVideoPath(sourceVideoPath: string) {
    if (!activeProjectId || !sourceVideoPath.trim()) {
      return;
    }

    try {
      await updateSourceMedia.mutateAsync({ sourceVideoPath: sourceVideoPath.trim() });
      resetProjectMediaState();
      void project.refetch();
      void subtitle.refetch();
      void subtitleDraft.refetch();
      void subtitleSnapshots.refetch();
      void waveform.refetch();
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function importVideoPaths(sourceVideoPaths: string[]) {
    const normalizedPaths = sourceVideoPaths.map((path) => path.trim()).filter(Boolean);
    for (const sourceVideoPath of normalizedPaths) {
      await importVideoPath(sourceVideoPath);
    }
  }

  async function handleUseMediaAsset(asset: ProjectMediaAsset) {
    if (asset.active) {
      return;
    }
    await importVideoPath(asset.sourceVideoPath);
  }

  async function handleDeleteMediaAsset(asset: ProjectMediaAsset) {
    if (!activeProjectId) {
      return;
    }

    try {
      await deleteMediaAsset.mutateAsync(asset.assetId);
      if (asset.active || asset.sourceVideoPath === projectSourceVideoPath) {
        resetProjectMediaState();
        void subtitle.refetch();
        void subtitleDraft.refetch();
        void subtitleSnapshots.refetch();
        void waveform.refetch();
      }
      void project.refetch();
    } catch {
      // Mutation state surfaces the failure.
    }
  }

  async function handleImportVideo() {
    const pickedPaths = await pickVideoFiles();
    if (pickedPaths.length > 0) {
      await importVideoPaths(pickedPaths);
      return;
    }

    const pickedPath = await pickVideoFile();
    if (pickedPath) {
      await importVideoPath(pickedPath);
    }
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

  function handleInspectorResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (isNarrow || workspaceLayout.inspectorCollapsed) {
      return;
    }

    event.preventDefault();
    inspectorResizeRef.current = {
      startX: event.clientX,
      startWidth: workspaceLayout.inspectorWidth
    };
    capturePointer(event.currentTarget, event.pointerId);
  }

  function handleInspectorResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (!inspectorResizeRef.current) {
      return;
    }

    event.preventDefault();
    const nextWidth = clampPanelSize(
      inspectorResizeRef.current.startWidth + inspectorResizeRef.current.startX - event.clientX,
      inspectorResizeBounds.min,
      inspectorResizeBounds.max
    );
    setWorkspaceLayout(editorWorkspace, {
      inspectorWidth: nextWidth,
      inspectorCollapsed: false
    }, { persist: false });
  }

  function handleInspectorResizeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!inspectorResizeRef.current) {
      return;
    }

    inspectorResizeRef.current = null;
    setWorkspaceLayout(editorWorkspace, {});
    releasePointer(event.currentTarget, event.pointerId);
  }

  function handleInspectorResizeReset() {
    if (isNarrow) {
      return;
    }

    inspectorResizeRef.current = null;
    setWorkspaceLayout(editorWorkspace, {
      inspectorWidth: defaultWorkspaceLayout.inspectorWidth,
      inspectorCollapsed: false
    });
  }

  function handleTimelineResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (isNarrow || workspaceLayout.bottomCollapsed) {
      return;
    }

    event.preventDefault();
    timelineResizeRef.current = {
      startY: event.clientY,
      startHeight: workspaceLayout.bottomDockHeight
    };
    capturePointer(event.currentTarget, event.pointerId);
  }

  function handleTimelineResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (!timelineResizeRef.current) {
      return;
    }

    event.preventDefault();
    const nextHeight = clampPanelSize(
      timelineResizeRef.current.startHeight + timelineResizeRef.current.startY - event.clientY,
      timelineResizeBounds.min,
      timelineResizeBounds.max
    );
    setWorkspaceLayout(editorWorkspace, {
      bottomDockHeight: nextHeight,
      bottomCollapsed: false
    }, { persist: false });
  }

  function handleTimelineResizeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!timelineResizeRef.current) {
      return;
    }

    timelineResizeRef.current = null;
    setWorkspaceLayout(editorWorkspace, {});
    releasePointer(event.currentTarget, event.pointerId);
  }

  function handleTimelineResizeReset() {
    if (isNarrow) {
      return;
    }

    timelineResizeRef.current = null;
    setWorkspaceLayout(editorWorkspace, {
      bottomDockHeight: defaultWorkspaceLayout.bottomDockHeight,
      bottomCollapsed: false
    });
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

  function openInspectorHelp() {
    setHelpTopic(inspectorHelpTopicByMode[inspectorMode]);
    setPage("help");
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
          <ErrorMessage
            error={saveSubtitle.error}
            fallbackTitle={t("workbench.errors.saveFailed")}
            fallbackMessage={t("workbench.errors.saveFailedHint")}
          />
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
          <ErrorMessage
            error={createAnalysisJob.error}
            fallbackTitle={t("workbench.errors.analysisFailed")}
          />
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
          <ErrorMessage
            error={
              translationSettings.error ??
              saveTranslationSettings.error ??
              createTranslationJob.error
            }
            fallbackTitle={t("workbench.errors.translationFailed")}
          />
          <TranslationInspector
            config={translationConfig}
            busy={!activeProjectId || taskActive || translationSettings.isLoading}
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

    if (inspectorMode === "style") {
      const styleError =
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
          <ErrorMessage
            error={styleError}
            fallbackTitle={t("workbench.errors.styleFailed")}
          />
          <ExportInspector
            surface="style"
            format={exportFormat}
            mode={exportMode}
            result={exportResult}
            canExport={canExport}
            disabledReason={exportDisabledReason}
            busy={false}
            style={styleDraft}
            presets={stylePresetList}
            activePresetId={stylePresets.data?.activePresetId ?? null}
            presetBusy={presetBusy}
            showSafeArea={showSafeArea}
            onFormatChange={setExportFormat}
            onModeChange={setExportMode}
            onStyleChange={setStyleDraft}
            onCreatePreset={(name, style) => void handleCreateStylePreset(name, style)}
            onUpdatePreset={(presetId, input) => void handleUpdateStylePreset(presetId, input)}
            onDeletePreset={(presetId) => void handleDeleteStylePreset(presetId)}
            onApplyPreset={(presetId) => void handleApplyStylePreset(presetId)}
            onShowSafeAreaChange={setShowSafeArea}
            onExport={() => void handleExport()}
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
          <ErrorMessage
            error={exportError}
            fallbackTitle={t("workbench.errors.exportFailed")}
          />
          <ExportInspector
            surface="delivery"
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

    if (inspectorMode === "settings-lite") {
      return (
        <Stack gap="sm">
          <ErrorMessage error={translationSettings.error ?? saveTranslationSettings.error} />
          <CurrentProjectSettingsPanel
            translationConfig={translationConfig}
            exportMode={exportMode}
            busy={!activeProjectId || taskActive || translationSettings.isLoading}
            onTranslationConfigChange={setTranslationConfig}
            onExportModeChange={setExportMode}
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

  function handleToolbarInspectorMode(mode: Parameters<typeof setInspectorMode>[0]) {
    if (mode === "export") {
      setEditorWorkspace("delivery");
    }

    setInspectorMode(mode);
  }

  function openProductionStageControls() {
    setInspectorMode(productionStageInspectorMode);
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
          message={displayWorkbenchErrorMessage(
            project.error,
            t("workbench.errors.projectLoadFailed")
          )}
          tone="error"
        />
      );
    }

    if (!projectSourceVideoPath) {
      return (
        <StatusNotice
          title={t("workbench.noSourceVideo")}
          message={t("workbench.importVideoToStart")}
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
          message={displayWorkbenchErrorMessage(
            subtitle.error,
            t("workbench.errors.subtitleLoadFailed")
          )}
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
  const projectContextTitle = project.data?.name ?? t("workbench.noProject");
  const projectContextSource = projectSourceVideoPath ?? t("workbench.noSourceVideo");
  const taskStatusAction =
    observedTask || taskOperationPending ? (
      <Group gap={6} wrap="nowrap">
        {observedTask?.diagnosticLogPath ? (
          <Button
            type="button"
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconFileText size={14} aria-hidden />}
            onClick={() => void openPathInFileManager(observedTask.diagnosticLogPath ?? "")}
          >
            {t("actions.openLogs")}
          </Button>
        ) : null}
        {canCancelTask ? (
          <Button
            type="button"
            size="compact-xs"
            variant="light"
            color="orange"
            leftSection={<IconPlayerStop size={14} aria-hidden />}
            loading={cancelTask.isPending}
            onClick={() => void handleCancelTask()}
          >
            {t("actions.cancel")}
          </Button>
        ) : null}
        {canRetryCurrentTask ? (
          <Button
            type="button"
            size="compact-xs"
            variant="light"
            color="blue"
            leftSection={<IconRefresh size={14} aria-hidden />}
            loading={retryTask.isPending}
            onClick={() => void handleRetryTask()}
          >
            {t("actions.retry")}
          </Button>
        ) : null}
      </Group>
    ) : null;
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
            bg={workstationSurfaces.panelAlt}
            style={{ borderTop: `1px solid ${workstationSurfaces.outline}` }}
          >
            <Button
              type="button"
              size="compact-xs"
              variant="light"
              color="teal"
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
  const mediaActionBusy = updateSourceMedia.isPending || deleteMediaAsset.isPending || taskActive;
  const hasProjectMediaAssets = projectMediaAssets.length > 0;
  const mediaBinEmpty = Boolean(project.data) && !hasProjectMediaAssets && !projectSourceVideoPath;
  const showMediaImportStart = mediaBinEmpty;
  const mediaBinTrack = mediaBinEmpty ? "152px" : "auto";
  const mediaPreviewTrack = mediaBinEmpty ? "minmax(180px, 22vh)" : "minmax(200px, 30vh)";
  const activeSourceName = projectSourceVideoPath ? fileNameFromPath(projectSourceVideoPath) : null;
  const projectMediaBin = activeProjectId ? (
    <Box
      component="section"
      role="region"
      aria-label={t("workbench.media.title")}
      px="sm"
      py={8}
      bg={workstationSurfaces.panelAlt}
      style={{
        borderBottom: `1px solid ${workstationSurfaces.outline}`,
        minHeight: mediaBinEmpty ? 360 : undefined,
        overflow: "hidden"
      }}
    >
      <Group justify="space-between" align="center" mb={6} gap="xs" wrap="nowrap">
        <Text size="xs" fw={900} c={workstationSurfaces.text}>
          {t("workbench.media.title")}
        </Text>
        <Text size="xs" c={workstationSurfaces.textMuted}>
          {t("workbench.media.count", { count: projectMediaAssets.length })}
        </Text>
      </Group>
      {hasProjectMediaAssets ? (
        <Group gap="xs" wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 2 }}>
          {projectMediaAssets.map((asset) => (
            <Box
              key={asset.assetId}
              p="xs"
              data-active={asset.active ? "true" : "false"}
              style={{
                minWidth: 260,
                maxWidth: 360,
                border: `1px solid ${
                  asset.active ? workstationSurfaces.success : workstationSurfaces.outline
                }`,
                borderRadius: 6,
                background: asset.active ? "#ecfdf5" : "#ffffff"
              }}
            >
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <Text
                  size="sm"
                  fw={800}
                  c={workstationSurfaces.text}
                  truncate
                  title={asset.sourceVideoPath}
                >
                  {asset.name}
                </Text>
                {asset.active ? (
                  <Badge size="xs" color="teal" variant="light">
                    {t("workbench.media.active")}
                  </Badge>
                ) : null}
                {!asset.exists ? (
                  <Badge size="xs" color="red" variant="light">
                    {t("workbench.media.missing")}
                  </Badge>
                ) : null}
              </Group>
              <Text size="xs" c={workstationSurfaces.textMuted} truncate title={asset.sourceVideoPath}>
                {t("workbench.media.localFile")}
              </Text>
              <Group gap={6} mt={6} wrap="nowrap">
                <Button
                  type="button"
                  size="compact-xs"
                  variant={asset.active ? "light" : "subtle"}
                  color="teal"
                  leftSection={<IconPlayerPlay size={14} aria-hidden />}
                  aria-label={t("workbench.media.useAsset", { name: asset.name })}
                  disabled={asset.active || mediaActionBusy}
                  onClick={() => void handleUseMediaAsset(asset)}
                >
                  {t("workbench.media.use")}
                </Button>
                <Button
                  type="button"
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={14} aria-hidden />}
                  aria-label={t("workbench.media.removeAsset", { name: asset.name })}
                  disabled={mediaActionBusy}
                  onClick={() => void handleDeleteMediaAsset(asset)}
                >
                  {t("workbench.media.remove")}
                </Button>
              </Group>
            </Box>
          ))}
          <Button
            type="button"
            size="compact-sm"
            variant="light"
            color="teal"
            leftSection={<IconMovie size={16} aria-hidden />}
            disabled={mediaActionBusy}
            loading={updateSourceMedia.isPending}
            onClick={() => void handleImportVideo()}
            style={{ alignSelf: "stretch", minWidth: 136 }}
          >
            {t("workbench.importVideoAction")}
          </Button>
        </Group>
      ) : mediaBinEmpty ? (
        <Box
          data-testid="project-media-empty-dropzone"
          p="md"
          style={{
            border: `1px dashed ${workstationSurfaces.outlineStrong}`,
            borderRadius: 6,
            background: "#ffffff",
            minHeight: 320,
            display: "grid",
            alignItems: "center"
          }}
        >
          <Group justify="space-between" align="center" gap="sm">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="sm" fw={800} c={workstationSurfaces.text}>
                {t("workbench.media.dropTitle")}
              </Text>
              <Text size="xs" c={workstationSurfaces.textMuted}>
                {t("workbench.media.empty")}
              </Text>
            </Stack>
            <Button
              type="button"
              size="compact-sm"
              color="teal"
              leftSection={<IconMovie size={16} aria-hidden />}
              disabled={mediaActionBusy}
              loading={updateSourceMedia.isPending}
              onClick={() => void handleImportVideo()}
            >
              {t("workbench.importVideoAction")}
            </Button>
          </Group>
        </Box>
      ) : projectSourceVideoPath ? (
        <Box
          p="xs"
          style={{
            border: `1px solid ${workstationSurfaces.outline}`,
            borderRadius: 6,
            background: "#ffffff"
          }}
        >
          <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Group gap={6} wrap="nowrap">
                <Text
                  size="sm"
                  fw={800}
                  c={workstationSurfaces.text}
                  truncate
                  title={projectSourceVideoPath ?? undefined}
                >
                  {activeSourceName ?? t("workbench.media.title")}
                </Text>
                <Badge size="xs" color="teal" variant="light">
                  {t("workbench.media.active")}
                </Badge>
              </Group>
              <Text
                size="xs"
                c={workstationSurfaces.textMuted}
                truncate
                title={projectSourceVideoPath ?? undefined}
              >
                {t("workbench.media.localFile")}
              </Text>
            </Stack>
            <Button
              type="button"
              size="compact-sm"
              variant="light"
              color="teal"
              leftSection={<IconMovie size={16} aria-hidden />}
              disabled={mediaActionBusy}
              loading={updateSourceMedia.isPending}
              onClick={() => void handleImportVideo()}
            >
              {t("workbench.importVideoAction")}
            </Button>
          </Group>
        </Box>
      ) : null}
    </Box>
  ) : null;

  const workbenchHeading = (
    <VisuallyHidden>
      <h1>{t("workbench.title")}</h1>
    </VisuallyHidden>
  );

  if (!activeProjectId) {
    return (
      <Box
        component="main"
        aria-label={t("workbench.title")}
        data-editor-workspace={editorWorkspace}
        bg="#e9edf2"
        style={{
          height: "calc(100vh - 84px)",
          minHeight: 620,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          border: `1px solid ${workstationSurfaces.outline}`,
          borderRadius: 6
        }}
      >
        {workbenchHeading}
        <Box
          component="section"
          role="region"
          aria-label={t("workbench.emptyStateLabel")}
          bg={workstationSurfaces.panel}
          p="xl"
          style={{
            width: "min(560px, 100%)",
            border: `1px solid ${workstationSurfaces.outline}`,
            borderRadius: 6
          }}
        >
          <Stack gap="sm" align="flex-start">
            <Text size="lg" fw={900} c={workstationSurfaces.text}>
              {t("workbench.noProject")}
            </Text>
            <Text size="sm" c={workstationSurfaces.textMuted}>
              {t("workbench.emptyStateDescription")}
            </Text>
            <Button
              type="button"
              size="compact-sm"
              color="teal"
              leftSection={<IconFolderOpen size={16} aria-hidden />}
              onClick={() => setPage("projects")}
            >
              {t("workbench.openProjectLibrary")}
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }

  if (showMediaImportStart) {
    return (
      <Box
        component="main"
        aria-label={t("workbench.title")}
        data-editor-workspace={editorWorkspace}
        bg="#e9edf2"
        style={{
          height: "calc(100vh - 84px)",
          minHeight: 620,
          display: "grid",
          placeItems: "center",
          overflow: "auto",
          border: `1px solid ${workstationSurfaces.outline}`,
          borderRadius: 6
        }}
        >
          {workbenchHeading}
          <Box
            data-testid="workbench-media-start"
            p="lg"
            style={{
              width: "min(960px, 100%)"
            }}
          >
          <Stack gap="sm">
            <Box>
              <Text size="lg" fw={900} c={workstationSurfaces.text}>
                {projectContextTitle}
              </Text>
              <Text size="sm" c={workstationSurfaces.textMuted}>
                {t("workbench.noSourceVideo")}
              </Text>
            </Box>
            {projectMediaBin}
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Box
        component="main"
        aria-label={t("workbench.title")}
        data-editor-workspace={editorWorkspace}
        bg="#e9edf2"
        style={{
          height: "calc(100vh - 84px)",
          minHeight: 620,
          display: "grid",
          gridTemplateRows: recoveryPanelVisible
              ? "auto auto auto auto auto minmax(0, 1fr)"
              : "auto auto auto auto minmax(0, 1fr)",
          overflow: isNarrow ? "auto" : "hidden",
          border: `1px solid ${workstationSurfaces.outline}`,
          borderRadius: 6
        }}
      >
      {workbenchHeading}
      <TopToolbar
        canSave={hasUnsavedChanges && !saveSubtitle.isPending}
        canExport={Boolean(activeProjectId)}
        onImport={activeProjectId ? () => void handleImportVideo() : undefined}
        onInspectorMode={handleToolbarInspectorMode}
        onSave={() => void handleSave()}
      />

      <Box
        component="section"
        aria-label={t("workbench.labels.projectContext")}
        px="sm"
        py={7}
        bg={workstationSurfaces.panelAlt}
        style={{
          borderBottom: `1px solid ${workstationSurfaces.outline}`,
          display: "grid",
          gridTemplateColumns: isNarrow
            ? "minmax(0, 1fr)"
            : "minmax(0, 1fr) minmax(260px, 390px) auto",
          gap: 12,
          alignItems: isNarrow ? "stretch" : "center"
        }}
      >
        <Box style={{ minWidth: 0 }}>
          <Text size="sm" fw={800} c={workstationSurfaces.text} truncate>
            {projectContextTitle}
          </Text>
          <Text size="xs" c={workstationSurfaces.textMuted} truncate>
            {projectContextSource}
          </Text>
        </Box>
        <Box
          component="section"
          role="region"
          aria-label={t("workbench.productionStage.label")}
          px="xs"
          py={6}
          bg={workstationSurfaces.panel}
          style={{
            minWidth: 0,
            border: `1px solid ${workstationSurfaces.outline}`,
            borderRadius: 6
          }}
        >
          <Group gap={8} justify="space-between" wrap={isNarrow ? "wrap" : "nowrap"}>
            <Group gap={6} wrap="nowrap" miw={0}>
              <Badge color="teal" variant="light" size="xs" style={{ flexShrink: 0 }}>
                {t(`workbench.productionStage.${editorWorkspace}.title`)}
              </Badge>
              <Text size="xs" fw={700} c={workstationSurfaces.textMuted} truncate>
                {t(`workbench.productionStage.${editorWorkspace}.goal`)}
              </Text>
            </Group>
            <Button
              type="button"
              aria-label={t(`workbench.productionStage.${editorWorkspace}.action`)}
              size="compact-xs"
              color="teal"
              variant="subtle"
              onClick={openProductionStageControls}
            >
              {t("workbench.productionStage.controls")}
            </Button>
          </Group>
        </Box>
        <Group gap={6} wrap={isNarrow ? "wrap" : "nowrap"} justify={isNarrow ? "flex-start" : "flex-end"}>
          <Button
            type="button"
            size="compact-xs"
            variant={inspectorMode === "settings-lite" ? "light" : "subtle"}
            color={inspectorMode === "settings-lite" ? "teal" : "gray"}
            leftSection={<IconSettings size={14} aria-hidden />}
            onClick={() => setInspectorMode("settings-lite")}
          >
            {t("workbench.projectSettings")}
          </Button>
          <Text size="xs" fw={800} c="teal">
            {t(`workbench.workspaces.${editorWorkspace}`)}
          </Text>
          <Text size="xs" fw={800} c={workstationSurfaces.textMuted}>
            {t("workbench.timeline.subtitleRows", { count: subtitleLines.length })}
          </Text>
          <Text size="xs" fw={800} c={hasUnsavedChanges ? "orange" : "teal"}>
            {hasUnsavedChanges ? t("workbench.unsaved") : t("workbench.saved")}
          </Text>
        </Group>
      </Box>

      <Box
        px="sm"
        py={4}
        bg={workstationSurfaces.panelAlt}
        style={{
          borderBottom: `1px solid ${workstationSurfaces.outline}`
        }}
      >
        <TaskStatusSurface
          busy={taskActive}
          message={taskStatusMessage}
          error={
            taskStatusError
              ? displayWorkbenchErrorMessage(
                  taskStatusError,
                  t("workbench.errors.operationFailed")
                )
              : null
          }
          status={observedTask?.status ?? (taskActive ? "running" : "ready")}
          progress={observedTask?.progress ?? null}
          action={taskStatusAction}
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
          gridTemplateColumns: isNarrow
            ? "minmax(0, 1fr)"
            : `minmax(0, 1fr) ${inspectorColumnWidth}px`,
          gridTemplateRows: isNarrow ? "auto auto" : undefined,
          minHeight: 0,
          overflow: isNarrow ? "visible" : "hidden",
          position: "relative"
        }}
      >
        {!isNarrow && !workspaceLayout.inspectorCollapsed ? (
          <Box
            role="separator"
            aria-label={t("workbench.layout.resizeInspector")}
            aria-orientation="vertical"
            onPointerDown={handleInspectorResizeStart}
            onPointerMove={handleInspectorResize}
            onPointerUp={handleInspectorResizeEnd}
            onPointerCancel={handleInspectorResizeEnd}
            onDoubleClick={handleInspectorResizeReset}
            style={{
              position: "absolute",
              top: 0,
              right: inspectorColumnWidth - 3,
              bottom: 0,
              width: 6,
              cursor: "col-resize",
              zIndex: 4
            }}
          />
        ) : null}
        <Box
          data-testid="workbench-media-stack"
          style={{
            display: "grid",
            gridTemplateRows: isNarrow
              ? `${mediaBinTrack} minmax(260px, auto) minmax(260px, auto) auto`
              : `${mediaBinTrack} ${mediaPreviewTrack} minmax(140px, 1fr) ${timelineDockHeight}px`,
            minHeight: 0
          }}
        >
          {projectMediaBin}
          <Box p="md" bg={workstationSurfaces.panel} style={{ minHeight: 0 }}>
            <VideoPreviewPanel
              emptyDescription={
                activeProjectId ? t("workbench.noSourceVideo") : t("workbench.noProject")
              }
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
              minHeight: isNarrow ? 260 : 0,
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

          <Box
            data-testid="timeline-dock"
            bg={workstationSurfaces.panelAlt}
            style={{
              minHeight: 0,
              height: "100%",
              overflow: "hidden",
              position: "relative",
              borderTop: `1px solid ${workstationSurfaces.outline}`
            }}
          >
            {!isNarrow && !workspaceLayout.bottomCollapsed ? (
              <Box
                role="separator"
                aria-label={t("workbench.layout.resizeTimeline")}
                aria-orientation="horizontal"
                onPointerDown={handleTimelineResizeStart}
                onPointerMove={handleTimelineResize}
                onPointerUp={handleTimelineResizeEnd}
                onPointerCancel={handleTimelineResizeEnd}
                onDoubleClick={handleTimelineResizeReset}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  left: 0,
                  height: 6,
                  cursor: "row-resize",
                  zIndex: 4
                }}
              />
            ) : null}
            {workspaceLayout.bottomCollapsed && !isNarrow ? (
              <Group h="100%" justify="center" align="center">
                <ActionIcon
                  type="button"
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={t("workbench.layout.expandTimeline")}
                  onClick={() => setWorkspaceLayout(editorWorkspace, { bottomCollapsed: false })}
                >
                  <IconChevronUp size={16} aria-hidden />
                </ActionIcon>
              </Group>
            ) : (
              <Box
                h="100%"
                style={{
                  minHeight: 0,
                  overflow: "hidden",
                  paddingTop: isNarrow ? 0 : 6,
                  position: "relative"
                }}
              >
                {!isNarrow ? (
                  <ActionIcon
                    type="button"
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={t("workbench.layout.collapseTimeline")}
                    onClick={() => setWorkspaceLayout(editorWorkspace, { bottomCollapsed: true })}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      zIndex: 5
                    }}
                  >
                    <IconChevronDown size={16} aria-hidden />
                  </ActionIcon>
                ) : null}
                {timelinePanel}
              </Box>
            )}
          </Box>
        </Box>

        {workspaceLayout.inspectorCollapsed && !isNarrow ? (
          <Box
            bg={workstationSurfaces.panel}
            style={{
              minHeight: 0,
              borderLeft: `1px solid ${workstationSurfaces.outline}`,
              display: "grid",
              placeItems: "start center",
              paddingTop: 8
            }}
          >
            <ActionIcon
              type="button"
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t("workbench.layout.expandInspector")}
              onClick={() => setWorkspaceLayout(editorWorkspace, { inspectorCollapsed: false })}
            >
              <IconChevronLeft size={16} aria-hidden />
            </ActionIcon>
          </Box>
        ) : (
          <Box style={{ minHeight: 0, overflow: "hidden", position: "relative" }}>
            {!isNarrow ? (
              <ActionIcon
                type="button"
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={t("workbench.layout.collapseInspector")}
                onClick={() => setWorkspaceLayout(editorWorkspace, { inspectorCollapsed: true })}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  zIndex: 5
                }}
              >
                <IconChevronRight size={16} aria-hidden />
              </ActionIcon>
            ) : null}
            <InspectorPanel
              mode={inspectorMode}
              layout={isNarrow ? "stacked" : "side"}
              onOpenHelp={openInspectorHelp}
            >
              {renderInspectorContent()}
            </InspectorPanel>
          </Box>
        )}
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
