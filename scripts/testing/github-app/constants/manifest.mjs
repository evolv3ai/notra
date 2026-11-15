export const FLOW_TTL_MS = 60 * 60 * 1000;

export const REPOSITORY_PERMISSIONS = {
  contents: "write",
  pull_requests: "write",
  checks: "write",
  metadata: "read",
};

export const WEBHOOK_EVENTS = ["push", "pull_request", "check_run"];

export const API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2026-03-10",
  "User-Agent": "notra-sites-e2e-manifest",
};
