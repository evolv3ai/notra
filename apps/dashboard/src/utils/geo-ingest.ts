import {
  GEO_CLOUDFLARE_LOGPUSH_FIELDS,
  GEO_INGEST_DEFAULT_FRAMEWORK,
  GEO_INGEST_METHODS,
  GEO_INGEST_DEFAULT_PACKAGE_MANAGER,
  GEO_INGEST_FRAMEWORK_OPTIONS,
  GEO_INGEST_INSTALL_COMMAND,
  GEO_INGEST_PACKAGE_MANAGER_OPTIONS,
  GEO_INGEST_SNIPPET_FALLBACK,
  GEO_INGEST_TOKEN_ENV,
} from "@notra/geo-core/constants/geo";
import type {
  GeoIngestFramework,
  GeoIngestMethod,
  GeoIngestPackageManager,
  GeoIngestSetupResponse,
} from "@notra/geo-core/types/geo";
import { NOTRA_AGENT_FEEDBACK_PROMPT } from "@notra/utils/constants/agent-feedback-prompt";

export function geoIngestSnippet(
  setup: GeoIngestSetupResponse | undefined,
  framework: GeoIngestFramework = GEO_INGEST_DEFAULT_FRAMEWORK
): string {
  return (
    setup?.snippets?.[framework] ||
    setup?.snippet ||
    GEO_INGEST_SNIPPET_FALLBACK
  );
}

export function geoIngestInstallCommand(
  packageManager: GeoIngestPackageManager = GEO_INGEST_DEFAULT_PACKAGE_MANAGER
): string {
  return (
    GEO_INGEST_PACKAGE_MANAGER_OPTIONS.find(
      (candidate) => candidate.value === packageManager
    )?.command ?? GEO_INGEST_INSTALL_COMMAND
  );
}

export function geoIngestAgentPrompt(
  setup: GeoIngestSetupResponse | undefined,
  framework: GeoIngestFramework = GEO_INGEST_DEFAULT_FRAMEWORK,
  packageManager: GeoIngestPackageManager = GEO_INGEST_DEFAULT_PACKAGE_MANAGER
): string {
  const option = GEO_INGEST_FRAMEWORK_OPTIONS.find(
    (candidate) => candidate.value === framework
  );
  const file = option?.file ?? "proxy.ts";
  const label = option?.label ?? "Next.js";

  const lines = [
    `Set up Notra GEO tracking (AI crawler and referral analytics) in this ${label} project.`,
    "",
    `1. Install the package: \`${geoIngestInstallCommand(packageManager)}\` (use this project's package manager if it differs).`,
    `2. Create ${file} with the following content. If the file already exists, merge the tracking call into it instead of replacing it:`,
    "",
    "```ts",
    geoIngestSnippet(setup, framework),
    "```",
    "",
    `3. Add ${GEO_INGEST_TOKEN_ENV} to the site's environment variables (local env file and hosting provider). Repeat for every domain this project tracks. Ask me for the value - never hardcode or commit it.`,
  ];
  if (framework === "astro") {
    lines.push(
      '4. Serve pages from an Astro server adapter (`output: "server"` or hybrid). A static build has no request to capture after deploy.'
    );
  }
  if (framework === "reactRouter") {
    lines.push(
      "4. On React Router 7, upgrade to 7.9 or later and set `future: { v8_middleware: true }` in react-router.config.ts. React Router 8 always runs middleware."
    );
  }
  return [...lines, "", NOTRA_AGENT_FEEDBACK_PROMPT].join("\n");
}

export function isGeoIngestPackageManager(
  value: string
): value is GeoIngestPackageManager {
  return GEO_INGEST_PACKAGE_MANAGER_OPTIONS.some(
    (option) => option.value === value
  );
}

export function isGeoIngestFramework(
  value: string
): value is GeoIngestFramework {
  return GEO_INGEST_FRAMEWORK_OPTIONS.some((option) => option.value === value);
}

export function isGeoIngestMethod(value: string): value is GeoIngestMethod {
  return GEO_INGEST_METHODS.some((method) => method === value);
}

export function geoVercelDrainHeader(token: string): string {
  return `Authorization: Bearer ${token}`;
}

export function geoCloudflareDestination(
  setup: GeoIngestSetupResponse | undefined,
  token: string
): string {
  const endpoint = setup?.drainUrls?.cloudflare ?? "";
  return `${endpoint}?header_Authorization=Bearer%20${token}`;
}

export function geoCloudflareLogpushCommand(
  setup: GeoIngestSetupResponse | undefined
): string {
  const filter = JSON.stringify({
    where: {
      and: [
        { key: "ClientRequestMethod", operator: "eq", value: "GET" },
        { key: "ClientRequestSource", operator: "eq", value: "eyeball" },
      ],
    },
  });
  const body = {
    name: "notra-geo",
    dataset: "http_requests",
    destination_conf: geoCloudflareDestination(
      setup,
      `$${GEO_INGEST_TOKEN_ENV}`
    ),
    output_options: {
      field_names: GEO_CLOUDFLARE_LOGPUSH_FIELDS,
      timestamp_format: "rfc3339",
    },
    filter,
    enabled: true,
  };
  return [
    'curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/logpush/jobs" \\',
    '  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \\',
    "  --json @- <<EOF",
    JSON.stringify(body, null, 2),
    "EOF",
  ].join("\n");
}
