import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AnalysisJobRequest,
  ProjectResponse,
  SrtExportMode,
  SrtExportResponse,
  SubtitleDocument,
  SubtitleLine,
  TaskResponse
} from "@diplomat/shared";
import {
  cancelTask,
  createAnalysisJob,
  createProject,
  exportSrt,
  fetchProject,
  fetchSubtitleDocument,
  fetchTask,
  fetchWorkerHealth,
  listProjects,
  retryTask,
  saveSubtitleDocument,
  type WorkerHealth
} from "./api";
import { isDesktopRuntime, pickVideoFile, startWorker } from "./desktop";
import { AnalysisJobPanel } from "./components/AnalysisJobPanel";
import { ExportPanel } from "./components/ExportPanel";
import { ProjectLibraryPanel } from "./components/ProjectLibraryPanel";
import { ProjectImportPanel, type ProjectFormState } from "./components/ProjectImportPanel";
import { SubtitleEditor } from "./components/SubtitleEditor";
import { SubtitleLineList } from "./components/SubtitleLineList";
import { TaskStatusBar } from "./components/TaskStatusBar";
import "./App.css";

const initialProjectForm: ProjectFormState = {
  projectName: "Untitled Project",
  sourceVideoPath: "",
  sourceLanguage: "zh",
  targetLanguage: "en"
};

const initialAnalysisConfig: AnalysisJobRequest = {
  provider: "fake",
  modelNameOrPath: null,
  device: "cpu",
  computeType: "int8",
  sourceLanguage: "zh",
  initialPrompt: null
};

function isAnalysisActive(task: TaskResponse | null) {
  return task?.status === "queued" || task?.status === "running" || task?.status === "canceling";
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown worker error";
}

function isMissingSubtitleError(error: unknown): boolean {
  return formatUnknownError(error).includes("Subtitle document not found");
}

export function App() {
  const mountedRef = useRef(true);
  const analysisRunRef = useRef(0);
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(initialProjectForm);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [document, setDocument] = useState<SubtitleDocument | null>(null);
  const [analysisConfig, setAnalysisConfig] =
    useState<AnalysisJobRequest>(initialAnalysisConfig);
  const [analysisTask, setAnalysisTask] = useState<TaskResponse | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<SrtExportMode>("bilingual");
  const [exportResult, setExportResult] = useState<SrtExportResponse | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPickVideo] = useState(() => isDesktopRuntime());

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    async function loadWorkerContext() {
      const result = await fetchWorkerHealth();
      if (!canceled) {
        setHealth(result);
      }
      const projectList = await listProjects();
      if (!canceled) {
        setProjects(projectList.projects);
      }
    }

    async function bootstrapWorkbench() {
      try {
        await loadWorkerContext();
      } catch (err: unknown) {
        if (!isDesktopRuntime()) {
          if (!canceled) {
            setError(formatUnknownError(err));
          }
          return;
        }

        try {
          const status = await startWorker();
          if (!canceled && status?.message) {
            setMessage(status.message);
          }
          await loadWorkerContext();
          if (!canceled) {
            setError(null);
          }
        } catch (startError: unknown) {
          if (!canceled) {
            setError(formatUnknownError(startError));
          }
        }
      }
    }

    void bootstrapWorkbench();
    return () => {
      canceled = true;
    };
  }, []);

  const selectedLine = useMemo(
    () => document?.lines.find((line) => line.id === selectedLineId) ?? null,
    [document, selectedLineId]
  );
  const analysisActive = isAnalysisActive(analysisTask);
  const exportDisabledReason = analysisActive
    ? "Wait for analysis to finish."
    : hasUnsavedChanges
      ? "Save subtitle edits before exporting."
      : null;
  const canExport = Boolean(project && document && !hasUnsavedChanges && !analysisActive);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(formatUnknownError(err));
    } finally {
      setBusy(false);
    }
  }

  async function refreshProjects() {
    const projectList = await listProjects();
    setProjects(projectList.projects);
  }

  async function finishAnalysisTask(task: TaskResponse) {
    setAnalysisTask(task);
    if (task.status === "completed") {
      if (!project) {
        return;
      }
      const loadedDocument = await fetchSubtitleDocument(project.projectId);
      setDocument(loadedDocument);
      setSelectedLineId(loadedDocument.lines[0]?.id ?? null);
      setExportResult(null);
      setHasUnsavedChanges(false);
      setMessage("Analysis completed");
      setError(null);
      await refreshProjects();
      return;
    }

    if (task.status === "canceled") {
      setMessage("Analysis canceled");
      return;
    }

    if (task.status === "failed") {
      const failureMessage = task.errorMessage ?? task.message;
      setMessage(failureMessage);
      setError(failureMessage);
    }
  }

  async function monitorAnalysisTask(startingTask: TaskResponse, runId: number) {
    let currentTask = startingTask;
    if (!isAnalysisActive(currentTask)) {
      if (analysisRunRef.current !== runId) {
        return;
      }
      await finishAnalysisTask(currentTask);
      return;
    }

    while (isAnalysisActive(currentTask)) {
      await delay(500);
      if (!mountedRef.current || analysisRunRef.current !== runId) {
        return;
      }
      currentTask = await fetchTask(currentTask.taskId);
      setAnalysisTask(currentTask);
    }
    if (analysisRunRef.current !== runId) {
      return;
    }
    await finishAnalysisTask(currentTask);
  }

  function handlePickVideo() {
    void runAction(async () => {
      const selectedPath = await pickVideoFile();
      if (selectedPath) {
        setProjectForm((currentForm) => ({ ...currentForm, sourceVideoPath: selectedPath }));
        setMessage("Video path selected");
      }
    });
  }

  function handleCreateProject() {
    void runAction(async () => {
      const createdProject = await createProject({
        name: projectForm.projectName.trim(),
        sourceVideoPath: projectForm.sourceVideoPath.trim(),
        sourceLanguage: projectForm.sourceLanguage.trim(),
        targetLanguage: projectForm.targetLanguage.trim()
          ? projectForm.targetLanguage.trim()
          : null
      });
      setProject(createdProject);
      setDocument(null);
      setSelectedLineId(null);
      setExportResult(null);
      setHasUnsavedChanges(false);
      setAnalysisTask(null);
      setAnalysisConfig((currentConfig) => ({
        ...currentConfig,
        sourceLanguage: createdProject.sourceLanguage
      }));
      setMessage("Project created");
      await refreshProjects();
    });
  }

  function handleReopenProject(projectId: string) {
    void runAction(async () => {
      const reopenedProject = await fetchProject(projectId);
      setProject(reopenedProject);
      setProjectForm({
        projectName: reopenedProject.name,
        sourceVideoPath: reopenedProject.sourceVideoPath,
        sourceLanguage: reopenedProject.sourceLanguage,
        targetLanguage: reopenedProject.targetLanguage ?? ""
      });
      setExportResult(null);
      setHasUnsavedChanges(false);
      setAnalysisTask(null);
      setAnalysisConfig((currentConfig) => ({
        ...currentConfig,
        sourceLanguage: reopenedProject.sourceLanguage
      }));

      try {
        const loadedDocument = await fetchSubtitleDocument(projectId);
        setDocument(loadedDocument);
        setSelectedLineId(loadedDocument.lines[0]?.id ?? null);
        setMessage("Project reopened with subtitles");
      } catch (err: unknown) {
        if (!isMissingSubtitleError(err)) {
          throw err;
        }
        setDocument(null);
        setSelectedLineId(null);
        setMessage("Project reopened");
      }

      await refreshProjects();
    });
  }

  function handleAnalyzeProject() {
    if (!project) {
      return;
    }

    void startAnalysisJob();
  }

  async function startAnalysisJob() {
    if (!project) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const task = await createAnalysisJob(project.projectId, {
        ...analysisConfig,
        sourceLanguage: analysisConfig.sourceLanguage ?? project.sourceLanguage
      });
      const runId = analysisRunRef.current + 1;
      analysisRunRef.current = runId;
      setAnalysisTask(task);
      setDocument(null);
      setSelectedLineId(null);
      setExportResult(null);
      setHasUnsavedChanges(false);
      setMessage(task.message);
      void monitorAnalysisTask(task, runId).catch((err: unknown) => {
        if (mountedRef.current) {
          setError(formatUnknownError(err));
        }
      });
    } catch (err: unknown) {
      setError(formatUnknownError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleCancelAnalysis() {
    if (!analysisTask) {
      return;
    }

    void runAction(async () => {
      analysisRunRef.current += 1;
      const task = await cancelTask(analysisTask.taskId);
      await finishAnalysisTask(task);
    });
  }

  function handleRetryAnalysis() {
    if (!analysisTask) {
      return;
    }

    void runAction(async () => {
      const task = await retryTask(analysisTask.taskId);
      const runId = analysisRunRef.current + 1;
      analysisRunRef.current = runId;
      setAnalysisTask(task);
      setMessage(task.message);
      setError(null);
      await monitorAnalysisTask(task, runId);
    });
  }

  function handleUpdateLine(nextLine: SubtitleLine) {
    setDocument((currentDocument) => {
      if (!currentDocument) {
        return currentDocument;
      }

      return {
        ...currentDocument,
        lines: currentDocument.lines.map((line) => (line.id === nextLine.id ? nextLine : line))
      };
    });
    setHasUnsavedChanges(true);
    setExportResult(null);
    setMessage("Unsaved subtitle edits");
  }

  function handleSaveSubtitle() {
    if (!project || !document) {
      return;
    }

    void runAction(async () => {
      const savedDocument = await saveSubtitleDocument(project.projectId, document);
      setDocument(savedDocument);
      setHasUnsavedChanges(false);
      setMessage("Saved subtitle edits");
      await refreshProjects();
    });
  }

  function handleExportSrt() {
    if (!project || !document || hasUnsavedChanges) {
      return;
    }

    void runAction(async () => {
      const result = await exportSrt(project.projectId, exportMode);
      setExportResult(result);
      setMessage("SRT export completed");
      await refreshProjects();
    });
  }

  function handleExportModeChange(mode: SrtExportMode) {
    setExportMode(mode);
    setExportResult(null);
  }

  return (
    <main className="app-shell">
      <TaskStatusBar health={health} message={message} error={error} busy={busy || analysisActive} />

      <div className="workspace-layout">
        <ProjectLibraryPanel
          projects={projects}
          selectedProjectId={project?.projectId ?? null}
          busy={busy}
          onReopenProject={handleReopenProject}
        />

        <div className="workspace-main">
          <ProjectImportPanel
            form={projectForm}
            project={project}
            busy={busy || analysisActive}
            canPickVideo={canPickVideo}
            onFormChange={setProjectForm}
            onPickVideo={handlePickVideo}
            onCreateProject={handleCreateProject}
            onAnalyzeProject={handleAnalyzeProject}
          />

          <AnalysisJobPanel
            disabled={!project || busy}
            task={analysisTask}
            config={analysisConfig}
            onConfigChange={setAnalysisConfig}
            onStart={handleAnalyzeProject}
            onCancel={handleCancelAnalysis}
            onRetry={handleRetryAnalysis}
          />

          <div className="workbench-grid" aria-label="Subtitle workbench">
            <SubtitleLineList
              lines={document?.lines ?? []}
              selectedLineId={selectedLineId}
              onSelectLine={setSelectedLineId}
            />
            <SubtitleEditor
              line={selectedLine}
              busy={busy || analysisActive}
              onChangeLine={handleUpdateLine}
              onSave={handleSaveSubtitle}
            />
            <ExportPanel
              mode={exportMode}
              exportResult={exportResult}
              canExport={canExport}
              disabledReason={exportDisabledReason}
              busy={busy}
              onModeChange={handleExportModeChange}
              onExport={handleExportSrt}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
