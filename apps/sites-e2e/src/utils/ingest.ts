import type { IngestRequest } from "../types/harness";

export function isEngagement(event: IngestRequest) {
  return event.body.type === "engagement";
}

export function countByUrl(events: IngestRequest[]) {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const url = String(event.body.url);
    counts[url] = (counts[url] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  );
}
