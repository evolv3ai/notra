import type {
  IncomingRequestCfProperties as CloudflareRequestProperties,
  R2Bucket as CloudflareBucket,
  RateLimit as CloudflareRateLimit,
} from "@cloudflare/workers-types";

declare global {
  type IncomingRequestCfProperties = CloudflareRequestProperties;
  type R2Bucket = CloudflareBucket;
  type RateLimit = CloudflareRateLimit;
}
