import { vi } from "vitest";

type Route = {
  match: (url: string, init?: RequestInit) => boolean;
  response: unknown | (() => unknown | Promise<unknown>);
  ok?: boolean;
  status?: number;
};

export function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

export function stubFetchWithRoutes(routes: Route[]) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const route = routes.find((candidate) => candidate.match(url, init));

    if (!route) {
      throw new Error(`Unexpected fetch: ${url}`);
    }

    const payload =
      typeof route.response === "function" ? await route.response() : route.response;
    return jsonResponse(payload, route.ok ?? true, route.status ?? 200);
  });
}
