import type { EmulatedRequest, EmulatorSummary } from "./types";

export function summarizeRequests(
  service: string,
  requests: EmulatedRequest[]
): EmulatorSummary {
  const routes: Record<string, number> = {};
  for (const request of requests) {
    if (request.handled) {
      routes[request.path] = (routes[request.path] ?? 0) + 1;
    }
  }
  return {
    service,
    requests: requests.length,
    unhandled: requests
      .filter((request) => !request.handled)
      .map((request) => `${request.path} → ${request.status}`),
    routes,
  };
}
