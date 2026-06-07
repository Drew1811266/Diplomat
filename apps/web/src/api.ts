import {
  AnalyzeProjectResponseSchema,
  CreateProjectRequestSchema,
  ProjectListResponseSchema,
  ProjectResponseSchema,
  SrtExportResponseSchema,
  SubtitleDocumentSchema,
  type AnalyzeProjectResponse,
  type CreateProjectRequest,
  type ProjectListResponse,
  type ProjectResponse,
  type SrtExportMode,
  type SrtExportResponse,
  type SubtitleDocument
} from "@diplomat/shared";

const DEFAULT_WORKER_BASE_URL = "http://127.0.0.1:8765";

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

export async function fetchWorkerHealth(baseUrl = DEFAULT_WORKER_BASE_URL): Promise<WorkerHealth> {
  return requestJson(`${baseUrl}/health`, undefined, (payload) => payload as WorkerHealth);
}

export async function createProject(
  input: CreateProjectInput,
  baseUrl = DEFAULT_WORKER_BASE_URL
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

export async function listProjects(baseUrl = DEFAULT_WORKER_BASE_URL): Promise<ProjectListResponse> {
  return requestJson(
    `${baseUrl}/projects`,
    undefined,
    (payload) => ProjectListResponseSchema.parse(payload)
  );
}

export async function fetchProject(
  projectId: string,
  baseUrl = DEFAULT_WORKER_BASE_URL
): Promise<ProjectResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}`,
    undefined,
    (payload) => ProjectResponseSchema.parse(payload)
  );
}

export async function runProjectAnalysis(
  projectId: string,
  baseUrl = DEFAULT_WORKER_BASE_URL
): Promise<AnalyzeProjectResponse> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/analyze`,
    { method: "POST" },
    (payload) => AnalyzeProjectResponseSchema.parse(payload)
  );
}

export async function fetchSubtitleDocument(
  projectId: string,
  baseUrl = DEFAULT_WORKER_BASE_URL
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
  baseUrl = DEFAULT_WORKER_BASE_URL
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
  baseUrl = DEFAULT_WORKER_BASE_URL
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
