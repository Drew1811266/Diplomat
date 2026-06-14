import { create } from "zustand";
import type { AppLanguage } from "../app/i18n";

export const LANGUAGE_STORAGE_KEY = "diplomat.language";

export type AppPage = "projects" | "workbench" | "models" | "tasks" | "help" | "settings";
export type InspectorMode = "line" | "analysis" | "translation" | "export" | "settings-lite";

type UiState = {
  currentPage: AppPage;
  activeProjectId: string | null;
  inspectorMode: InspectorMode;
  selectedLineId: string | null;
  language: AppLanguage;
  timelineCollapsed: boolean;
  commandOpen: boolean;
  setPage: (page: AppPage) => void;
  setActiveProjectId: (projectId: string | null) => void;
  setInspectorMode: (mode: InspectorMode) => void;
  setSelectedLineId: (lineId: string | null) => void;
  setLanguage: (language: AppLanguage) => void;
  setTimelineCollapsed: (collapsed: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  resetUiState: () => void;
};

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "en" || value === "zh";
}

function getLanguageStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
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

function createInitialState() {
  return {
    currentPage: "projects" as AppPage,
    activeProjectId: null as string | null,
    inspectorMode: "line" as InspectorMode,
    selectedLineId: null as string | null,
    language: getInitialLanguage(),
    timelineCollapsed: false,
    commandOpen: false
  };
}

export const useUiStore = create<UiState>((set) => ({
  ...createInitialState(),
  setPage: (currentPage) => set({ currentPage }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId, selectedLineId: null }),
  setInspectorMode: (inspectorMode) => set({ inspectorMode }),
  setSelectedLineId: (selectedLineId) =>
    set({
      selectedLineId,
      inspectorMode: "line"
    }),
  setLanguage: (language) => {
    persistLanguage(language);
    set({ language });
  },
  setTimelineCollapsed: (timelineCollapsed) => set({ timelineCollapsed }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  resetUiState: () => set(createInitialState())
}));
