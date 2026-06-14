import { test as base, expect, type Page, type Route } from "@playwright/test";
import type {
  ProjectDiagnostics,
  ProjectResponse,
  StylePreset,
  SubtitleDocument,
  SubtitleExportRequest,
  TaskResponse,
  TranslationSettingsResponse
} from "@diplomat/shared";

const workerOrigin = "http://127.0.0.1:8765";
const timestamp = "2026-06-07T00:00:00+00:00";

const corsHeaders = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-origin": "*"
};

const demoDiagnostics: ProjectDiagnostics = {
  status: "translated",
  warnings: [],
  sourceVideoExists: true,
  projectDirExists: true,
  diskUsageBytes: 4096,
  cacheUsageBytes: 0,
  exportUsageBytes: 0,
  exportCount: 0,
  subtitleLineCount: 2,
  translatedLineCount: 1,
  activeTaskCount: 0,
  failedTaskCount: 0,
  latestTaskStatus: null,
  exportsDir: "D:/Diplomat/projects/project-demo/exports",
  cacheDir: "D:/Diplomat/projects/project-demo/cache",
  logsDir: "D:/Diplomat/projects/project-demo/logs",
  backupsDir: "D:/Diplomat/projects/project-demo/backups"
};

export const demoProject: ProjectResponse = {
  projectId: "project-demo",
  name: "Demo",
  sourceVideoPath: "D:/media/demo.mp4",
  projectDir: "D:/Diplomat/projects/project-demo",
  durationMs: 12_000,
  sourceLanguage: "zh",
  targetLanguage: "en",
  createdAt: timestamp,
  updatedAt: "2026-06-07T00:01:00+00:00",
  hasSubtitleDocument: true,
  diagnostics: demoDiagnostics
};

export const demoSubtitleDocument: SubtitleDocument = {
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
      lineSpacing: 1.15,
      backgroundBar: false,
      backgroundColor: "#000000cc",
      safeAreaMargin: 32
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
      sourceText: "欢迎使用 Diplomat 工作台",
      translatedText: "Welcome to the Diplomat workbench",
      words: [
        { text: "欢迎", startMs: 1000, endMs: 1300, confidence: 0.98 },
        { text: "使用", startMs: 1300, endMs: 1600, confidence: 0.96 },
        { text: "Diplomat", startMs: 1600, endMs: 2100, confidence: 0.99 },
        { text: "工作台", startMs: 2100, endMs: 2400, confidence: 0.97 }
      ],
      styleOverrides: {},
      reviewStatus: "reviewed",
      aiOrigin: { engine: "mock-asr", model: "mock-v1" },
      translationStatus: "translated",
      translationOrigin: { provider: "fake", model: "fake-v1" },
      translationError: null,
      notes: ""
    },
    {
      id: "line-2",
      startMs: 3200,
      endMs: 5200,
      speakerId: "speaker-1",
      sourceLanguage: "zh",
      targetLanguage: "en",
      sourceText: "这是稳定的端到端测试字幕",
      translatedText: "",
      words: [{ text: "这是稳定的端到端测试字幕", startMs: 3200, endMs: 5200, confidence: 0.95 }],
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

const completedTask: TaskResponse = {
  taskId: "task-demo",
  projectId: "project-demo",
  type: "analysis",
  status: "completed",
  progress: 1,
  message: "Task completed",
  startedAt: timestamp,
  updatedAt: "2026-06-07T00:00:01+00:00",
  completedAt: "2026-06-07T00:00:01+00:00",
  errorCode: null,
  errorMessage: null,
  diagnosticLogPath: null
};

const translationSettings: TranslationSettingsResponse = {
  projectId: "project-demo",
  provider: "fake",
  sourceLanguage: "zh",
  targetLanguage: "en",
  mode: "missing_only",
  endpoint: null,
  apiKeyEnv: null,
  updatedAt: timestamp
};

type WorkerState = {
  projects: ProjectResponse[];
  subtitleDocument: SubtitleDocument;
  stylePresets: StylePreset[];
  activeStylePresetId: string | null;
  tasks: Map<string, TaskResponse>;
};

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(payload),
    contentType: "application/json",
    headers: corsHeaders,
    status
  });
}

async function fulfillOptions(route: Route) {
  await route.fulfill({
    body: "",
    headers: corsHeaders,
    status: 204
  });
}

async function readRequestJson<T>(route: Route): Promise<T | null> {
  const body = route.request().postData();
  return body ? (JSON.parse(body) as T) : null;
}

function createTask(type: TaskResponse["type"], taskId: string): TaskResponse {
  return {
    ...completedTask,
    taskId,
    type,
    message: `${type} completed`
  };
}

async function routeWorkerRequest(route: Route, state: WorkerState) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const path = url.pathname;

  if (method === "OPTIONS") {
    await fulfillOptions(route);
    return;
  }

  if (method === "GET" && path === "/health") {
    await fulfillJson(route, { name: "diplomat-worker", status: "ok", version: "0.2.0" });
    return;
  }

  if (method === "GET" && path === "/projects") {
    await fulfillJson(route, { projects: state.projects });
    return;
  }

  if (method === "POST" && path === "/projects") {
    const body = await readRequestJson<Partial<ProjectResponse>>(route);
    const createdProject = {
      ...demoProject,
      projectId: "project-created",
      name: body?.name ?? "Created Project",
      sourceVideoPath: body?.sourceVideoPath ?? "D:/media/created.mp4",
      sourceLanguage: body?.sourceLanguage ?? "zh",
      targetLanguage: body?.targetLanguage ?? "en"
    };
    state.projects = [createdProject, ...state.projects];
    await fulfillJson(route, createdProject, 201);
    return;
  }

  if (method === "GET" && path === "/projects/project-demo") {
    await fulfillJson(route, demoProject);
    return;
  }

  if (method === "POST" && path === "/projects/project-demo/analyze") {
    await fulfillJson(route, {
      projectId: "project-demo",
      status: "completed",
      subtitlePath: "D:/Diplomat/projects/project-demo/subtitle.json",
      lineCount: state.subtitleDocument.lines.length,
      document: state.subtitleDocument
    });
    return;
  }

  if (method === "GET" && path === "/projects/project-demo/subtitle") {
    await fulfillJson(route, state.subtitleDocument);
    return;
  }

  if (method === "PUT" && path === "/projects/project-demo/subtitle") {
    const body = await readRequestJson<{ document: SubtitleDocument }>(route);
    if (body?.document) {
      state.subtitleDocument = body.document;
    }
    await fulfillJson(route, state.subtitleDocument);
    return;
  }

  if (method === "GET" && path === "/projects/project-demo/translation-settings") {
    await fulfillJson(route, translationSettings);
    return;
  }

  if (method === "PUT" && path === "/projects/project-demo/translation-settings") {
    const body = await readRequestJson<Partial<TranslationSettingsResponse>>(route);
    await fulfillJson(route, { ...translationSettings, ...body, projectId: "project-demo" });
    return;
  }

  if (method === "POST" && path === "/projects/project-demo/analysis-jobs") {
    const task = createTask("analysis", "analysis-task-demo");
    state.tasks.set(task.taskId, task);
    await fulfillJson(route, task, 202);
    return;
  }

  if (method === "POST" && path === "/projects/project-demo/translation-jobs") {
    const task = createTask("translation", "translation-task-demo");
    state.tasks.set(task.taskId, task);
    await fulfillJson(route, task, 202);
    return;
  }

  if (method === "GET" && path === "/projects/project-demo/style-presets") {
    await fulfillJson(route, {
      projectId: "project-demo",
      activePresetId: state.activeStylePresetId,
      presets: state.stylePresets
    });
    return;
  }

  if (method === "POST" && path === "/projects/project-demo/style-presets") {
    const body = await readRequestJson<{ name?: string; style?: SubtitleDocument["styles"][number] }>(
      route
    );
    const preset: StylePreset = {
      id: `preset-${state.stylePresets.length + 1}`,
      name: body?.name ?? "Preset",
      style: body?.style ?? state.subtitleDocument.styles[0]!,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    state.stylePresets = [...state.stylePresets, preset];
    await fulfillJson(route, preset, 201);
    return;
  }

  const stylePresetMatch = path.match(/^\/projects\/project-demo\/style-presets\/([^/]+)(?:\/apply)?$/);
  if (stylePresetMatch) {
    const presetId = stylePresetMatch[1];
    const preset = state.stylePresets.find((candidate) => candidate.id === presetId);
    if (!preset) {
      await fulfillJson(route, { detail: "Style preset not found" }, 404);
      return;
    }

    if (method === "PATCH" && !path.endsWith("/apply")) {
      const body = await readRequestJson<{ name?: string; style?: SubtitleDocument["styles"][number] }>(
        route
      );
      const updatedPreset: StylePreset = {
        ...preset,
        name: body?.name ?? preset.name,
        style: body?.style ?? preset.style,
        updatedAt: "2026-06-07T00:02:00+00:00"
      };
      state.stylePresets = state.stylePresets.map((candidate) =>
        candidate.id === presetId ? updatedPreset : candidate
      );
      await fulfillJson(route, updatedPreset);
      return;
    }

    if (method === "DELETE" && !path.endsWith("/apply")) {
      state.stylePresets = state.stylePresets.filter((candidate) => candidate.id !== presetId);
      state.activeStylePresetId = state.stylePresets[0]?.id ?? null;
      await fulfillJson(route, {
        projectId: "project-demo",
        activePresetId: state.activeStylePresetId,
        presets: state.stylePresets
      });
      return;
    }

    if (method === "POST" && path.endsWith("/apply")) {
      state.activeStylePresetId = preset.id;
      state.subtitleDocument = {
        ...state.subtitleDocument,
        styles: [{ ...preset.style, fontSize: 44, primaryColor: "#FFEECC" }]
      };
      await fulfillJson(route, {
        projectId: "project-demo",
        activePresetId: preset.id,
      style: state.subtitleDocument.styles[0]!
      });
      return;
    }
  }

  if (method === "POST" && path === "/projects/project-demo/exports/subtitles") {
    const body = await readRequestJson<SubtitleExportRequest>(route);
    const mode = body?.mode ?? "bilingual";
    const format = body?.format ?? "srt";
    await fulfillJson(route, {
      projectId: "project-demo",
      exportPath: `D:/Diplomat/exports/project-demo.${mode}.${format}`,
      format,
      mode,
      warnings: []
    });
    return;
  }

  if (method === "POST" && path === "/projects/project-demo/exports/srt") {
    const body = await readRequestJson<{ mode?: "source" | "target" | "bilingual" }>(route);
    await fulfillJson(route, {
      projectId: "project-demo",
      exportPath: `D:/Diplomat/exports/project-demo.${body?.mode ?? "bilingual"}.srt`,
      mode: body?.mode ?? "bilingual"
    });
    return;
  }

  const taskMatch = path.match(/^\/tasks\/([^/]+)(?:\/(cancel|retry))?$/);
  if (taskMatch) {
    const [, taskId, action] = taskMatch;
    const task = state.tasks.get(taskId) ?? createTask("analysis", taskId);
    state.tasks.set(taskId, task);

    if (method === "GET" && !action) {
      await fulfillJson(route, task);
      return;
    }

    if (method === "POST" && action === "cancel") {
      const canceledTask = { ...task, status: "canceled" as const, completedAt: timestamp };
      state.tasks.set(taskId, canceledTask);
      await fulfillJson(route, canceledTask);
      return;
    }

    if (method === "POST" && action === "retry") {
      const retriedTask = { ...task, status: "completed" as const, progress: 1 };
      state.tasks.set(taskId, retriedTask);
      await fulfillJson(route, retriedTask);
      return;
    }
  }

  await fulfillJson(route, { detail: `Unhandled mock route: ${method} ${path}` }, 404);
}

async function installWorkerMocks(page: Page): Promise<WorkerState> {
  const state: WorkerState = {
    projects: [demoProject],
    subtitleDocument: structuredClone(demoSubtitleDocument),
    stylePresets: [
      {
        id: "preset-default",
        name: "Default",
        style: structuredClone(demoSubtitleDocument.styles[0]!),
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    activeStylePresetId: "preset-default",
    tasks: new Map([[completedTask.taskId, completedTask]])
  };

  await page.route(`${workerOrigin}/**`, (route) => routeWorkerRequest(route, state));
  return state;
}

type WorkerFixtures = {
  workerApi: WorkerState;
};

export const test = base.extend<WorkerFixtures>({
  workerApi: [
    async ({ page }, use) => {
      const workerApi = await installWorkerMocks(page);
      await use(workerApi);
    },
    { auto: true }
  ]
});

export { expect };
