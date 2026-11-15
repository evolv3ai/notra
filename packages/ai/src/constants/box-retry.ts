export const BOX_RETRY_ATTEMPTS = 3;
export const BOX_RETRY_DELAY_MS = 1000;

// Messages the Box SDK and undici put on transport failures. Kept as the
// original contract: anything that matched these before still retries.
export const TRANSIENT_BOX_ERROR_MESSAGES = [
  "fetch failed",
  "ECONNRESET",
  "UND_ERR",
] as const;

// Node/undici codes found on `error.code` or `error.cause.code` that mean the
// connection never formed, so the request was never sent. Codes for failures
// after submission (socket reset, header/body timeouts) are left out on
// purpose: Box create and exec are not idempotent, and retrying them could
// start a second box or run a command twice.
export const TRANSIENT_BOX_NETWORK_CODES: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);
