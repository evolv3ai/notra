import { createHash } from "node:crypto";

import { shouldTrackRequest } from "@usenotra/geo";

import { GEO_DRAIN_PROVIDERS } from "../constants/geo";
import {
  GEO_DRAIN_CLOUDFLARE_EYEBALL_SOURCE,
  GEO_DRAIN_EPOCH_THRESHOLDS,
  GEO_DRAIN_HTTP_STATUS_RANGE,
  GEO_DRAIN_NUMERIC_TIMESTAMP_PATTERN,
  GEO_DRAIN_TRACING_HEADERS,
} from "../constants/ingest";
import {
  cloudflareLogpushRecordSchema,
  vercelDrainLogSchema,
} from "../schemas/geo-drains";
import type { GeoDrainProvider } from "../types/geo";
import type {
  CloudflareLogpushRecord,
  GeoDrainHeaders,
  GeoDrainRecord,
  GeoIngestPayload,
  VercelDrainLog,
} from "../types/ingest";

function present(
  value: string | number | null | undefined
): string | undefined {
  return value === undefined || value === null || value === ""
    ? undefined
    : String(value);
}

function toEpochMillis(value: number): number {
  const { nanoseconds, microseconds, milliseconds } =
    GEO_DRAIN_EPOCH_THRESHOLDS;
  if (value >= nanoseconds) {
    return value / 1e6;
  }
  if (value >= microseconds) {
    return value / 1e3;
  }
  return value >= milliseconds ? value : value * 1000;
}

function toDrainTimestamp(
  value: number | string | null | undefined
): string | undefined {
  const text = present(value);
  if (text === undefined) {
    return;
  }
  const date = GEO_DRAIN_NUMERIC_TIMESTAMP_PATTERN.test(text)
    ? new Date(toEpochMillis(Number(text)))
    : new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toStatus(value: number | null | undefined): number | undefined {
  const { min, max } = GEO_DRAIN_HTTP_STATUS_RANGE;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : undefined;
}

function buildUrl(
  scheme: string | null | undefined,
  host: string,
  path: string
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${present(scheme) ?? "https"}://${host}${normalizedPath}`;
}

function isTrackablePage(payload: GeoIngestPayload): boolean {
  try {
    return shouldTrackRequest(
      new Request(payload.url, { method: payload.method }),
      new URL(payload.url)
    );
  } catch {
    return false;
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseDrainLines(text: string): unknown[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    const parsed = parseJson(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  }
  return trimmed
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseJson);
}

function fromVercelDrainLog(log: VercelDrainLog): GeoIngestPayload {
  const { proxy } = log;
  return {
    timestamp: toDrainTimestamp(proxy.timestamp ?? log.timestamp),
    method: proxy.method,
    url: buildUrl(proxy.scheme, proxy.host, proxy.path),
    ip: present(proxy.clientIp),
    referer: present(proxy.referer),
    userAgent: present(proxy.userAgent?.join(" ")),
    requestId: present(proxy.vercelId) ?? present(log.requestId),
    status: toStatus(proxy.statusCode),
  };
}

function readHeader(
  headers: GeoDrainHeaders,
  name: string
): string | undefined {
  const value = headers.get(name);
  return present(Array.isArray(value) ? value.join(", ") : value);
}

function readSignals(headers: GeoDrainHeaders): GeoIngestPayload["signals"] {
  return {
    clientHints: readHeader(headers, "sec-ch-ua") !== undefined,
    fetchMode: readHeader(headers, "sec-fetch-mode") ?? null,
    tracing: GEO_DRAIN_TRACING_HEADERS.some(
      (name) => readHeader(headers, name) !== undefined
    ),
  };
}

function fromCloudflareLogpushRecord(
  record: CloudflareLogpushRecord
): GeoIngestPayload {
  const headers = record.RequestHeaders
    ? new Map(
        Object.entries(record.RequestHeaders).map(([name, value]) => [
          name.toLowerCase(),
          value,
        ])
      )
    : null;
  const geo = {
    country: present(record.ClientCountry)?.toUpperCase(),
    region: present(record.ClientRegionCode),
  };
  return {
    timestamp: toDrainTimestamp(record.EdgeStartTimestamp),
    method: record.ClientRequestMethod,
    url: buildUrl(
      record.ClientRequestScheme,
      record.ClientRequestHost,
      record.ClientRequestURI
    ),
    ip: present(record.ClientIP),
    geo: Object.values(geo).some(Boolean) ? geo : undefined,
    referer: present(record.ClientRequestReferer),
    userAgent: present(record.ClientRequestUserAgent),
    accept: headers ? readHeader(headers, "accept") : undefined,
    acceptLanguage: headers
      ? readHeader(headers, "accept-language")
      : undefined,
    requestId: present(record.RayID),
    status: toStatus(record.EdgeResponseStatus),
    signals: headers ? readSignals(headers) : undefined,
  };
}

function toVercelPayload(line: unknown): GeoIngestPayload | null {
  const parsed = vercelDrainLogSchema.safeParse(line);
  if (!parsed.success || parsed.data.proxy.statusCode === -1) {
    return null;
  }
  return fromVercelDrainLog(parsed.data);
}

function toCloudflarePayload(line: unknown): GeoIngestPayload | null {
  const parsed = cloudflareLogpushRecordSchema.safeParse(line);
  if (!parsed.success) {
    return null;
  }
  const source = parsed.data.ClientRequestSource;
  if (source && source !== GEO_DRAIN_CLOUDFLARE_EYEBALL_SOURCE) {
    return null;
  }
  return fromCloudflareLogpushRecord(parsed.data);
}

function toDedupeKey(
  provider: GeoDrainProvider,
  payload: GeoIngestPayload
): string {
  const id =
    payload.requestId ??
    createHash("sha256")
      .update(
        JSON.stringify([
          payload.timestamp,
          payload.method,
          payload.url,
          payload.ip,
          payload.userAgent,
          payload.referer,
        ])
      )
      .digest("hex");
  return `${provider}:${id}`;
}

export function toGeoDrainRecords(
  provider: GeoDrainProvider,
  lines: unknown[]
): GeoDrainRecord[] {
  const toPayload =
    provider === "vercel" ? toVercelPayload : toCloudflarePayload;
  const records = new Map<string, GeoDrainRecord>();
  for (const line of lines) {
    const payload = toPayload(line);
    if (!(payload && isTrackablePage(payload))) {
      continue;
    }
    const dedupeKey = toDedupeKey(provider, payload);
    if (!records.has(dedupeKey)) {
      records.set(dedupeKey, { payload, dedupeKey });
    }
  }
  return [...records.values()];
}

export function isGeoDrainProvider(value: string): value is GeoDrainProvider {
  return GEO_DRAIN_PROVIDERS.some((provider) => provider === value);
}
