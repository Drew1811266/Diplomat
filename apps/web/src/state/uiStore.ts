import { create } from "zustand";
import type { AppLanguage } from "../app/i18n";

export type AppPage = "projects" | "workbench" | "tasks" | "settings";
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

const initialState = {
  currentPage: "projects" as AppPage,
  activeProjectId: null as string | null,
  inspectorMode: "line" as InspectorMode,
  selectedLineId: null as string | null,
  language: "en" as AppLanguage,
  timelineCollapsed: false,
  commandOpen: false
};

export const useUiStore = create<UiState>((set) => ({
  ...initialState,
  setPage: (currentPage) => set({ currentPage }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId, selectedLineId: null }),
  setInspectorMode: (inspectorMode) => set({ inspectorMode }),
  setSelectedLineId: (selectedLineId) =>
    set({
      selectedLineId,
      inspectorMode: "line"
    }),
  setLanguage: (language) => set({ language }),
  setTimelineCollapsed: (timelineCollapsed) => set({ timelineCollapsed }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  resetUiState: () => set(initialState)
}));
