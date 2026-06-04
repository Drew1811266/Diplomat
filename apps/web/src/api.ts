export type WorkerHealth = {
  name: string;
  status: string;
  version: string;
};

export async function fetchWorkerHealth(baseUrl = "http://127.0.0.1:8765"): Promise<WorkerHealth> {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error(`Worker health request failed: ${response.status}`);
  }
  return response.json() as Promise<WorkerHealth>;
}
