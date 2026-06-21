import { create } from "zustand";
import type { SubtitleExportMode } from "@diplomat/shared";
import type { AppLanguage } from "../app/i18n";

export const LANGUAGE_STORAGE_KEY = "diplomat.language";
export const WORKSPACE_LAYOUT_STORAGE_KEY = "diplomat.workspaceLayouts";
export const PROJECT_DEFAULTS_STORAGE_KEY = "diplomat.projectDefaults";

export type AppPage = "projects" | "workbench" | "tasks" | "help" | "settings";
export type InspectorMode =
  | "line"
  | "analysis"
  | "translation"
  | "style"
  | "export"
  | "settings-lite";
export type EditorWorkspace = "transcription" | "translation" | "timing" | "style" | "delivery";
export type HelpTopic =
  | "quickStart"
  | "projectsMedia"
  | "transcription"
  | "translation"
  | "timingQa"
  | "style"
  | "export"
  | "models"
  | "tasksRecovery"
  | "runtime"
  | "shortcuts"
  | "privacy"
  | "troubleshooting";
export const systemSettingsCategories = [
  "general",
  "appearance",
  "language",
  "runtime",
  "models",
  "shortcuts",
  "privacy",
  "advanced",
  "diagnostics",
  "about",
  "release",
  "defaults"
] as const;
export type SystemSettingsCategory = (typeof systemSettingsCategories)[number];
export type WorkspaceLayout = {
  inspectorWidth: number;
  bottomDockHeight: number;
  inspectorCollapsed: boolean;
  bottomCollapsed: boolean;
};
export type WorkspaceLayouts = Record<EditorWorkspace, WorkspaceLayout>;
export type ProjectDefaults = {
  sourceLanguage: string;
  targetLanguage: string;
  exportMode: SubtitleExportMode;
};
type WorkspaceLayoutUpdateOptions = {
  persist?: boolean;
};

const editorWorkspaces = ["transcription", "translation", "timing", "style", "delivery"] as const;

const defaultProjectDefaults: ProjectDefaults = {
  sourceLanguage: "zh",
  targetLanguage: "en",
  exportMode: "bilingual"
};

export const defaultWorkspaceLayout: WorkspaceLayout = {
  inspectorWidth: 336,
  bottomDockHeight: 210,
  inspectorCollapsed: false,
  bottomCollapsed: false
};

const workspaceLayoutBounds = {
  inspectorWidth: {
    min: 280,
    max: 480
  },
  bottomDockHeight: {
    min: 120,
    max: 360
  }
} as const;

type UiState = {
  currentPage: AppPage;
  activeProjectId: string | null;
  editorWorkspace: EditorWorkspace;
  inspectorMode: InspectorMode;
  selectedLineId: string | null;
  settingsCategory: SystemSettingsCategory;
  language: AppLanguage;
  projectDefaults: ProjectDefaults;
  helpTopic: HelpTopic;
  workspaceLayouts: WorkspaceLayouts;
  timelineCollapsed: boolean;
  commandOpen: boolean;
  setPage: (page: AppPage) => void;
  setActiveProjectId: (projectId: string | null) => void;
  setEditorWorkspace: (workspace: EditorWorkspace) => void;
  setInspectorMode: (mode: InspectorMode) => void;
  setSelectedLineId: (lineId: string | null) => void;
  setSettingsCategory: (category: SystemSettingsCategory) => void;
  setLanguage: (language: AppLanguage) => void;
  setProjectDefaults: (patch: Partial<ProjectDefaults>) => void;
  setHelpTopic: (topic: HelpTopic) => void;
  setWorkspaceLayout: (
    workspace: EditorWorkspace,
    patch: Partial<WorkspaceLayout>,
    options?: WorkspaceLayoutUpdateOptions
  ) => void;
  resetWorkspaceLayouts: () => void;
  setTimelineCollapsed: (collapsed: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  resetUiState: () => void;
};

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "en" || value === "zh";
}

function isSubtitleExportMode(value: unknown): value is SubtitleExportMode {
  return value === "source" || value === "target" || value === "bilingual";
}

function getLanguageStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function createDefaultWorkspaceLayouts(): WorkspaceLayouts {
  return editorWorkspaces.reduce((layouts, workspace) => {
    layouts[workspace] = { ...defaultWorkspaceLayout };
    return layouts;
  }, {} as WorkspaceLayouts);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampNumber(value, min, max)
    : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readLanguageCode(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length >= 2 ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getInitialLanguage(): AppLanguage {
  try {
    const storedLanguage = getLanguageStorage()?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    return isAppLanguage(storedLanguage) ? storedLanguage : "en";
  } catch {
    return "en";
  }
}

function persistLanguage(language: AppLanguage) {
  try {
    getLanguageStorage()?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures; the in-memory UI state still updates.
  }
}

export function getInitialProjectDefaults(): ProjectDefaults {
  try {
    const storedDefaults = getLanguageStorage()?.getItem(PROJECT_DEFAULTS_STORAGE_KEY) ?? null;
    if (!storedDefaults) {
      return { ...defaultProjectDefaults };
    }

    const parsed: unknown = JSON.parse(storedDefaults);
    if (!isRecord(parsed)) {
      return { ...defaultProjectDefaults };
    }

    return {
      sourceLanguage: readLanguageCode(
        parsed.sourceLanguage,
        defaultProjectDefaults.sourceLanguage
      ),
      targetLanguage: readLanguageCode(
        parsed.targetLanguage,
        defaultProjectDefaults.targetLanguage
      ),
      exportMode: isSubtitleExportMode(parsed.exportMode)
        ? parsed.exportMode
        : defaultProjectDefaults.exportMode
    };
  } catch {
    return { ...defaultProjectDefaults };
  }
}

function persistProjectDefaults(projectDefaults: ProjectDefaults) {
  try {
    getLanguageStorage()?.setItem(PROJECT_DEFAULTS_STORAGE_KEY, JSON.stringify(projectDefaults));
  } catch {
    // Ignore storage failures; the in-memory UI state still updates.
  }
}

function getInitialWorkspaceLayouts(): WorkspaceLayouts {
  const layouts = createDefaultWorkspaceLayouts();

  try {
    const storedLayouts = getLanguageStorage()?.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? null;
    if (!storedLayouts) {
      return layouts;
    }

    const parsed: unknown = JSON.parse(storedLayouts);
    if (!isRecord(parsed)) {
      return layouts;
    }

    for (const workspace of editorWorkspaces) {
      const storedLayout = parsed[workspace];
      if (!isRecord(storedLayout)) {
        continue;
      }

      layouts[workspace] = {
        inspectorWidth: readNumber(
          storedLayout.inspectorWidth,
          defaultWorkspaceLayout.inspectorWidth,
          workspaceLayoutBounds.inspectorWidth.min,
          workspaceLayoutBounds.inspectorWidth.max
        ),
        bottomDockHeight: readNumber(
          storedLayout.bottomDockHeight,
          defaultWorkspaceLayout.bottomDockHeight,
          workspaceLayoutBounds.bottomDockHeight.min,
          workspaceLayoutBounds.bottomDockHeight.max
        ),
        inspectorCollapsed: readBoolean(
          storedLayout.inspectorCollapsed,
          defaultWorkspaceLayout.inspectorCollapsed
        ),
        bottomCollapsed: readBoolean(
          storedLayout.bottomCollapsed,
          defaultWorkspaceLayout.bottomCollapsed
        )
      };
    }

    return layouts;
  } catch {
    return layouts;
  }
}

function persistWorkspaceLayouts(workspaceLayouts: WorkspaceLayouts) {
  try {
    getLanguageStorage()?.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(workspaceLayouts));
  } catch {
    // Ignore storage failures; the in-memory UI state still updates.
  }
}

function createInitialState() {
  return {
    currentPage: "projects" as AppPage,
    activeProjectId: null as string | null,
    editorWorkspace: "transcription" as EditorWorkspace,
    inspectorMode: "line" as InspectorMode,
    selectedLineId: null as string | null,
    settingsCategory: "language" as SystemSettingsCategory,
    language: getInitialLanguage(),
    projectDefaults: getInitialProjectDefaults(),
    helpTopic: "quickStart" as HelpTopic,
    workspaceLayouts: getInitialWorkspaceLayouts(),
    timelineCollapsed: false,
    commandOpen: false
  };
}

export const useUiStore = create<UiState>((set) => ({
  ...createInitialState(),
  setPage: (currentPage) => set({ currentPage }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId, selectedLineId: null }),
  setEditorWorkspace: (editorWorkspace) => set({ editorWorkspace }),
  setInspectorMode: (inspectorMode) => set({ inspectorMode }),
  setSelectedLineId: (selectedLineId) =>
    set({
      selectedLineId,
      inspectorMode: "line"
    }),
  setSettingsCategory: (settingsCategory) => set({ settingsCategory }),
  setLanguage: (language) => {
    persistLanguage(language);
    set({ language });
  },
  setProjectDefaults: (patch) =>
    set((state) => {
      const projectDefaults = {
        ...state.projectDefaults,
        ...patch
      };

      persistProjectDefaults(projectDefaults);

      return { projectDefaults };
    }),
  setHelpTopic: (helpTopic) => set({ helpTopic }),
  setWorkspaceLayout: (workspace, patch, options) =>
    set((state) => {
      const currentLayout = state.workspaceLayouts[workspace];
      const nextLayout: WorkspaceLayout = {
        ...currentLayout,
        ...patch,
        inspectorWidth: readNumber(
          patch.inspectorWidth,
          currentLayout.inspectorWidth,
          workspaceLayoutBounds.inspectorWidth.min,
          workspaceLayoutBounds.inspectorWidth.max
        ),
        bottomDockHeight: readNumber(
          patch.bottomDockHeight,
          currentLayout.bottomDockHeight,
          workspaceLayoutBounds.bottomDockHeight.min,
          workspaceLayoutBounds.bottomDockHeight.max
        ),
        inspectorCollapsed: readBoolean(
          patch.inspectorCollapsed,
          currentLayout.inspectorCollapsed
        ),
        bottomCollapsed: readBoolean(patch.bottomCollapsed, currentLayout.bottomCollapsed)
      };
      const workspaceLayouts = {
        ...state.workspaceLayouts,
        [workspace]: nextLayout
      };

      if (options?.persist !== false) {
        persistWorkspaceLayouts(workspaceLayouts);
      }

      return { workspaceLayouts };
    }),
  resetWorkspaceLayouts: () =>
    set(() => {
      const workspaceLayouts = createDefaultWorkspaceLayouts();

      persistWorkspaceLayouts(workspaceLayouts);

      return { workspaceLayouts };
    }),
  setTimelineCollapsed: (timelineCollapsed) => set({ timelineCollapsed }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  resetUiState: () => set(createInitialState())
}));
