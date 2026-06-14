import {
  AnalysisJobRequestSchema,
  AnalyzeProjectResponseSchema,
  CreateProjectRequestSchema,
  ModelCatalogEntrySchema,
  ModelCatalogResponseSchema,
  ModelDeleteResponseSchema,
  ModelDownloadResponseSchema,
  ProjectBackupResponseSchema,
  ProjectImportRequestSchema,
  ProjectListResponseSchema,
  ProjectMaintenanceResponseSchema,
  ProjectResponseSchema,
  SrtExportResponseSchema,
  SubtitleDocumentSchema,
  TaskResponseSchema,
  TranslationJobRequestSchema,
  TranslationSettingsResponseSchema,
  type AnalysisJobRequestInput,
  type AnalysisJobRequest,
  type AnalyzeProjectResponse,
  type CreateProjectRequest,
  type ModelCatalogEntry,
  type ModelCatalogResponse,
  type ModelDeleteResponse,
  type ModelDownloadResponse,
  type ProjectBackupResponse,
  type ProjectImportRequest,
  type ProjectListResponse,
  type ProjectMaintenanceResponse,
  type ProjectResponse,
  type SrtExportMode,
  type SrtExportResponse,
  type SubtitleDocument,
  type TaskResponse,
  type TranslationJobRequestInput,
  type TranslationSettingsResponse
} from "@diplomat/shared";

const DEFAULT_WORKER_BASE_URL = "http://127.0.0.1:8765";

function defaultWorkerBaseUrl() {
  const configuredUrl = import.meta.env.VITE_DIPLOMAT_WORKER_BASE_URL;
  return configuredUrl?.trim() ? configuredUrl.trim() : DEFAULT_WORKER_BASE_URL;
}

export type WorkerHealth = {
  name: string;
  status: string;
  version: string;
};

export type CreateProjectInput = Omit<CreateProjectRequest, "targetLanguage"> & {
  targetLanguage?: CreateProjectRequest["targetLanguage"];
};

async function formatWorkerError(response: Response): Promise<string> {
  const message = `Worker request failed: ${response.status}`;

  try {
    const payload = (await response.json()) as unknown;
    if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail: unknown }).detail;
      const formattedDetail = typeof detail === "string" ? detail : JSON.stringify(detail);
      if (formattedDetail) {
        return `${message}: ${formattedDetail}`;
      }
    }
  } catch {
    // Keep the status-only message when the error response is not JSON.
  }

  return message;
}

function retryRequestSchema(input: AnalysisJobRequestInput | TranslationJobRequestInput) {
  return "targetLanguage" in input
    ? TranslationJobRequestSchema.parse(input)
    : AnalysisJobRequestSchema.parse(input);
}

async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  parse: (payload: unknown) => T
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    const workerOrigin = new URL(url).origin;
    throw new Error(
      `Worker is not reachable at ${workerOrigin}. Start the Worker or use the desktop Start Worker action.`,
      { cause: error }
    );
  }
  if (!response.ok) {
    throw new Error(await formatWorkerError(response));
  }
  return parse(await response.json());
}

export async function fetchWorkerHealth(baseUrl = defaultWorkerBaseUrl()): Promise<WorkerHealth> {
  return requestJson(`${baseUrl}/health`, undefined, (payload) => payload as WorkerHealth);
}

export async function createProject(
  input: CreateProjectInput,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ProjectResponse> {
  const request = CreateProjectRequestSchema.parse(input);

  return requestJson(
    `${baseUrl}/projects`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    (payload) => ProjectResponseSchema.parse(payload)
  );
}

export async function listProjects(baseUrl = defaultWorkerBaseUrl()): Promise<ProjectListResponse> {
  return requestJson(
    `${baseUrl}/projects`,
    undefined,
    (payload) => ProjectListResponseSchema.parse(payload)
  );
}

export async function listModels(baseUrl = defaultWorkerBaseUrl()): Promise<ModelCatalogResponse> {
  return requestJson(
    `${baseUrl}/models`,
    undefined,
    (payload) => ModelCatalogResponseSchema.parse(payload)
  );
}

export async function fetchModel(
  modelId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ModelCatalogEntry> {
  return requestJson(
    `${baseUrl}/models/${modelId}`,
    undefined,
    (payload) => ModelCatalogEntrySchema.parse(payload)
  );
}

export async function downloadModel(
  modelId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ModelDownloadResponse> {
  return requestJson(
    `${baseUrl}/models/${modelId}/download`,
    { method: "POST" },
    (payload) => ModelDownloadResponseSchema.parse(payload)
  );
}

export async function cancelModelDownload(
  modelId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ModelDownloadResponse> {
  return requestJson(
    `${baseUrl}/models/${modelId}/cancel`,
    { method: "POST" },
    (payload) => ModelDownloadResponseSchema.parse(payload)
  );
}

export async function retryModelDownload(
  modelId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ModelDownloadResponse> {
  return requestJson(
    `${baseUrl}/models/${modelId}/retry`,
    { method: "POST" },
    (payload) => ModelDownloadResponseSchema.parse(payload)
  );
}

export async function deleteModel(
  modelId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ModelDeleteResponse> {
  return requestJson(
    `${baseUrl}/models/${modelId}`,
    { method: "DELETE" },
    (payload) => ModelDeleteResponseSchema.parse(payload)
  );
}

export async function fetchProject(
  projectId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ProjectResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}`,
    undefined,
    (payload) => ProjectResponseSchema.parse(payload)
  );
}

export async function cleanupProjectCache(
  projectId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ProjectMaintenanceResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/cleanup/cache`,
    { method: "POST" },
    (payload) => ProjectMaintenanceResponseSchema.parse(payload)
  );
}

export async function cleanupProjectExports(
  projectId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ProjectMaintenanceResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/cleanup/exports`,
    { method: "POST" },
    (payload) => ProjectMaintenanceResponseSchema.parse(payload)
  );
}

export async function deleteProject(
  projectId: string,
  deleteFiles = true,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ProjectMaintenanceResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}?deleteFiles=${deleteFiles ? "true" : "false"}`,
    { method: "DELETE" },
    (payload) => ProjectMaintenanceResponseSchema.parse(payload)
  );
}

export async function backupProject(
  projectId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ProjectBackupResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/backup`,
    { method: "POST" },
    (payload) => ProjectBackupResponseSchema.parse(payload)
  );
}

export async function importProject(
  input: ProjectImportRequest,
  baseUrl = defaultWorkerBaseUrl()
): Promise<ProjectResponse> {
  const request = ProjectImportRequestSchema.parse(input);

  return requestJson(
    `${baseUrl}/projects/import`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    (payload) => ProjectResponseSchema.parse(payload)
  );
}

export async function runProjectAnalysis(
  projectId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<AnalyzeProjectResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/analyze`,
    { method: "POST" },
    (payload) => AnalyzeProjectResponseSchema.parse(payload)
  );
}

export async function createAnalysisJob(
  projectId: string,
  input: AnalysisJobRequestInput,
  baseUrl = defaultWorkerBaseUrl()
): Promise<TaskResponse> {
  const request = AnalysisJobRequestSchema.parse(input);

  return requestJson(
    `${baseUrl}/projects/${projectId}/analysis-jobs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    (payload) => TaskResponseSchema.parse(payload)
  );
}

export async function fetchTask(
  taskId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<TaskResponse> {
  return requestJson(
    `${baseUrl}/tasks/${taskId}`,
    undefined,
    (payload) => TaskResponseSchema.parse(payload)
  );
}

export async function fetchTranslationSettings(
  projectId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<TranslationSettingsResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/translation-settings`,
    undefined,
    (payload) => TranslationSettingsResponseSchema.parse(payload)
  );
}

export async function saveTranslationSettings(
  projectId: string,
  input: TranslationJobRequestInput,
  baseUrl = defaultWorkerBaseUrl()
): Promise<TranslationSettingsResponse> {
  const request = TranslationJobRequestSchema.parse(input);

  return requestJson(
    `${baseUrl}/projects/${projectId}/translation-settings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    (payload) => TranslationSettingsResponseSchema.parse(payload)
  );
}

export async function createTranslationJob(
  projectId: string,
  input: TranslationJobRequestInput,
  baseUrl = defaultWorkerBaseUrl()
): Promise<TaskResponse> {
  const request = TranslationJobRequestSchema.parse(input);

  return requestJson(
    `${baseUrl}/projects/${projectId}/translation-jobs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    (payload) => TaskResponseSchema.parse(payload)
  );
}

export async function cancelTask(
  taskId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<TaskResponse> {
  return requestJson(
    `${baseUrl}/tasks/${taskId}/cancel`,
    { method: "POST" },
    (payload) => TaskResponseSchema.parse(payload)
  );
}

export async function retryTask(
  taskId: string,
  inputOrBaseUrl?: AnalysisJobRequestInput | TranslationJobRequestInput | string,
  maybeBaseUrl = defaultWorkerBaseUrl()
): Promise<TaskResponse> {
  const hasReplacementConfig =
    inputOrBaseUrl !== undefined && typeof inputOrBaseUrl !== "string";
  const baseUrl =
    typeof inputOrBaseUrl === "string" ? inputOrBaseUrl : maybeBaseUrl;
  const requestInit = hasReplacementConfig
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryRequestSchema(inputOrBaseUrl))
      }
    : { method: "POST" };

  return requestJson(
    `${baseUrl}/tasks/${taskId}/retry`,
    requestInit,
    (payload) => TaskResponseSchema.parse(payload)
  );
}

export async function fetchSubtitleDocument(
  projectId: string,
  baseUrl = defaultWorkerBaseUrl()
): Promise<SubtitleDocument> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/subtitle`,
    undefined,
    (payload) => SubtitleDocumentSchema.parse(payload)
  );
}

export async function saveSubtitleDocument(
  projectId: string,
  document: SubtitleDocument,
  baseUrl = defaultWorkerBaseUrl()
): Promise<SubtitleDocument> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/subtitle`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document })
    },
    (payload) => SubtitleDocumentSchema.parse(payload)
  );
}

export async function exportSrt(
  projectId: string,
  mode: SrtExportMode,
  baseUrl = defaultWorkerBaseUrl()
): Promise<SrtExportResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/exports/srt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    },
    (payload) => SrtExportResponseSchema.parse(payload)
  );
}
