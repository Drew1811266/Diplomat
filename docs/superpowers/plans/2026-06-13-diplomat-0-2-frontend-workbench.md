# Diplomat 0.2 Frontend Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Diplomat 0.2 frontend experience: a modern Mantine-based desktop-style project center and media-centered subtitle workbench with i18n, Query-managed Worker data, UI shell state, E2E coverage, and visual regression.

**Architecture:** Keep the Python Worker and Tauri command surface mostly unchanged. Replace the current monolithic React `App.tsx` workflow with provider-based app infrastructure, page-level components, resource hooks backed by TanStack Query, and a small UI shell store for local navigation and inspector state.

**Tech Stack:** React 19, TypeScript, Vite, Mantine, TanStack Query, Zustand, i18next/react-i18next, Vitest, Testing Library, Playwright, Tauri 2, existing FastAPI Worker.

---

## Source Spec

Use this approved design as the source of truth:

- `docs/superpowers/specs/2026-06-13-diplomat-0-2-frontend-workbench-design.md`

## External References

Use official docs for package setup and behavior:

- Mantine getting started and Vite guide: `https://mantine.dev/getting-started/`, `https://mantine.dev/guides/vite/`
- TanStack Query React installation: `https://tanstack.com/query/v5/docs/framework/react/installation`
- Zustand TypeScript guide: `https://zustand.docs.pmnd.rs/learn/guides/beginner-typescript`
- Playwright installation and browser setup: `https://playwright.dev/docs/intro`, `https://playwright.dev/docs/browsers`

## File Structure

Create these frontend units and keep their responsibilities narrow.

### App Infrastructure

- `apps/web/src/App.tsx` - top-level route/page selector only.
- `apps/web/src/app/AppProviders.tsx` - Mantine, Query, i18n, notifications, and app-level providers.
- `apps/web/src/app/AppShellLayout.tsx` - Mantine shell frame shared by project center, workbench, settings, and tasks.
- `apps/web/src/app/queryClient.ts` - QueryClient factory and test-safe defaults.
- `apps/web/src/app/theme.ts` - Mantine theme tokens for light professional workbench.
- `apps/web/src/app/i18n.ts` - i18next initialization.
- `apps/web/src/app/i18nKeys.ts` - typed key helpers if useful for tests.

### State

- `apps/web/src/state/uiStore.ts` - Zustand shell state for current page, inspector mode, selected line, language, and collapsed surfaces.
- `apps/web/src/state/uiStore.test.ts` - store behavior tests.

### API Data Hooks

- `apps/web/src/queries/queryKeys.ts` - stable Query key factories.
- `apps/web/src/queries/workerQueries.ts` - Worker health and desktop worker status hooks.
- `apps/web/src/queries/projectQueries.ts` - project list, create project, fetch project, reopen project.
- `apps/web/src/queries/subtitleQueries.ts` - subtitle document fetch/save helpers.
- `apps/web/src/queries/taskQueries.ts` - analysis and translation task mutation and polling helpers.
- `apps/web/src/queries/exportQueries.ts` - SRT export mutation.
- `apps/web/src/queries/queryTestUtils.tsx` - Query test wrapper and fake client setup.
- `apps/web/src/queries/*.test.tsx` - focused hook tests.

### i18n

- `apps/web/src/i18n/en.ts` - English core UI strings.
- `apps/web/src/i18n/zh.ts` - Chinese core UI strings.
- `apps/web/src/i18n/i18n.test.ts` - key completeness tests.

### Fixtures And Test Utilities

- `apps/web/src/test/fixtures.ts` - project, task, subtitle document, and translation settings fixtures.
- `apps/web/src/test/serverMocks.ts` - fetch mocks and Worker response helpers for component and E2E-like tests.
- `apps/web/src/test/render.tsx` - Testing Library render helper with providers.

### Pages

- `apps/web/src/pages/ProjectCenterPage.tsx`
- `apps/web/src/pages/ProjectCenterPage.test.tsx`
- `apps/web/src/pages/WorkbenchPage.tsx`
- `apps/web/src/pages/WorkbenchPage.test.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/pages/SettingsPage.test.tsx`

### Components

- `apps/web/src/components/AppRail.tsx`
- `apps/web/src/components/TopToolbar.tsx`
- `apps/web/src/components/TaskStatusSurface.tsx`
- `apps/web/src/components/VideoPreviewPanel.tsx`
- `apps/web/src/components/TimelineStrip.tsx`
- `apps/web/src/components/SubtitleGrid.tsx`
- `apps/web/src/components/InspectorPanel.tsx`
- `apps/web/src/components/inspectors/LineInspector.tsx`
- `apps/web/src/components/inspectors/AnalysisInspector.tsx`
- `apps/web/src/components/inspectors/TranslationInspector.tsx`
- `apps/web/src/components/inspectors/ExportInspector.tsx`
- `apps/web/src/components/LanguageSwitcher.tsx`

Existing components in `apps/web/src/components` can be migrated into the new components, then removed when no longer imported:

- `AnalysisJobPanel.tsx`
- `TranslationJobPanel.tsx`
- `ProjectImportPanel.tsx`
- `ProjectLibraryPanel.tsx`
- `SubtitleLineList.tsx`
- `SubtitleEditor.tsx`
- `ExportPanel.tsx`
- `TaskStatusBar.tsx`

### E2E And Visual Regression

- `apps/web/playwright.config.ts` - Playwright config for web and visual tests.
- `apps/web/e2e/fixtures.ts` - E2E test data and route mocking.
- `apps/web/e2e/project-center.spec.ts`
- `apps/web/e2e/workbench.spec.ts`
- `apps/web/e2e/visual.spec.ts`
- `apps/web/e2e/desktop-smoke.spec.ts` - desktop-flow target; use Windows/Tauri assumptions and provide a controlled fallback path.
- `apps/web/e2e/screenshots/` - committed visual baselines only when stable.

### Scripts And Package Metadata

- `apps/web/package.json` - add dependencies and scripts.
- `apps/web/vite.config.ts` - test and dev-server support.
- `apps/web/tsconfig.json` - include new E2E config only if TypeScript needs it.
- `scripts/check.ps1` - keep existing fast checks and add documented E2E command only when stable enough for local verification.
- `docs/development/0-2-frontend-workbench.md` - manual test notes and release checklist for 0.2.

## Implementation Tasks

### Task 1: Dependency And Provider Foundation

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/app/queryClient.ts`
- Create: `apps/web/src/app/theme.ts`
- Create: `apps/web/src/app/i18n.ts`
- Create: `apps/web/src/app/AppProviders.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/app/AppProviders.test.tsx`

- [ ] **Step 1: Add frontend dependencies**

Run:

```powershell
corepack pnpm --dir apps/web add @mantine/core @mantine/hooks @mantine/notifications @tanstack/react-query zustand i18next react-i18next @tabler/icons-react
corepack pnpm --dir apps/web add -D @testing-library/user-event
```

Expected:

- `apps/web/package.json` includes the new runtime dependencies.
- `pnpm-lock.yaml` changes.
- Command exits 0.

- [ ] **Step 2: Write provider smoke test**

Create `apps/web/src/app/AppProviders.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./AppProviders";

describe("AppProviders", () => {
  it("renders children inside Mantine, Query, and i18n providers", () => {
    render(
      <AppProviders>
        <button type="button">Provider child</button>
      </AppProviders>
    );

    expect(screen.getByRole("button", { name: "Provider child" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/app/AppProviders.test.tsx
```

Expected:

- FAIL because `AppProviders` does not exist.

- [ ] **Step 4: Add QueryClient factory**

Create `apps/web/src/app/queryClient.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: 0
      }
    }
  });
}
```

- [ ] **Step 5: Add Mantine theme**

Create `apps/web/src/app/theme.ts`:

```ts
import { createTheme, rem } from "@mantine/core";

export const appTheme = createTheme({
  primaryColor: "teal",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  headings: {
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  },
  radius: {
    xs: rem(3),
    sm: rem(4),
    md: rem(6),
    lg: rem(8),
    xl: rem(8)
  },
  colors: {
    diplomatTeal: [
      "#e6fffb",
      "#c8f7f0",
      "#99f6e4",
      "#5eead4",
      "#2dd4bf",
      "#14b8a6",
      "#0f766e",
      "#115e59",
      "#134e4a",
      "#042f2e"
    ]
  }
});
```

- [ ] **Step 6: Add i18n bootstrap**

Create `apps/web/src/app/i18n.ts`:

```ts
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      "app.name": "Diplomat"
    }
  },
  zh: {
    translation: {
      "app.name": "Diplomat"
    }
  }
};

export const appI18n = i18next.createInstance();

void appI18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});
```

- [ ] **Step 7: Add AppProviders**

Create `apps/web/src/app/AppProviders.tsx`:

```tsx
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { useState, type ReactNode } from "react";
import { appI18n } from "./i18n";
import { createAppQueryClient } from "./queryClient";
import { appTheme } from "./theme";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <I18nextProvider i18n={appI18n}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={appTheme} defaultColorScheme="light">
          <Notifications position="top-right" />
          {children}
        </MantineProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
```

- [ ] **Step 8: Wrap the app**

Modify `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProviders } from "./app/AppProviders";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);
```

- [ ] **Step 9: Run provider test**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/app/AppProviders.test.tsx
```

Expected:

- PASS.

- [ ] **Step 10: Run web typecheck**

Run:

```powershell
corepack pnpm --dir apps/web typecheck
```

Expected:

- PASS.

- [ ] **Step 11: Commit**

```powershell
git add apps/web/package.json pnpm-lock.yaml apps/web/src/app apps/web/src/main.tsx
git commit -m "feat(web): add 0.2 app providers"
```

### Task 2: i18n Resources And Language Store

**Files:**
- Create: `apps/web/src/i18n/en.ts`
- Create: `apps/web/src/i18n/zh.ts`
- Modify: `apps/web/src/app/i18n.ts`
- Create: `apps/web/src/state/uiStore.ts`
- Create: `apps/web/src/state/uiStore.test.ts`
- Create: `apps/web/src/i18n/i18n.test.ts`

- [ ] **Step 1: Write i18n completeness test**

Create `apps/web/src/i18n/i18n.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { en } from "./en";
import { zh } from "./zh";

function flattenKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return flattenKeys(entry as Record<string, unknown>, nextKey);
    }
    return [nextKey];
  });
}

describe("i18n resources", () => {
  it("keeps English and Chinese keys aligned", () => {
    expect(flattenKeys(zh).sort()).toEqual(flattenKeys(en).sort());
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/i18n/i18n.test.ts
```

Expected:

- FAIL because `en.ts` and `zh.ts` do not exist.

- [ ] **Step 3: Add English resource**

Create `apps/web/src/i18n/en.ts`:

```ts
export const en = {
  app: {
    name: "Diplomat",
    subtitle: "Subtitle Workbench"
  },
  nav: {
    projects: "Projects",
    workbench: "Workbench",
    tasks: "Tasks",
    settings: "Settings"
  },
  projectCenter: {
    title: "Project Center",
    description: "Open a recent subtitle project or import a video to start a new one.",
    recentProjects: "Recent Projects",
    createProject: "Create Project",
    importVideo: "Import Video",
    noProjects: "No recent projects",
    noProjectsHint: "Import a video to create your first local project.",
    workerReady: "Worker ready",
    workerStarting: "Worker starting",
    workerUnavailable: "Worker unavailable",
    retryWorker: "Retry Worker"
  },
  toolbar: {
    import: "Import",
    analyze: "Analyze",
    translate: "Translate",
    save: "Save",
    export: "Export"
  },
  workbench: {
    noProject: "No project selected",
    noDocument: "No subtitle document",
    unsaved: "Unsaved changes",
    saved: "Saved",
    previewUnavailable: "Video preview unavailable",
    subtitleGrid: "Subtitle Grid"
  },
  inspector: {
    line: "Line",
    analysis: "Analysis",
    translation: "Translation",
    export: "Export",
    emptyLine: "Select a subtitle row to edit timing and text."
  },
  fields: {
    projectName: "Project name",
    sourceVideoPath: "Source video path",
    sourceLanguage: "Source language",
    targetLanguage: "Target language",
    startMs: "Start ms",
    endMs: "End ms",
    sourceText: "Source text",
    translatedText: "Translated text",
    provider: "Provider",
    model: "Model",
    device: "Device",
    computeType: "Compute type",
    initialPrompt: "Initial prompt",
    endpoint: "Endpoint",
    apiKeyEnv: "API key env",
    exportMode: "Export mode"
  },
  actions: {
    start: "Start",
    cancel: "Cancel",
    retry: "Retry",
    open: "Open",
    save: "Save",
    close: "Close"
  },
  settings: {
    title: "Settings",
    language: "Interface language",
    theme: "Theme",
    worker: "Worker",
    defaults: "Defaults",
    defaultExportMode: "Default export mode"
  },
  status: {
    ready: "Ready",
    running: "Running",
    queued: "Queued",
    completed: "Completed",
    failed: "Failed",
    canceled: "Canceled",
    blocked: "Blocked"
  }
} as const;
```

- [ ] **Step 4: Add Chinese resource**

Create `apps/web/src/i18n/zh.ts`:

```ts
export const zh = {
  app: {
    name: "Diplomat",
    subtitle: "字幕工作台"
  },
  nav: {
    projects: "项目",
    workbench: "工作台",
    tasks: "任务",
    settings: "设置"
  },
  projectCenter: {
    title: "项目中心",
    description: "打开最近的字幕项目，或导入视频创建新项目。",
    recentProjects: "最近项目",
    createProject: "创建项目",
    importVideo: "导入视频",
    noProjects: "暂无最近项目",
    noProjectsHint: "导入一个视频来创建第一个本地项目。",
    workerReady: "Worker 已就绪",
    workerStarting: "Worker 启动中",
    workerUnavailable: "Worker 不可用",
    retryWorker: "重试 Worker"
  },
  toolbar: {
    import: "导入",
    analyze: "分析",
    translate: "翻译",
    save: "保存",
    export: "导出"
  },
  workbench: {
    noProject: "未选择项目",
    noDocument: "暂无字幕文档",
    unsaved: "有未保存修改",
    saved: "已保存",
    previewUnavailable: "视频预览不可用",
    subtitleGrid: "字幕表格"
  },
  inspector: {
    line: "字幕行",
    analysis: "分析",
    translation: "翻译",
    export: "导出",
    emptyLine: "请选择一条字幕来编辑时间和文本。"
  },
  fields: {
    projectName: "项目名称",
    sourceVideoPath: "源视频路径",
    sourceLanguage: "源语言",
    targetLanguage: "目标语言",
    startMs: "开始毫秒",
    endMs: "结束毫秒",
    sourceText: "源文",
    translatedText: "译文",
    provider: "提供方",
    model: "模型",
    device: "设备",
    computeType: "计算类型",
    initialPrompt: "初始提示词",
    endpoint: "服务地址",
    apiKeyEnv: "API key 环境变量",
    exportMode: "导出模式"
  },
  actions: {
    start: "开始",
    cancel: "取消",
    retry: "重试",
    open: "打开",
    save: "保存",
    close: "关闭"
  },
  settings: {
    title: "设置",
    language: "界面语言",
    theme: "主题",
    worker: "Worker",
    defaults: "默认值",
    defaultExportMode: "默认导出模式"
  },
  status: {
    ready: "就绪",
    running: "运行中",
    queued: "排队中",
    completed: "已完成",
    failed: "失败",
    canceled: "已取消",
    blocked: "已阻塞"
  }
} as const;
```

- [ ] **Step 5: Update i18n bootstrap**

Modify `apps/web/src/app/i18n.ts`:

```ts
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "../i18n/en";
import { zh } from "../i18n/zh";

export type AppLanguage = "en" | "zh";

export const appI18n = i18next.createInstance();

void appI18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh }
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});
```

- [ ] **Step 6: Write UI store test**

Create `apps/web/src/state/uiStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUiStore.getState().resetUiState();
  });

  it("tracks page, inspector mode, selected line, and language", () => {
    useUiStore.getState().setPage("settings");
    useUiStore.getState().setInspectorMode("translation");
    useUiStore.getState().setSelectedLineId("line-1");
    useUiStore.getState().setLanguage("zh");

    expect(useUiStore.getState().currentPage).toBe("settings");
    expect(useUiStore.getState().inspectorMode).toBe("translation");
    expect(useUiStore.getState().selectedLineId).toBe("line-1");
    expect(useUiStore.getState().language).toBe("zh");
  });

  it("selecting a line returns the inspector to line mode", () => {
    useUiStore.getState().setInspectorMode("export");
    useUiStore.getState().setSelectedLineId("line-2");

    expect(useUiStore.getState().selectedLineId).toBe("line-2");
    expect(useUiStore.getState().inspectorMode).toBe("line");
  });
});
```

- [ ] **Step 7: Run store test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/state/uiStore.test.ts
```

Expected:

- FAIL because `uiStore.ts` does not exist.

- [ ] **Step 8: Add UI store**

Create `apps/web/src/state/uiStore.ts`:

```ts
import { create } from "zustand";
import type { AppLanguage } from "../app/i18n";

export type AppPage = "projects" | "workbench" | "tasks" | "settings";
export type InspectorMode = "line" | "analysis" | "translation" | "export" | "settings-lite";

type UiState = {
  currentPage: AppPage;
  inspectorMode: InspectorMode;
  selectedLineId: string | null;
  language: AppLanguage;
  timelineCollapsed: boolean;
  commandOpen: boolean;
  setPage: (page: AppPage) => void;
  setInspectorMode: (mode: InspectorMode) => void;
  setSelectedLineId: (lineId: string | null) => void;
  setLanguage: (language: AppLanguage) => void;
  setTimelineCollapsed: (collapsed: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  resetUiState: () => void;
};

const initialState = {
  currentPage: "projects" as AppPage,
  inspectorMode: "line" as InspectorMode,
  selectedLineId: null as string | null,
  language: "en" as AppLanguage,
  timelineCollapsed: false,
  commandOpen: false
};

export const useUiStore = create<UiState>((set) => ({
  ...initialState,
  setPage: (currentPage) => set({ currentPage }),
  setInspectorMode: (inspectorMode) => set({ inspectorMode }),
  setSelectedLineId: (selectedLineId) =>
    set({
      selectedLineId,
      inspectorMode: selectedLineId ? "line" : "line"
    }),
  setLanguage: (language) => set({ language }),
  setTimelineCollapsed: (timelineCollapsed) => set({ timelineCollapsed }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  resetUiState: () => set(initialState)
}));
```

- [ ] **Step 9: Run i18n and store tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/i18n/i18n.test.ts src/state/uiStore.test.ts
```

Expected:

- PASS.

- [ ] **Step 10: Commit**

```powershell
git add apps/web/src/app/i18n.ts apps/web/src/i18n apps/web/src/state
git commit -m "feat(web): add i18n and ui shell store"
```

### Task 3: Query Hooks And Test Fixtures

**Files:**
- Create: `apps/web/src/test/fixtures.ts`
- Create: `apps/web/src/test/serverMocks.ts`
- Create: `apps/web/src/test/render.tsx`
- Create: `apps/web/src/queries/queryKeys.ts`
- Create: `apps/web/src/queries/projectQueries.ts`
- Create: `apps/web/src/queries/workerQueries.ts`
- Create: `apps/web/src/queries/subtitleQueries.ts`
- Create: `apps/web/src/queries/taskQueries.ts`
- Create: `apps/web/src/queries/exportQueries.ts`
- Create: `apps/web/src/queries/queryTestUtils.tsx`
- Test: `apps/web/src/queries/projectQueries.test.tsx`
- Test: `apps/web/src/queries/taskQueries.test.tsx`

- [ ] **Step 1: Add shared test fixtures**

Create `apps/web/src/test/fixtures.ts` by moving the existing `projectMetadata`, `analyzedDocument`, `translatedDocument`, and task objects from `apps/web/tests/App.test.tsx` into exports:

```ts
import type { ProjectResponse, SubtitleDocument, TaskResponse } from "@diplomat/shared";

export const projectFixture: ProjectResponse = {
  projectId: "project-demo",
  name: "Demo",
  sourceVideoPath: "D:/media/demo.mp4",
  projectDir: "D:/Diplomat/projects/project-demo",
  durationMs: 12_000,
  sourceLanguage: "zh",
  targetLanguage: "en",
  createdAt: "2026-06-07T00:00:00+00:00",
  updatedAt: "2026-06-07T00:01:00+00:00",
  hasSubtitleDocument: false
};

export const analyzedDocumentFixture: SubtitleDocument = {
  schemaVersion: "diplomat.subtitle.v1",
  projectId: "project-demo",
  mediaId: "media-demo",
  durationMs: 12_000,
  speakers: [
    {
      id: "speaker-1",
      displayName: "Speaker 1",
      color: "#0D9488",
      styleId: "default",
      mergedInto: null
    }
  ],
  styles: [
    {
      id: "default",
      name: "Default",
      fontFamily: "Arial",
      fontSize: 36,
      primaryColor: "#FFFFFF",
      secondaryColor: "#14B8A6",
      strokeWidth: 3,
      shadow: 1,
      position: "bottom-center",
      marginV: 48,
      alignment: "center",
      bilingualLayout: "source-above-target",
      lineSpacing: 1.15
    }
  ],
  lines: [
    {
      id: "line-1",
      startMs: 1000,
      endMs: 2400,
      speakerId: "speaker-1",
      sourceLanguage: "zh",
      targetLanguage: "en",
      sourceText: "原始字幕文本",
      translatedText: "",
      words: [{ text: "原始字幕文本", startMs: 1000, endMs: 2400, confidence: 0.95 }],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "mock-asr", model: "mock-v1" },
      translationStatus: "not_requested",
      translationOrigin: null,
      translationError: null,
      notes: ""
    }
  ]
};

export const translatedDocumentFixture: SubtitleDocument = {
  ...analyzedDocumentFixture,
  lines: [
    {
      ...analyzedDocumentFixture.lines[0]!,
      translatedText: "[en] 原始字幕文本",
      translationStatus: "translated",
      translationOrigin: { provider: "fake", model: "fake-v1" },
      translationError: null
    }
  ]
};

export const completedAnalysisTaskFixture: TaskResponse = {
  taskId: "task-1",
  projectId: "project-demo",
  type: "analysis",
  status: "completed",
  progress: 1,
  message: "Analysis completed",
  startedAt: "2026-06-07T00:00:00+00:00",
  updatedAt: "2026-06-07T00:00:01+00:00",
  completedAt: "2026-06-07T00:00:01+00:00",
  errorCode: null,
  errorMessage: null,
  diagnosticLogPath: null
};
```

- [ ] **Step 2: Add query keys**

Create `apps/web/src/queries/queryKeys.ts`:

```ts
export const queryKeys = {
  workerHealth: ["worker", "health"] as const,
  desktopWorkerStatus: ["desktop", "worker-status"] as const,
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  subtitle: (projectId: string) => ["projects", projectId, "subtitle"] as const,
  translationSettings: (projectId: string) =>
    ["projects", projectId, "translation-settings"] as const,
  task: (taskId: string) => ["tasks", taskId] as const
};
```

- [ ] **Step 3: Write project hook test**

Create `apps/web/src/queries/projectQueries.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { projectFixture } from "../test/fixtures";
import { createQueryWrapper } from "./queryTestUtils";
import { useProjectsQuery } from "./projectQueries";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projectQueries", () => {
  it("loads projects through TanStack Query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ projects: [projectFixture] })
      })) as typeof fetch
    );

    const { result } = renderHook(() => useProjectsQuery(), {
      wrapper: createQueryWrapper()
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.projects).toHaveLength(1);
    expect(result.current.data?.projects[0]?.name).toBe("Demo");
  });
});
```

- [ ] **Step 4: Run test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/queries/projectQueries.test.tsx
```

Expected:

- FAIL because query utilities and hooks do not exist.

- [ ] **Step 5: Add Query test wrapper**

Create `apps/web/src/queries/queryTestUtils.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: false
      }
    }
  });
}

export function createQueryWrapper() {
  const client = createTestQueryClient();
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
```

- [ ] **Step 6: Add project query hooks**

Create `apps/web/src/queries/projectQueries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, fetchProject, listProjects, type CreateProjectInput } from "../api";
import { queryKeys } from "./queryKeys";

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => listProjects()
  });
}

export function useProjectQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.project(projectId) : ["projects", "inactive"],
    queryFn: () => fetchProject(projectId!),
    enabled: Boolean(projectId)
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.project(project.projectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
```

- [ ] **Step 7: Add worker query hooks**

Create `apps/web/src/queries/workerQueries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchWorkerHealth } from "../api";
import { isDesktopRuntime, workerStatus } from "../desktop";
import { queryKeys } from "./queryKeys";

export function useWorkerHealthQuery() {
  return useQuery({
    queryKey: queryKeys.workerHealth,
    queryFn: () => fetchWorkerHealth(),
    retry: 0
  });
}

export function useDesktopWorkerStatusQuery() {
  return useQuery({
    queryKey: queryKeys.desktopWorkerStatus,
    queryFn: () => workerStatus(),
    enabled: isDesktopRuntime()
  });
}
```

- [ ] **Step 8: Add subtitle query hooks**

Create `apps/web/src/queries/subtitleQueries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubtitleDocument } from "@diplomat/shared";
import { fetchSubtitleDocument, saveSubtitleDocument } from "../api";
import { queryKeys } from "./queryKeys";

export function useSubtitleDocumentQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.subtitle(projectId) : ["subtitle", "inactive"],
    queryFn: () => fetchSubtitleDocument(projectId!),
    enabled: Boolean(projectId),
    retry: false
  });
}

export function useSaveSubtitleDocumentMutation(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (document: SubtitleDocument) => saveSubtitleDocument(projectId!, document),
    onSuccess: (document) => {
      if (projectId) {
        queryClient.setQueryData(queryKeys.subtitle(projectId), document);
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      }
    }
  });
}
```

- [ ] **Step 9: Add task query hooks**

Create `apps/web/src/queries/taskQueries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalysisJobRequest, TaskResponse, TranslationJobRequest } from "@diplomat/shared";
import { cancelTask, createAnalysisJob, createTranslationJob, fetchTask, retryTask } from "../api";
import { queryKeys } from "./queryKeys";

function isTaskActive(task: TaskResponse | null | undefined) {
  return task?.status === "queued" || task?.status === "running" || task?.status === "canceling";
}

export function useTaskQuery(taskId: string | null) {
  return useQuery({
    queryKey: taskId ? queryKeys.task(taskId) : ["tasks", "inactive"],
    queryFn: () => fetchTask(taskId!),
    enabled: Boolean(taskId),
    refetchInterval: (query) => (isTaskActive(query.state.data) ? 500 : false)
  });
}

export function useCreateAnalysisJobMutation(projectId: string | null) {
  return useMutation({
    mutationFn: (input: AnalysisJobRequest) => createAnalysisJob(projectId!, input)
  });
}

export function useCreateTranslationJobMutation(projectId: string | null) {
  return useMutation({
    mutationFn: (input: TranslationJobRequest) => createTranslationJob(projectId!, input)
  });
}

export function useCancelTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => cancelTask(taskId),
    onSuccess: (task) => queryClient.setQueryData(queryKeys.task(task.taskId), task)
  });
}

export function useRetryTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; config?: AnalysisJobRequest | TranslationJobRequest }) =>
      input.config ? retryTask(input.taskId, input.config) : retryTask(input.taskId),
    onSuccess: (task) => queryClient.setQueryData(queryKeys.task(task.taskId), task)
  });
}
```

- [ ] **Step 10: Add export query hook**

Create `apps/web/src/queries/exportQueries.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SrtExportMode } from "@diplomat/shared";
import { exportSrt } from "../api";
import { queryKeys } from "./queryKeys";

export function useExportSrtMutation(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: SrtExportMode) => exportSrt(projectId!, mode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
```

- [ ] **Step 11: Run query tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/queries/projectQueries.test.tsx
corepack pnpm --dir apps/web typecheck
```

Expected:

- PASS.

- [ ] **Step 12: Commit**

```powershell
git add apps/web/src/test apps/web/src/queries
git commit -m "feat(web): add worker query hooks"
```

### Task 4: App Shell And Project Center

**Files:**
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/app/AppShellLayout.tsx`
- Create: `apps/web/src/components/AppRail.tsx`
- Create: `apps/web/src/components/LanguageSwitcher.tsx`
- Create: `apps/web/src/components/TaskStatusSurface.tsx`
- Create: `apps/web/src/pages/ProjectCenterPage.tsx`
- Test: `apps/web/src/pages/ProjectCenterPage.test.tsx`
- Test: `apps/web/src/components/AppRail.test.tsx`

- [ ] **Step 1: Write project center render test**

Create `apps/web/src/pages/ProjectCenterPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { projectFixture } from "../test/fixtures";
import { ProjectCenterPage } from "./ProjectCenterPage";

describe("ProjectCenterPage", () => {
  it("shows worker status, recent projects, and create actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return { ok: true, status: 200, json: async () => ({ name: "diplomat-worker", status: "ok", version: "0.1.0" }) } as Response;
        }
        if (url.endsWith("/projects")) {
          return { ok: true, status: 200, json: async () => ({ projects: [projectFixture] }) } as Response;
        }
        throw new Error(`Unexpected fetch ${url}`);
      }) as typeof fetch
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={() => undefined} />);

    expect(await screen.findByText("Project Center")).toBeInTheDocument();
    expect(await screen.findByText("Worker ready")).toBeInTheDocument();
    expect(await screen.findByText("Demo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Video" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/ProjectCenterPage.test.tsx
```

Expected:

- FAIL because `ProjectCenterPage` and `renderWithProviders` do not exist.

- [ ] **Step 3: Add render helper**

Create `apps/web/src/test/render.tsx`:

```tsx
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { AppProviders } from "../app/AppProviders";

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AppProviders, ...options });
}
```

- [ ] **Step 4: Add AppRail**

Create `apps/web/src/components/AppRail.tsx`:

```tsx
import { ActionIcon, Stack, Tooltip } from "@mantine/core";
import { IconFolder, IconHome, IconListCheck, IconSettings } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { AppPage } from "../state/uiStore";

type AppRailProps = {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
};

const items: Array<{ page: AppPage; icon: typeof IconHome; labelKey: string }> = [
  { page: "projects", icon: IconHome, labelKey: "nav.projects" },
  { page: "workbench", icon: IconFolder, labelKey: "nav.workbench" },
  { page: "tasks", icon: IconListCheck, labelKey: "nav.tasks" },
  { page: "settings", icon: IconSettings, labelKey: "nav.settings" }
];

export function AppRail({ currentPage, onNavigate }: AppRailProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xs" align="center" py="md" role="navigation" aria-label="Application">
      {items.map((item) => {
        const Icon = item.icon;
        const label = t(item.labelKey);
        return (
          <Tooltip key={item.page} label={label} position="right">
            <ActionIcon
              aria-label={label}
              variant={currentPage === item.page ? "filled" : "subtle"}
              color={currentPage === item.page ? "teal" : "gray"}
              onClick={() => onNavigate(item.page)}
            >
              <Icon size={18} />
            </ActionIcon>
          </Tooltip>
        );
      })}
    </Stack>
  );
}
```

- [ ] **Step 5: Add LanguageSwitcher**

Create `apps/web/src/components/LanguageSwitcher.tsx`:

```tsx
import { SegmentedControl } from "@mantine/core";
import { appI18n, type AppLanguage } from "../app/i18n";
import { useUiStore } from "../state/uiStore";

export function LanguageSwitcher() {
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);

  function changeLanguage(value: string) {
    const nextLanguage = value as AppLanguage;
    setLanguage(nextLanguage);
    void appI18n.changeLanguage(nextLanguage);
  }

  return (
    <SegmentedControl
      aria-label="Interface language"
      size="xs"
      value={language}
      onChange={changeLanguage}
      data={[
        { label: "EN", value: "en" },
        { label: "中文", value: "zh" }
      ]}
    />
  );
}
```

- [ ] **Step 6: Add AppShell layout**

Create `apps/web/src/app/AppShellLayout.tsx`:

```tsx
import { AppShell, Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppRail } from "../components/AppRail";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useUiStore } from "../state/uiStore";

type AppShellLayoutProps = {
  children: ReactNode;
};

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const { t } = useTranslation();
  const currentPage = useUiStore((state) => state.currentPage);
  const setPage = useUiStore((state) => state.setPage);

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{ width: 56, breakpoint: "sm" }}
      padding={0}
      styles={{
        main: { background: "#e9edf2", minHeight: "100vh" },
        header: { borderColor: "#d7dee8" },
        navbar: { background: "#f8fafc", borderColor: "#d7dee8" }
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Text fw={800}>{t("app.name")}</Text>
            <Text c="dimmed" size="sm">
              {t("app.subtitle")}
            </Text>
          </Group>
          <LanguageSwitcher />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <AppRail currentPage={currentPage} onNavigate={setPage} />
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
```

- [ ] **Step 7: Add TaskStatusSurface**

Create `apps/web/src/components/TaskStatusSurface.tsx`:

```tsx
import { Alert, Group, Loader, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

type TaskStatusSurfaceProps = {
  busy: boolean;
  message: string;
  error: string | null;
};

export function TaskStatusSurface({ busy, message, error }: TaskStatusSurfaceProps) {
  const { t } = useTranslation();

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={16} />} title={t("status.failed")}>
        {error}
      </Alert>
    );
  }

  return (
    <Group gap="xs" c="dimmed" aria-live="polite">
      {busy ? <Loader size="xs" /> : null}
      <Text size="sm">{message}</Text>
    </Group>
  );
}
```

- [ ] **Step 8: Add ProjectCenterPage**

Create `apps/web/src/pages/ProjectCenterPage.tsx`:

```tsx
import { Badge, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconFolderOpen, IconMovie, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ProjectResponse } from "@diplomat/shared";
import { useProjectsQuery } from "../queries/projectQueries";
import { useWorkerHealthQuery } from "../queries/workerQueries";

type ProjectCenterPageProps = {
  onOpenProject: (projectId: string) => void;
};

function formatDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ProjectRow({ project, onOpen }: { project: ProjectResponse; onOpen: () => void }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" gap="md">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Text fw={700} truncate>
            {project.name}
          </Text>
          <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
            {project.sourceVideoPath}
          </Text>
          <Group gap="xs">
            <Badge variant="light">{project.sourceLanguage}{project.targetLanguage ? ` -> ${project.targetLanguage}` : ""}</Badge>
            <Badge variant="light" color={project.hasSubtitleDocument ? "green" : "gray"}>
              {project.hasSubtitleDocument ? "Subtitles" : "No subtitles"}
            </Badge>
            <Badge variant="light" color="gray">{formatDuration(project.durationMs)}</Badge>
          </Group>
        </Stack>
        <Button leftSection={<IconFolderOpen size={16} />} onClick={onOpen}>
          Open
        </Button>
      </Group>
    </Paper>
  );
}

export function ProjectCenterPage({ onOpenProject }: ProjectCenterPageProps) {
  const { t } = useTranslation();
  const worker = useWorkerHealthQuery();
  const projects = useProjectsQuery();
  const workerReady = worker.data?.status === "ok";

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={1}>{t("projectCenter.title")}</Title>
            <Text c="dimmed">{t("projectCenter.description")}</Text>
          </Stack>
          <Badge color={workerReady ? "teal" : "red"} size="lg">
            {workerReady ? t("projectCenter.workerReady") : t("projectCenter.workerUnavailable")}
          </Badge>
        </Group>

        <Group>
          <Button leftSection={<IconPlus size={16} />}>{t("projectCenter.createProject")}</Button>
          <Button variant="light" leftSection={<IconMovie size={16} />}>
            {t("projectCenter.importVideo")}
          </Button>
        </Group>

        <Paper withBorder radius="md" p="md">
          <Stack>
            <Title order={2} size="h3">
              {t("projectCenter.recentProjects")}
            </Title>
            {projects.data?.projects.length ? (
              <Stack>
                {projects.data.projects.map((project) => (
                  <ProjectRow
                    key={project.projectId}
                    project={project}
                    onOpen={() => onOpenProject(project.projectId)}
                  />
                ))}
              </Stack>
            ) : (
              <Stack gap={4}>
                <Text fw={700}>{t("projectCenter.noProjects")}</Text>
                <Text c="dimmed">{t("projectCenter.noProjectsHint")}</Text>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
```

- [ ] **Step 9: Wire App to project center**

Replace `apps/web/src/App.tsx` with a minimal shell that keeps old behavior reachable only while migrating if needed. Initial version:

```tsx
import { AppShellLayout } from "./app/AppShellLayout";
import { ProjectCenterPage } from "./pages/ProjectCenterPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { useUiStore } from "./state/uiStore";
import "./App.css";

export function App() {
  const currentPage = useUiStore((state) => state.currentPage);
  const setPage = useUiStore((state) => state.setPage);

  return (
    <AppShellLayout>
      {currentPage === "projects" ? (
        <ProjectCenterPage onOpenProject={() => setPage("workbench")} />
      ) : null}
      {currentPage === "workbench" ? <WorkbenchPage /> : null}
      {currentPage === "settings" ? <SettingsPage /> : null}
      {currentPage === "tasks" ? <WorkbenchPage /> : null}
    </AppShellLayout>
  );
}
```

If `WorkbenchPage` and `SettingsPage` do not exist yet, create temporary components with user-facing text so typecheck passes:

```tsx
export function WorkbenchPage() {
  return <main aria-label="Workbench">Workbench</main>;
}
```

```tsx
export function SettingsPage() {
  return <main aria-label="Settings">Settings</main>;
}
```

- [ ] **Step 10: Run project center test**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/ProjectCenterPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

Expected:

- PASS.

- [ ] **Step 11: Commit**

```powershell
git add apps/web/src/App.tsx apps/web/src/app/AppShellLayout.tsx apps/web/src/components/AppRail.tsx apps/web/src/components/LanguageSwitcher.tsx apps/web/src/components/TaskStatusSurface.tsx apps/web/src/pages apps/web/src/test/render.tsx
git commit -m "feat(web): add 0.2 project center shell"
```

### Task 5: Workbench Shell And Toolbar

**Files:**
- Create/Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Create: `apps/web/src/components/TopToolbar.tsx`
- Create: `apps/web/src/components/VideoPreviewPanel.tsx`
- Create: `apps/web/src/components/TimelineStrip.tsx`
- Create: `apps/web/src/components/InspectorPanel.tsx`
- Test: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Test: `apps/web/src/components/TopToolbar.test.tsx`

- [ ] **Step 1: Write workbench shell test**

Create `apps/web/src/pages/WorkbenchPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { WorkbenchPage } from "./WorkbenchPage";

describe("WorkbenchPage", () => {
  it("renders the media-centered workbench regions", () => {
    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByRole("toolbar", { name: "Project tools" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Subtitle Grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Timeline")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
```

Expected:

- FAIL because workbench regions are not implemented.

- [ ] **Step 3: Add TopToolbar**

Create `apps/web/src/components/TopToolbar.tsx`:

```tsx
import { ActionIcon, Button, Group, Tooltip } from "@mantine/core";
import { IconDeviceFloppy, IconFileExport, IconLanguage, IconMovie, IconSparkles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { InspectorMode } from "../state/uiStore";

type TopToolbarProps = {
  canSave: boolean;
  canExport: boolean;
  onInspectorMode: (mode: InspectorMode) => void;
  onSave: () => void;
};

export function TopToolbar({ canSave, canExport, onInspectorMode, onSave }: TopToolbarProps) {
  const { t } = useTranslation();

  return (
    <Group role="toolbar" aria-label="Project tools" justify="space-between" px="md" py="xs">
      <Group gap="xs">
        <Button variant="light" leftSection={<IconMovie size={16} />}>
          {t("toolbar.import")}
        </Button>
        <Button leftSection={<IconSparkles size={16} />} onClick={() => onInspectorMode("analysis")}>
          {t("toolbar.analyze")}
        </Button>
        <Button variant="light" leftSection={<IconLanguage size={16} />} onClick={() => onInspectorMode("translation")}>
          {t("toolbar.translate")}
        </Button>
      </Group>
      <Group gap="xs">
        <Tooltip label={t("toolbar.save")}>
          <ActionIcon aria-label={t("toolbar.save")} disabled={!canSave} onClick={onSave}>
            <IconDeviceFloppy size={18} />
          </ActionIcon>
        </Tooltip>
        <Button
          variant="light"
          leftSection={<IconFileExport size={16} />}
          disabled={!canExport}
          onClick={() => onInspectorMode("export")}
        >
          {t("toolbar.export")}
        </Button>
      </Group>
    </Group>
  );
}
```

- [ ] **Step 4: Add VideoPreviewPanel skeleton**

Create `apps/web/src/components/VideoPreviewPanel.tsx`:

```tsx
import { Box, Center, Stack, Text } from "@mantine/core";
import type { SubtitleLine } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type VideoPreviewPanelProps = {
  sourceVideoPath: string | null;
  selectedLine: SubtitleLine | null;
};

export function VideoPreviewPanel({ sourceVideoPath, selectedLine }: VideoPreviewPanelProps) {
  const { t } = useTranslation();

  return (
    <Box
      aria-label="Video preview"
      bg="#0b1020"
      c="white"
      style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 8, overflow: "hidden" }}
    >
      {sourceVideoPath ? (
        <video src={sourceVideoPath} controls style={{ width: "100%", height: "100%", background: "#000" }} />
      ) : (
        <Center h="100%">
          <Text c="gray.4">{t("workbench.previewUnavailable")}</Text>
        </Center>
      )}
      {selectedLine ? (
        <Center
          style={{
            position: "absolute",
            left: "18%",
            right: "18%",
            bottom: 28,
            pointerEvents: "none"
          }}
        >
          <Stack gap={2} align="center" bg="rgba(15, 23, 42, 0.82)" px="sm" py={6} style={{ borderRadius: 4 }}>
            <Text fw={700} ta="center">{selectedLine.sourceText}</Text>
            {selectedLine.translatedText ? <Text size="sm" ta="center">{selectedLine.translatedText}</Text> : null}
          </Stack>
        </Center>
      ) : null}
    </Box>
  );
}
```

- [ ] **Step 5: Add TimelineStrip**

Create `apps/web/src/components/TimelineStrip.tsx`:

```tsx
import { Box, Group, Text } from "@mantine/core";

type TimelineStripProps = {
  durationMs: number;
  lineCount: number;
};

export function TimelineStrip({ durationMs, lineCount }: TimelineStripProps) {
  return (
    <Box aria-label="Timeline" p="sm" bg="white" style={{ borderTop: "1px solid #d7dee8" }}>
      <Group justify="space-between">
        <Text size="xs" c="dimmed">00:00</Text>
        <Text size="xs" c="dimmed">{lineCount} subtitle rows</Text>
        <Text size="xs" c="dimmed">{Math.round(durationMs / 1000)}s</Text>
      </Group>
      <Box mt={6} h={18} bg="#dbeafe" style={{ borderRadius: 4 }}>
        <Box h={18} w={`${Math.min(100, lineCount * 4)}%`} bg="#99f6e4" style={{ borderRadius: 4 }} />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 6: Add InspectorPanel shell**

Create `apps/web/src/components/InspectorPanel.tsx`:

```tsx
import { Paper, Stack, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { InspectorMode } from "../state/uiStore";

type InspectorPanelProps = {
  mode: InspectorMode;
  children: React.ReactNode;
};

export function InspectorPanel({ mode, children }: InspectorPanelProps) {
  const { t } = useTranslation();

  return (
    <Paper aria-label="Inspector" withBorder radius={0} p="md" h="100%">
      <Stack>
        <Title order={2} size="h3">
          {t(`inspector.${mode === "settings-lite" ? "line" : mode}`)}
        </Title>
        {children}
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 7: Implement WorkbenchPage shell**

Create or replace `apps/web/src/pages/WorkbenchPage.tsx`:

```tsx
import { Box, Center, SimpleGrid, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { InspectorPanel } from "../components/InspectorPanel";
import { TimelineStrip } from "../components/TimelineStrip";
import { TopToolbar } from "../components/TopToolbar";
import { VideoPreviewPanel } from "../components/VideoPreviewPanel";
import { useUiStore } from "../state/uiStore";

export function WorkbenchPage() {
  const inspectorMode = useUiStore((state) => state.inspectorMode);
  const setInspectorMode = useUiStore((state) => state.setInspectorMode);
  const selectedLineId = useUiStore((state) => state.selectedLineId);

  const selectedLine = useMemo(() => null, [selectedLineId]);

  return (
    <Box h="calc(100vh - 48px)" style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
      <TopToolbar
        canSave={false}
        canExport={false}
        onInspectorMode={setInspectorMode}
        onSave={() => undefined}
      />
      <Box style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", minHeight: 0 }}>
        <Box style={{ display: "grid", gridTemplateRows: "minmax(240px, 45vh) minmax(0, 1fr) auto", minHeight: 0 }}>
          <Box p="md">
            <VideoPreviewPanel sourceVideoPath={null} selectedLine={selectedLine} />
          </Box>
          <Center aria-label="Subtitle Grid" bg="white" style={{ borderTop: "1px solid #d7dee8" }}>
            <Stack align="center" gap={4}>
              <Text fw={700}>Subtitle Grid</Text>
              <Text size="sm" c="dimmed">No subtitle document</Text>
            </Stack>
          </Center>
          <TimelineStrip durationMs={0} lineCount={0} />
        </Box>
        <InspectorPanel mode={inspectorMode}>
          <Text c="dimmed">Select a subtitle row or choose a toolbar action.</Text>
        </InspectorPanel>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 8: Run workbench shell test**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

Expected:

- PASS.

- [ ] **Step 9: Commit**

```powershell
git add apps/web/src/pages/WorkbenchPage.tsx apps/web/src/components/TopToolbar.tsx apps/web/src/components/VideoPreviewPanel.tsx apps/web/src/components/TimelineStrip.tsx apps/web/src/components/InspectorPanel.tsx apps/web/src/pages/WorkbenchPage.test.tsx
git commit -m "feat(web): add media workbench shell"
```

### Task 6: Subtitle Grid And Line Inspector

**Files:**
- Create: `apps/web/src/components/SubtitleGrid.tsx`
- Create: `apps/web/src/components/inspectors/LineInspector.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Test: `apps/web/src/components/SubtitleGrid.test.tsx`
- Test: `apps/web/src/components/inspectors/LineInspector.test.tsx`

- [ ] **Step 1: Write SubtitleGrid test**

Create `apps/web/src/components/SubtitleGrid.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { analyzedDocumentFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { SubtitleGrid } from "./SubtitleGrid";

describe("SubtitleGrid", () => {
  it("renders dense subtitle rows and selects a row", async () => {
    const onSelectLine = vi.fn();
    renderWithProviders(
      <SubtitleGrid
        lines={analyzedDocumentFixture.lines}
        selectedLineId={null}
        filter="all"
        onFilterChange={() => undefined}
        onSelectLine={onSelectLine}
      />
    );

    expect(screen.getByRole("table", { name: "Subtitle Grid" })).toBeInTheDocument();
    expect(screen.getByText("原始字幕文本")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /line-1/i }));
    expect(onSelectLine).toHaveBeenCalledWith("line-1");
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/SubtitleGrid.test.tsx
```

Expected:

- FAIL because `SubtitleGrid` does not exist.

- [ ] **Step 3: Add SubtitleGrid**

Create `apps/web/src/components/SubtitleGrid.tsx`:

```tsx
import { Badge, Button, Group, ScrollArea, Table } from "@mantine/core";
import type { SubtitleLine } from "@diplomat/shared";

type SubtitleGridProps = {
  lines: SubtitleLine[];
  selectedLineId: string | null;
  filter: "all" | "missing";
  onFilterChange: (filter: "all" | "missing") => void;
  onSelectLine: (lineId: string) => void;
};

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function isMissing(line: SubtitleLine) {
  return !line.translatedText.trim() || line.translationStatus === "failed";
}

export function SubtitleGrid({ lines, selectedLineId, filter, onFilterChange, onSelectLine }: SubtitleGridProps) {
  const visibleLines = filter === "missing" ? lines.filter(isMissing) : lines;

  return (
    <section aria-label="Subtitle Grid" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Group justify="space-between" p="sm">
        <Group gap="xs">
          <Button size="xs" variant={filter === "all" ? "filled" : "light"} onClick={() => onFilterChange("all")}>
            All
          </Button>
          <Button size="xs" variant={filter === "missing" ? "filled" : "light"} onClick={() => onFilterChange("missing")}>
            Missing
          </Button>
        </Group>
        <Badge variant="light">{visibleLines.length} rows</Badge>
      </Group>
      <ScrollArea style={{ flex: 1 }}>
        <Table stickyHeader striped highlightOnHover withTableBorder aria-label="Subtitle Grid">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Start</Table.Th>
              <Table.Th>End</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th>Translation</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibleLines.map((line) => (
              <Table.Tr key={line.id} bg={line.id === selectedLineId ? "teal.0" : undefined}>
                <Table.Td>
                  <Button variant="subtle" size="compact-sm" onClick={() => onSelectLine(line.id)}>
                    {line.id}
                  </Button>
                </Table.Td>
                <Table.Td>{formatTime(line.startMs)}</Table.Td>
                <Table.Td>{formatTime(line.endMs)}</Table.Td>
                <Table.Td>{line.sourceText || "No source text"}</Table.Td>
                <Table.Td>{line.translatedText || "No translated text"}</Table.Td>
                <Table.Td>
                  <Badge color={line.translationStatus === "failed" ? "red" : "gray"} variant="light">
                    {line.translationStatus}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </section>
  );
}
```

- [ ] **Step 4: Write LineInspector test**

Create `apps/web/src/components/inspectors/LineInspector.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { analyzedDocumentFixture } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { LineInspector } from "./LineInspector";

describe("LineInspector", () => {
  it("edits translated text and marks the line edited", async () => {
    const onChangeLine = vi.fn();
    renderWithProviders(
      <LineInspector
        line={analyzedDocumentFixture.lines[0]!}
        busy={false}
        onChangeLine={onChangeLine}
        onSave={() => undefined}
      />
    );

    await userEvent.clear(screen.getByLabelText("Translated text"));
    await userEvent.type(screen.getByLabelText("Translated text"), "Hello");

    expect(onChangeLine).toHaveBeenLastCalledWith(
      expect.objectContaining({ translatedText: "Hello", translationStatus: "edited" })
    );
  });
});
```

- [ ] **Step 5: Add LineInspector**

Create `apps/web/src/components/inspectors/LineInspector.tsx`:

```tsx
import { Button, Group, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import type { SubtitleLine } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type LineInspectorProps = {
  line: SubtitleLine | null;
  busy: boolean;
  onChangeLine: (line: SubtitleLine) => void;
  onSave: () => void;
};

export function LineInspector({ line, busy, onChangeLine, onSave }: LineInspectorProps) {
  const { t } = useTranslation();

  if (!line) {
    return <Text c="dimmed">{t("inspector.emptyLine")}</Text>;
  }

  return (
    <Stack>
      <Group grow>
        <NumberInput
          label={t("fields.startMs")}
          min={0}
          value={line.startMs}
          disabled={busy}
          onChange={(value) => onChangeLine({ ...line, startMs: Number(value) || line.startMs })}
        />
        <NumberInput
          label={t("fields.endMs")}
          min={0}
          value={line.endMs}
          disabled={busy}
          onChange={(value) => onChangeLine({ ...line, endMs: Number(value) || line.endMs })}
        />
      </Group>
      <Textarea
        label={t("fields.sourceText")}
        minRows={4}
        value={line.sourceText}
        disabled={busy}
        onChange={(event) => onChangeLine({ ...line, sourceText: event.currentTarget.value })}
      />
      <Textarea
        label={t("fields.translatedText")}
        minRows={4}
        value={line.translatedText}
        disabled={busy}
        onChange={(event) =>
          onChangeLine({
            ...line,
            translatedText: event.currentTarget.value,
            translationStatus: "edited",
            translationError: null
          })
        }
      />
      <Button onClick={onSave} disabled={busy}>
        {t("actions.save")}
      </Button>
    </Stack>
  );
}
```

- [ ] **Step 6: Wire grid and inspector into WorkbenchPage**

Modify `apps/web/src/pages/WorkbenchPage.tsx` so the center grid uses `SubtitleGrid` and the line mode uses `LineInspector`. During this task it is acceptable to use fixture data to complete the UI slice; Task 8 connects it to live Query data.

```tsx
import { Box, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import type { SubtitleLine } from "@diplomat/shared";
import { InspectorPanel } from "../components/InspectorPanel";
import { LineInspector } from "../components/inspectors/LineInspector";
import { SubtitleGrid } from "../components/SubtitleGrid";
import { TimelineStrip } from "../components/TimelineStrip";
import { TopToolbar } from "../components/TopToolbar";
import { VideoPreviewPanel } from "../components/VideoPreviewPanel";
import { analyzedDocumentFixture } from "../test/fixtures";
import { useUiStore } from "../state/uiStore";

export function WorkbenchPage() {
  const inspectorMode = useUiStore((state) => state.inspectorMode);
  const setInspectorMode = useUiStore((state) => state.setInspectorMode);
  const selectedLineId = useUiStore((state) => state.selectedLineId);
  const setSelectedLineId = useUiStore((state) => state.setSelectedLineId);
  const [filter, setFilter] = useState<"all" | "missing">("all");
  const [document, setDocument] = useState(analyzedDocumentFixture);

  const selectedLine = useMemo(
    () => document.lines.find((line) => line.id === selectedLineId) ?? null,
    [document.lines, selectedLineId]
  );

  function updateLine(nextLine: SubtitleLine) {
    setDocument((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === nextLine.id ? nextLine : line))
    }));
  }

  return (
    <Box h="calc(100vh - 48px)" style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
      <TopToolbar canSave canExport onInspectorMode={setInspectorMode} onSave={() => undefined} />
      <Box style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", minHeight: 0 }}>
        <Box style={{ display: "grid", gridTemplateRows: "minmax(240px, 45vh) minmax(0, 1fr) auto", minHeight: 0 }}>
          <Box p="md">
            <VideoPreviewPanel sourceVideoPath={null} selectedLine={selectedLine} />
          </Box>
          <SubtitleGrid
            lines={document.lines}
            selectedLineId={selectedLineId}
            filter={filter}
            onFilterChange={setFilter}
            onSelectLine={setSelectedLineId}
          />
          <TimelineStrip durationMs={document.durationMs} lineCount={document.lines.length} />
        </Box>
        <InspectorPanel mode={inspectorMode}>
          {inspectorMode === "line" ? (
            <LineInspector line={selectedLine} busy={false} onChangeLine={updateLine} onSave={() => undefined} />
          ) : (
            <Text c="dimmed">Inspector mode: {inspectorMode}</Text>
          )}
        </InspectorPanel>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/SubtitleGrid.test.tsx src/components/inspectors/LineInspector.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

Expected:

- PASS.

- [ ] **Step 8: Commit**

```powershell
git add apps/web/src/components/SubtitleGrid.tsx apps/web/src/components/SubtitleGrid.test.tsx apps/web/src/components/inspectors apps/web/src/pages/WorkbenchPage.tsx
git commit -m "feat(web): add subtitle grid and line inspector"
```

### Task 7: Analysis, Translation, And Export Inspectors

**Files:**
- Create: `apps/web/src/components/inspectors/AnalysisInspector.tsx`
- Create: `apps/web/src/components/inspectors/TranslationInspector.tsx`
- Create: `apps/web/src/components/inspectors/ExportInspector.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Test: `apps/web/src/components/inspectors/AnalysisInspector.test.tsx`
- Test: `apps/web/src/components/inspectors/TranslationInspector.test.tsx`
- Test: `apps/web/src/components/inspectors/ExportInspector.test.tsx`

- [ ] **Step 1: Add AnalysisInspector**

Create `apps/web/src/components/inspectors/AnalysisInspector.tsx`:

```tsx
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import type { AnalysisJobRequest } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type AnalysisInspectorProps = {
  config: AnalysisJobRequest;
  busy: boolean;
  onConfigChange: (config: AnalysisJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

export function AnalysisInspector({ config, busy, onConfigChange, onStart, onCancel, onRetry }: AnalysisInspectorProps) {
  const { t } = useTranslation();
  return (
    <Stack>
      <Select
        label={t("fields.provider")}
        value={config.provider}
        data={["fake", "faster-whisper"]}
        disabled={busy}
        onChange={(value) => onConfigChange({ ...config, provider: value as AnalysisJobRequest["provider"] })}
      />
      <TextInput
        label={t("fields.model")}
        value={config.modelNameOrPath ?? ""}
        disabled={busy}
        onChange={(event) => onConfigChange({ ...config, modelNameOrPath: event.currentTarget.value || null })}
      />
      <TextInput
        label={t("fields.sourceLanguage")}
        value={config.sourceLanguage ?? ""}
        disabled={busy}
        onChange={(event) => onConfigChange({ ...config, sourceLanguage: event.currentTarget.value || null })}
      />
      <Group>
        <Button onClick={onStart} disabled={busy}>{t("actions.start")}</Button>
        <Button variant="light" onClick={onCancel}>{t("actions.cancel")}</Button>
        <Button variant="light" onClick={onRetry}>{t("actions.retry")}</Button>
      </Group>
    </Stack>
  );
}
```

- [ ] **Step 2: Add TranslationInspector**

Create `apps/web/src/components/inspectors/TranslationInspector.tsx`:

```tsx
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import type { TranslationJobRequest } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type TranslationInspectorProps = {
  config: TranslationJobRequest;
  busy: boolean;
  onConfigChange: (config: TranslationJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

export function TranslationInspector({ config, busy, onConfigChange, onStart, onCancel, onRetry }: TranslationInspectorProps) {
  const { t } = useTranslation();
  return (
    <Stack>
      <Select
        label={t("fields.provider")}
        value={config.provider}
        data={["fake", "libretranslate"]}
        disabled={busy}
        onChange={(value) => onConfigChange({ ...config, provider: value as TranslationJobRequest["provider"] })}
      />
      <Group grow>
        <TextInput label={t("fields.sourceLanguage")} value={config.sourceLanguage} disabled={busy} onChange={(event) => onConfigChange({ ...config, sourceLanguage: event.currentTarget.value })} />
        <TextInput label={t("fields.targetLanguage")} value={config.targetLanguage} disabled={busy} onChange={(event) => onConfigChange({ ...config, targetLanguage: event.currentTarget.value })} />
      </Group>
      <Select
        label="Translation mode"
        value={config.mode}
        data={[
          { label: "missing only", value: "missing_only" },
          { label: "overwrite all", value: "overwrite_all" }
        ]}
        disabled={busy}
        onChange={(value) => onConfigChange({ ...config, mode: value as TranslationJobRequest["mode"] })}
      />
      <TextInput label={t("fields.endpoint")} value={config.endpoint ?? ""} disabled={busy} onChange={(event) => onConfigChange({ ...config, endpoint: event.currentTarget.value || null })} />
      <TextInput label={t("fields.apiKeyEnv")} value={config.apiKeyEnv ?? ""} disabled={busy} onChange={(event) => onConfigChange({ ...config, apiKeyEnv: event.currentTarget.value || null })} />
      <Group>
        <Button onClick={onStart} disabled={busy}>{t("actions.start")}</Button>
        <Button variant="light" onClick={onCancel}>{t("actions.cancel")}</Button>
        <Button variant="light" onClick={onRetry}>{t("actions.retry")}</Button>
      </Group>
    </Stack>
  );
}
```

- [ ] **Step 3: Add ExportInspector**

Create `apps/web/src/components/inspectors/ExportInspector.tsx`:

```tsx
import { Button, Select, Stack, Text } from "@mantine/core";
import type { SrtExportMode, SrtExportResponse } from "@diplomat/shared";
import { useTranslation } from "react-i18next";

type ExportInspectorProps = {
  mode: SrtExportMode;
  result: SrtExportResponse | null;
  canExport: boolean;
  disabledReason: string | null;
  busy: boolean;
  onModeChange: (mode: SrtExportMode) => void;
  onExport: () => void;
};

export function ExportInspector({ mode, result, canExport, disabledReason, busy, onModeChange, onExport }: ExportInspectorProps) {
  const { t } = useTranslation();
  return (
    <Stack>
      <Select
        label={t("fields.exportMode")}
        value={mode}
        data={["bilingual", "source", "target"]}
        onChange={(value) => onModeChange(value as SrtExportMode)}
      />
      <Button onClick={onExport} disabled={busy || !canExport}>
        {t("toolbar.export")}
      </Button>
      {disabledReason ? <Text c="red" size="sm">{disabledReason}</Text> : null}
      {result ? <Text c="teal" size="sm">SRT exported: {result.exportPath}</Text> : null}
    </Stack>
  );
}
```

- [ ] **Step 4: Wire inspector modes into WorkbenchPage**

Modify `apps/web/src/pages/WorkbenchPage.tsx` to render `AnalysisInspector`, `TranslationInspector`, and `ExportInspector` for their modes. Keep handler bodies simple until Task 8 connects mutations:

```tsx
{inspectorMode === "analysis" ? (
  <AnalysisInspector
    config={analysisConfig}
    busy={false}
    onConfigChange={setAnalysisConfig}
    onStart={() => undefined}
    onCancel={() => undefined}
    onRetry={() => undefined}
  />
) : null}
{inspectorMode === "translation" ? (
  <TranslationInspector
    config={translationConfig}
    busy={false}
    onConfigChange={setTranslationConfig}
    onStart={() => undefined}
    onCancel={() => undefined}
    onRetry={() => undefined}
  />
) : null}
{inspectorMode === "export" ? (
  <ExportInspector
    mode={exportMode}
    result={null}
    canExport={false}
    disabledReason="Save subtitle edits before exporting."
    busy={false}
    onModeChange={setExportMode}
    onExport={() => undefined}
  />
) : null}
```

- [ ] **Step 5: Write inspector switching test**

Add to `apps/web/src/pages/WorkbenchPage.test.tsx`:

```tsx
it("switches inspector modes from the toolbar", async () => {
  renderWithProviders(<WorkbenchPage />);

  await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
  expect(screen.getByRole("heading", { name: "Analysis" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Translate" }));
  expect(screen.getByRole("heading", { name: "Translation" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(screen.getByRole("heading", { name: "Export" })).toBeInTheDocument();
});
```

Include imports:

```ts
import userEvent from "@testing-library/user-event";
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

Expected:

- PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/components/inspectors apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx
git commit -m "feat(web): add task and export inspectors"
```

### Task 8: Connect Workbench To Query Data

**Files:**
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/ProjectCenterPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Test: `apps/web/tests/App.test.tsx` or migrate to page tests and remove obsolete assertions.

- [ ] **Step 1: Add active project state to UI store**

Modify `apps/web/src/state/uiStore.ts`:

```ts
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
```

Add to `initialState`:

```ts
activeProjectId: null as string | null,
```

Add action:

```ts
setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
```

- [ ] **Step 2: Update project open behavior**

Modify `apps/web/src/App.tsx`:

```tsx
export function App() {
  const currentPage = useUiStore((state) => state.currentPage);
  const setPage = useUiStore((state) => state.setPage);
  const setActiveProjectId = useUiStore((state) => state.setActiveProjectId);

  function openProject(projectId: string) {
    setActiveProjectId(projectId);
    setPage("workbench");
  }

  return (
    <AppShellLayout>
      {currentPage === "projects" ? <ProjectCenterPage onOpenProject={openProject} /> : null}
      {currentPage === "workbench" ? <WorkbenchPage /> : null}
      {currentPage === "settings" ? <SettingsPage /> : null}
      {currentPage === "tasks" ? <WorkbenchPage /> : null}
    </AppShellLayout>
  );
}
```

- [ ] **Step 3: Write live workbench data test**

Update `apps/web/src/pages/WorkbenchPage.test.tsx` with a fetch-backed test:

```tsx
it("loads project subtitle data and edits the selected row", async () => {
  useUiStore.getState().setActiveProjectId("project-demo");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/projects/project-demo")) {
        return { ok: true, status: 200, json: async () => projectFixture } as Response;
      }
      if (url.endsWith("/projects/project-demo/subtitle")) {
        return { ok: true, status: 200, json: async () => analyzedDocumentFixture } as Response;
      }
      if (url.endsWith("/projects/project-demo/translation-settings")) {
        return { ok: true, status: 200, json: async () => ({
          projectId: "project-demo",
          provider: "fake",
          sourceLanguage: "zh",
          targetLanguage: "en",
          mode: "missing_only",
          endpoint: null,
          apiKeyEnv: null,
          updatedAt: "2026-06-07T00:00:01+00:00"
        }) } as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch
  );

  renderWithProviders(<WorkbenchPage />);

  expect(await screen.findByText("原始字幕文本")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /line-1/i }));
  expect(screen.getByLabelText("Source text")).toHaveValue("原始字幕文本");
});
```

- [ ] **Step 4: Run test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
```

Expected:

- FAIL because `WorkbenchPage` still uses fixtures instead of queries.

- [ ] **Step 5: Connect WorkbenchPage to query hooks**

Modify `apps/web/src/pages/WorkbenchPage.tsx`:

- Read `activeProjectId` from `useUiStore`.
- Use `useProjectQuery(activeProjectId)`.
- Use `useSubtitleDocumentQuery(activeProjectId)`.
- Use `useSaveSubtitleDocumentMutation(activeProjectId)`.
- Use `useCreateAnalysisJobMutation(activeProjectId)`.
- Use `useCreateTranslationJobMutation(activeProjectId)`.
- Use `useExportSrtMutation(activeProjectId)`.
- Keep edited document in local state only when user changes a line.

Core merge pattern:

```tsx
const activeProjectId = useUiStore((state) => state.activeProjectId);
const project = useProjectQuery(activeProjectId);
const subtitle = useSubtitleDocumentQuery(activeProjectId);
const saveSubtitle = useSaveSubtitleDocumentMutation(activeProjectId);
const [draftDocument, setDraftDocument] = useState<SubtitleDocument | null>(null);

const document = draftDocument ?? subtitle.data ?? null;
const hasUnsavedChanges = Boolean(draftDocument);

useEffect(() => {
  setDraftDocument(null);
}, [activeProjectId, subtitle.dataUpdatedAt]);
```

Save handler:

```tsx
async function saveDraft() {
  if (!draftDocument) {
    return;
  }
  const saved = await saveSubtitle.mutateAsync(draftDocument);
  setDraftDocument(null);
  subtitle.refetch();
}
```

- [ ] **Step 6: Preserve export blocking**

Inside `WorkbenchPage`, compute:

```ts
const taskActive = false;
const canExport = Boolean(activeProjectId && document && !hasUnsavedChanges && !taskActive);
const exportDisabledReason = taskActive
  ? "Wait for analysis or translation to finish."
  : hasUnsavedChanges
    ? "Save subtitle edits before exporting."
    : null;
```

This preserves the existing user rule. Task polling can refine `taskActive`.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx src/state/uiStore.test.ts
corepack pnpm --dir apps/web typecheck
```

Expected:

- PASS.

- [ ] **Step 8: Commit**

```powershell
git add apps/web/src/App.tsx apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx apps/web/src/state/uiStore.ts apps/web/src/state/uiStore.test.ts
git commit -m "feat(web): connect workbench to worker data"
```

### Task 9: Settings Page And Language Persistence

**Files:**
- Create/Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/components/LanguageSwitcher.tsx`
- Modify: `apps/web/src/state/uiStore.ts`
- Test: `apps/web/src/pages/SettingsPage.test.tsx`
- Test: `apps/web/src/components/LanguageSwitcher.test.tsx`

- [ ] **Step 1: Write settings page test**

Create `apps/web/src/pages/SettingsPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("shows language, theme, worker, and default export settings", async () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("Interface language")).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Worker")).toBeInTheDocument();
    expect(screen.getByLabelText("Default export mode")).toBeInTheDocument();

    await userEvent.click(screen.getByText("中文"));
    expect(await screen.findByRole("heading", { name: "设置" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx
```

Expected:

- FAIL because `SettingsPage` is not complete.

- [ ] **Step 3: Add localStorage language persistence helpers**

Modify `apps/web/src/state/uiStore.ts`:

```ts
const LANGUAGE_STORAGE_KEY = "diplomat.language";

function initialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh" ? "zh" : "en";
}
```

Use in `initialState`:

```ts
language: initialLanguage(),
```

Update setter:

```ts
setLanguage: (language) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
  set({ language });
},
```

- [ ] **Step 4: Add SettingsPage**

Create or replace `apps/web/src/pages/SettingsPage.tsx`:

```tsx
import { Container, Paper, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <Container size="md" py="xl">
      <Stack>
        <Title order={1}>{t("settings.title")}</Title>
        <Paper withBorder radius="md" p="md">
          <Stack>
            <Text fw={700}>{t("settings.language")}</Text>
            <LanguageSwitcher />
          </Stack>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Stack>
            <Text fw={700}>{t("settings.theme")}</Text>
            <Select label={t("settings.theme")} value="light" data={[{ label: "Light", value: "light" }]} readOnly />
          </Stack>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Stack>
            <Text fw={700}>{t("settings.worker")}</Text>
            <TextInput label="Worker URL" value="http://127.0.0.1:8765" readOnly />
          </Stack>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Stack>
            <Text fw={700}>{t("settings.defaults")}</Text>
            <TextInput label={t("fields.sourceLanguage")} defaultValue="zh" />
            <TextInput label={t("fields.targetLanguage")} defaultValue="en" />
            <Select
              label={t("settings.defaultExportMode")}
              defaultValue="bilingual"
              data={["bilingual", "source", "target"]}
            />
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
```

- [ ] **Step 5: Run settings tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx src/i18n/i18n.test.ts src/state/uiStore.test.ts
corepack pnpm --dir apps/web typecheck
```

Expected:

- PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/pages/SettingsPage.tsx apps/web/src/pages/SettingsPage.test.tsx apps/web/src/state/uiStore.ts apps/web/src/components/LanguageSwitcher.tsx
git commit -m "feat(web): add settings and language persistence"
```

### Task 10: Web E2E And Visual Regression

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/fixtures.ts`
- Create: `apps/web/e2e/project-center.spec.ts`
- Create: `apps/web/e2e/workbench.spec.ts`
- Create: `apps/web/e2e/visual.spec.ts`
- Modify: `apps/web/vite.config.ts` only if server config is needed.

- [ ] **Step 1: Add Playwright dependency**

Run:

```powershell
corepack pnpm --dir apps/web add -D @playwright/test
corepack pnpm --dir apps/web exec playwright install chromium
```

Expected:

- Playwright is installed.
- Chromium browser is installed for E2E.

- [ ] **Step 2: Add package scripts**

Modify `apps/web/package.json` scripts:

```json
{
  "e2e": "playwright test",
  "e2e:update": "playwright test --update-snapshots",
  "e2e:ui": "playwright test --ui"
}
```

Keep existing scripts unchanged.

- [ ] **Step 3: Add Playwright config**

Create `apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02
    }
  },
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    colorScheme: "light",
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: "corepack pnpm --dir apps/web dev --host 127.0.0.1",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
```

- [ ] **Step 4: Add E2E route mocks**

Create `apps/web/e2e/fixtures.ts`:

```ts
import type { Page } from "@playwright/test";

export async function mockWorkerApi(page: Page) {
  await page.route("**/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ name: "diplomat-worker", status: "ok", version: "0.1.0" })
    });
  });

  await page.route("**/projects", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          projects: [
            {
              projectId: "project-demo",
              name: "Demo",
              sourceVideoPath: "D:/media/demo.mp4",
              projectDir: "D:/Diplomat/projects/project-demo",
              durationMs: 12000,
              sourceLanguage: "zh",
              targetLanguage: "en",
              createdAt: "2026-06-07T00:00:00+00:00",
              updatedAt: "2026-06-07T00:01:00+00:00",
              hasSubtitleDocument: true
            }
          ]
        })
      });
      return;
    }
    await route.continue();
  });
}
```

- [ ] **Step 5: Add project center E2E**

Create `apps/web/e2e/project-center.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { mockWorkerApi } from "./fixtures";

test("project center shows recent projects and switches language", async ({ page }) => {
  await mockWorkerApi(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Project Center" })).toBeVisible();
  await expect(page.getByText("Demo")).toBeVisible();

  await page.getByLabel("Interface language").getByText("中文").click();
  await expect(page.getByRole("heading", { name: "项目中心" })).toBeVisible();
});
```

- [ ] **Step 6: Add visual regression E2E**

Create `apps/web/e2e/visual.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { mockWorkerApi } from "./fixtures";

test("project center visual baseline", async ({ page }) => {
  await mockWorkerApi(page);
  await page.goto("/");
  await expect(page).toHaveScreenshot("project-center.png", { fullPage: true });
});
```

- [ ] **Step 7: Run E2E**

Run:

```powershell
corepack pnpm --dir apps/web e2e
```

Expected:

- First visual test may fail with missing screenshot baseline. Run `e2e:update` once after manually inspecting the generated screenshot.
- Functional E2E passes.

- [ ] **Step 8: Commit**

```powershell
git add apps/web/package.json pnpm-lock.yaml apps/web/playwright.config.ts apps/web/e2e
git commit -m "test(web): add e2e and visual regression"
```

### Task 11: Desktop Shell E2E Target

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/e2e/desktop-smoke.spec.ts`
- Create: `docs/development/0-2-frontend-workbench.md`

- [ ] **Step 1: Add desktop E2E script**

Modify `apps/web/package.json` scripts:

```json
{
  "e2e:desktop": "playwright test e2e/desktop-smoke.spec.ts --headed"
}
```

- [ ] **Step 2: Add desktop E2E documentation**

Create `docs/development/0-2-frontend-workbench.md`:

```md
# 0.2 Frontend Workbench Development Notes

## Manual Desktop E2E Target

The desired desktop path is:

1. Start the Tauri development app.
2. Confirm Project Center is visible.
3. Confirm Worker status is ready or starting.
4. Use the native file picker to select a video fixture.
5. Create a project.
6. Enter the workbench.
7. Run fake analysis.
8. Confirm subtitle rows appear.

If the native file picker cannot be automated reliably on a local Windows runner, use the controlled path field or a test-only injected file path to complete the same verification. Record the limitation in the stage gate review.
```

- [ ] **Step 3: Add desktop E2E skeleton**

Create `apps/web/e2e/desktop-smoke.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("desktop smoke", () => {
  test("documents the real desktop flow target", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Project Center|项目中心/ })).toBeVisible();
  });
});
```

This keeps the Playwright target present while the implementation decides whether to drive Tauri directly, attach to the Tauri WebView, or use a documented manual runner path.

- [ ] **Step 4: Run desktop target in controlled mode**

Run:

```powershell
corepack pnpm --dir apps/web e2e:desktop
```

Expected:

- PASS when the Vite dev app is reachable.
- If the Tauri app target is added in implementation, document exact launch steps before making this script required by `check.ps1`.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/package.json apps/web/e2e/desktop-smoke.spec.ts docs/development/0-2-frontend-workbench.md
git commit -m "test(web): add desktop e2e target"
```

### Task 12: Verification Script And Final Migration Cleanup

**Files:**
- Modify: `scripts/check.ps1`
- Modify/Delete: obsolete files in `apps/web/src/components`
- Modify: `apps/web/tests/App.test.tsx`
- Modify: `README.md` only if run commands change.

- [ ] **Step 1: Remove obsolete component imports**

Run:

```powershell
rg -n "AnalysisJobPanel|TranslationJobPanel|ProjectImportPanel|ProjectLibraryPanel|SubtitleLineList|SubtitleEditor|ExportPanel|TaskStatusBar" apps/web/src apps/web/tests
```

Expected:

- No runtime imports remain after migration.
- If imports remain, migrate them to the new page/component model before deleting files.

- [ ] **Step 2: Delete obsolete components after no imports remain**

Use `apply_patch` delete hunks for obsolete files only after Step 1 confirms no imports:

```text
*** Delete File: apps/web/src/components/AnalysisJobPanel.tsx
*** Delete File: apps/web/src/components/TranslationJobPanel.tsx
*** Delete File: apps/web/src/components/ProjectImportPanel.tsx
*** Delete File: apps/web/src/components/ProjectLibraryPanel.tsx
*** Delete File: apps/web/src/components/SubtitleLineList.tsx
*** Delete File: apps/web/src/components/SubtitleEditor.tsx
*** Delete File: apps/web/src/components/ExportPanel.tsx
*** Delete File: apps/web/src/components/TaskStatusBar.tsx
```

- [ ] **Step 3: Update check script with stable commands**

Modify `scripts/check.ps1` only after E2E commands are stable enough for local runs:

```powershell
$ErrorActionPreference = "Stop"

Write-Host "Installing JavaScript dependencies if needed"
corepack pnpm install --frozen-lockfile

Write-Host "Running TypeScript package checks"
corepack pnpm -r test
corepack pnpm -r typecheck

Write-Host "Running Web E2E checks"
corepack pnpm --dir apps/web e2e

Write-Host "Installing Python worker in editable mode"
python -m pip install -e .\worker[dev]

Write-Host "Running Python tests"
python -m pytest

Write-Host "All Diplomat checks completed"
```

If visual regression baselines are not stable on Windows yet, do not add `e2e` to `check.ps1`; instead add `e2e` to the release checklist in `docs/development/0-2-frontend-workbench.md`.

- [ ] **Step 4: Run full verification**

Run:

```powershell
.\scripts\check.ps1
```

Expected:

- All package tests pass.
- TypeScript checks pass.
- Rust desktop tests pass through package test script.
- Python Worker tests pass.
- Web E2E runs if it was added to `check.ps1`.

- [ ] **Step 5: Run visual regression command**

Run:

```powershell
corepack pnpm --dir apps/web e2e
```

Expected:

- Functional E2E passes.
- Visual snapshots pass against reviewed baselines.

- [ ] **Step 6: Commit cleanup**

```powershell
git add scripts/check.ps1 apps/web/src apps/web/tests README.md docs/development/0-2-frontend-workbench.md
git commit -m "chore(web): complete 0.2 workbench migration"
```

## Stage Gate Review

Before marking 0.2 frontend work complete, run this checklist against the design spec:

- [ ] Project Center is the startup surface.
- [ ] Workbench uses left rail, top toolbar, media preview, subtitle grid, and right inspector.
- [ ] Mantine theme is the UI foundation.
- [ ] TanStack Query owns Worker/API data fetching.
- [ ] Zustand owns UI shell state only.
- [ ] Core UI switches between English and Chinese.
- [ ] Video preview uses a real `<video>` element when source path is usable.
- [ ] Subtitle overlay preview appears for selected lines.
- [ ] Subtitle grid supports dense display and selection.
- [ ] Inspector modes are predictable and toolbar-driven.
- [ ] Save/export blocking states remain consistent.
- [ ] Web E2E exists and passes.
- [ ] Desktop E2E target exists, and real native picker automation status is documented.
- [ ] Visual regression baselines exist and pass.
- [ ] `.\scripts\check.ps1` passes or explicitly documents why E2E is a separate release command.

## Execution Notes

- Start each task from a clean worktree.
- Prefer one commit per task.
- Keep `App.tsx` small after Task 4.
- Keep form drafts local unless shared state is required.
- Do not move Worker or Tauri responsibilities into React.
- Do not put provider ids, model names, or diagnostic paths into i18n resources.
- Preserve existing fake provider workflows while migrating UI.
