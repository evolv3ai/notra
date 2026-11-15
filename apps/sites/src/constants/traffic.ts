export const TRAFFIC_CONTENT_TYPES = [
  "text/html",
  "text/markdown",
  "text/plain",
];

export const TRAFFIC_REPORT_TIMEOUT_MS = 2000;

export const TRAFFIC_TRACING_HEADERS = ["traceparent", "b3", "x-b3-traceid"];

/**
 * The address Cloudflare gives a Worker's request to another Cloudflare zone.
 * Its location data still describes the visitor the Worker is serving.
 */
export const CLOUDFLARE_WORKER_SUBREQUEST_IP = "2a06:98c0:3600::103";
