import type { GeoIngestRuntime } from "../types/ingest";

export function getGeoIngestRuntime(): GeoIngestRuntime {
  if (process.env.UNKEY_DEPLOYMENT_ID) {
    return "unkey";
  }
  if (process.env.VERCEL) {
    return "vercel";
  }
  return "local";
}

export function getGeoIngestRegion(): string | undefined {
  return process.env.UNKEY_REGION ?? process.env.VERCEL_REGION;
}
