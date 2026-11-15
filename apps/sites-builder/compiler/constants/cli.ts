export const USAGE = `notra-sites <command>

  validate [--source <dir>] [--target <file>] [--json]  Check settings, MDX and snippets
  build --source <dir> --target <file> --out <dir> [--json]
  dev [--source <dir>] [--target <file>] [--area blog|changelog] [--port 4321]   (serves every area; --area picks the one "/" redirects to)`;

export const DEV_READY_TIMEOUT_MS = 60_000;
export const DEV_PORT_SEARCH_RANGE = 100;
export const ASTRO_READY_URL = /http:\/\/127\.0\.0\.1:(\d+)(?=\D)/;
export const ASTRO_READY_SCAN_CHARS = 512;
export const DEV_STOP_TIMEOUT_MS = 5000;
export const DEV_HMR_GENERATION_EVENT = "notra:page-generation";
export const DEV_ERRORS_PATH = "/__notra-dev/errors";
export const DEV_ERRORS_POLL_MS = 1000;
export const DEV_PROXY_MAX_ATTEMPTS = 3;
export const DEV_PROXY_RETRY_DELAY_MS = 50;
export const DEV_PROXY_RETRY_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
]);
export const DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const DEV_FAVICON_URL = "https://www.google.com/s2/favicons";
