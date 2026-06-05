import {
  AnalyzeProjectResponseSchema,
  ProjectResponseSchema,
  SrtExportResponseSchema,
  SubtitleDocumentSchema,
  type AnalyzeProjectResponse,
  type CreateProjectRequest,
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

async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  parse: (payload: unknown) => T
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Worker request failed: ${response.status}`);
  }
  return parse(await response.json());
}

export async function fetchWorkerHealth(baseUrl = DEFAULT_WORKER_BASE_URL): Promise<WorkerHealth> {
  return requestJson(`${baseUrl}/health`, undefined, (payload) => payload as WorkerHealth);
}

export async function createProject(
  input: CreateProjectRequest,
  baseUrl = DEFAULT_WORKER_BASE_URL
): Promise<ProjectResponse> {
  return requestJson(
    `${baseUrl}/projects`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    },
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
