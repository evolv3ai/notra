import { promisify } from "node:util";
import { gzip } from "node:zlib";

import { LOG_TRANSPORT_TIMEOUT_MS } from "@notra/ai/constants/evlog";
import { isRecord } from "@notra/utils/unknown-record";
import type { WideEvent } from "evlog";
import type { AxiomConfig } from "evlog/axiom";

const compress = promisify(gzip);

/** One transport attempt; the shipping pipeline owns retries and disablement. */
export async function sendAxiomBatch(
  events: WideEvent[],
  config: AxiomConfig
): Promise<void> {
  if (events.length === 0) {
    return;
  }
  const token = config.apiKey ?? config.token;
  if (!token) {
    throw new Error("[evlog/axiom] Missing apiKey");
  }
  const dataset = encodeURIComponent(config.dataset);
  const url = new URL(
    config.edgeUrl ??
      `${config.baseUrl ?? "https://api.axiom.co"}/v1/datasets/${dataset}/ingest`
  );
  if (config.edgeUrl) {
    url.pathname =
      url.pathname === "/"
        ? `/v1/ingest/${dataset}`
        : url.pathname.replace(/\/+$/, "");
  }
  url.searchParams.set("timestamp-field", "timestamp");
  const json = JSON.stringify(events);
  const compressed = await compress(json);
  const useGzip = compressed.byteLength < Buffer.byteLength(json);
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Evlog-Source": "axiom",
      ...(config.orgId ? { "X-Axiom-Org-Id": config.orgId } : {}),
      ...(useGzip ? { "Content-Encoding": "gzip" } : {}),
    },
    body: useGzip ? compressed : json,
    signal: AbortSignal.timeout(config.timeout ?? LOG_TRANSPORT_TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`Axiom API error: ${response.status}`);
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (isRecord(body)) {
    if (
      typeof body.failed === "number" &&
      Number.isSafeInteger(body.failed) &&
      body.failed > 0
    ) {
      console.warn(`[evlog/axiom] ${body.failed} event(s) failed to ingest`);
    }
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      console.warn("[evlog/axiom] Ingest warnings received");
    }
  }
}
