import { createHash } from "node:crypto";

import type { SiteDiagnostic } from "@notra/sites-core/types/build";

import { DEV_ERRORS_PATH, DEV_ERRORS_POLL_MS } from "../constants/cli";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function diagnosticLocation(diagnostic: SiteDiagnostic): string {
  if (!diagnostic.file) {
    return "site";
  }
  if (!diagnostic.line) {
    return diagnostic.file;
  }
  return `${diagnostic.file}:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ""}`;
}

// Changes whenever the set of errors does, so pages notice partial fixes too.
export function devErrorsKey(errors: SiteDiagnostic[]): string {
  if (errors.length === 0) {
    return "";
  }
  return createHash("sha1")
    .update(
      JSON.stringify(
        errors.map((error) => [
          error.file,
          error.line,
          error.column,
          error.message,
        ])
      )
    )
    .digest("hex")
    .slice(0, 16);
}

// Served instead of the stale page while the site has errors, and reloads
// itself when they change or are fixed.
export function devErrorPage(errors: SiteDiagnostic[]): string {
  const items = errors
    .map(
      (error) =>
        `<li><code>${escapeHtml(diagnosticLocation(error))}</code><p>${escapeHtml(error.message)}</p></li>`
    )
    .join("");
  const title = errors.length === 1 ? "1 error" : `${errors.length} errors`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Notra Sites preview</title>
<style>
:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; padding: 48px 24px; }
main { max-width: 720px; margin: 0 auto; }
h1 { font-size: 20px; margin: 0 0 4px; }
.hint { margin: 0 0 24px; opacity: 0.7; }
ul { list-style: none; margin: 0; padding: 0; }
li { border: 1px solid color-mix(in oklab, currentColor 18%, transparent); border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; }
code { font-family: ui-monospace, monospace; font-size: 13px; color: #dc2626; }
li p { margin: 6px 0 0; white-space: pre-wrap; }
</style>
</head>
<body>
<main>
<h1>Your site has ${title}</h1>
<p class="hint">Fix ${errors.length === 1 ? "it" : "them"} and this page reloads.</p>
<ul>${items}</ul>
</main>
<script>
const poll = async () => {
  try {
    const response = await fetch(${JSON.stringify(DEV_ERRORS_PATH)}, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    const { key } = await response.json();
    if (key !== ${JSON.stringify(devErrorsKey(errors))}) {
      location.reload();
      return;
    }
  } catch {}
  setTimeout(poll, ${DEV_ERRORS_POLL_MS});
};
setTimeout(poll, ${DEV_ERRORS_POLL_MS});
</script>
</body>
</html>`;
}
