import {
  TRAFFIC_EMBED_DEFAULT_HEIGHT,
  TRAFFIC_EMBED_DEFAULT_RANGE,
  TRAFFIC_EMBED_ID_LENGTH,
  TRAFFIC_EMBED_PATH_PREFIX,
  TRAFFIC_EMBED_RANGES,
  TRAFFIC_EMBED_SANDBOX,
} from "../constants/traffic-embed";
import type {
  TrafficEmbedOriginResult,
  TrafficEmbedPart,
  TrafficEmbedRange,
  TrafficEmbedTheme,
} from "../types/traffic-embed";

const EMBED_ID_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{${TRAFFIC_EMBED_ID_LENGTH}}$`
);
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//;
const WILDCARD_PREFIX = "*.";
const WILDCARD_PLACEHOLDER = "notra-wildcard.";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
// The URL parser lets through characters like ";" that would end the CSP
// directive, so hostnames are held to DNS labels.
const HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const EMBED_THEMES = new Set<TrafficEmbedTheme>(["light", "dark", "auto"]);
const EMBED_PARTS = ["metrics", "chart"] as const satisfies TrafficEmbedPart[];

export function isTrafficEmbedId(value: string): boolean {
  return EMBED_ID_PATTERN.test(value);
}

/** The embed id when `pathname` is an embed page, otherwise null. */
export function trafficEmbedIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(TRAFFIC_EMBED_PATH_PREFIX)) {
    return null;
  }
  const id = pathname.slice(TRAFFIC_EMBED_PATH_PREFIX.length).split("/")[0];
  return id && isTrafficEmbedId(id) ? id : null;
}

export function isTrafficEmbedPath(pathname: string): boolean {
  return pathname.startsWith(TRAFFIC_EMBED_PATH_PREFIX);
}

/**
 * Turns what a user types ("example.com", "https://blog.example.com/",
 * "*.example.com", "http://localhost:3000") into a CSP host source. Plain
 * http is only accepted for loopback hosts, so a framing page can't be
 * swapped on the network; paths, queries and credentials are rejected.
 */
export function normalizeTrafficEmbedOrigin(
  input: string
): TrafficEmbedOriginResult {
  const value = input.trim().toLowerCase();
  if (!value || value === "*" || /\s/.test(value)) {
    return { ok: false, value: input };
  }
  const withScheme = SCHEME_PATTERN.test(value) ? value : `https://${value}`;
  const schemeEnd = withScheme.indexOf("://") + "://".length;
  const wildcard = withScheme.slice(schemeEnd).startsWith(WILDCARD_PREFIX);
  const parseable = wildcard
    ? `${withScheme.slice(0, schemeEnd)}${WILDCARD_PLACEHOLDER}${withScheme.slice(schemeEnd + WILDCARD_PREFIX.length)}`
    : withScheme;

  let url: URL;
  try {
    url = new URL(parseable);
  } catch {
    return { ok: false, value: input };
  }

  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  const hasExtras =
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/";
  const secure =
    url.protocol === "https:" || (url.protocol === "http:" && loopback);
  const bareHost = wildcard
    ? url.hostname.slice(WILDCARD_PLACEHOLDER.length)
    : url.hostname;
  const isDomain =
    loopback || (bareHost.includes(".") && HOSTNAME_PATTERN.test(bareHost));
  if (hasExtras || !secure || !isDomain || (wildcard && loopback)) {
    return { ok: false, value: input };
  }

  const host = wildcard
    ? url.host.replace(WILDCARD_PLACEHOLDER, WILDCARD_PREFIX)
    : url.host;
  return { ok: true, origin: `${url.protocol}//${host}` };
}

/** `'self'` keeps the preview in the dashboard's embed dialog working. */
export function trafficEmbedFrameAncestors(origins: readonly string[]): string {
  return ["'self'", ...origins].join(" ");
}

function isTrafficEmbedRange(value: unknown): value is TrafficEmbedRange {
  return (
    typeof value === "string" &&
    (TRAFFIC_EMBED_RANGES as readonly string[]).includes(value)
  );
}

export function trafficEmbedRange(value: unknown): TrafficEmbedRange {
  return isTrafficEmbedRange(value) ? value : TRAFFIC_EMBED_DEFAULT_RANGE;
}

export function trafficEmbedTheme(value: unknown): TrafficEmbedTheme {
  return typeof value === "string" &&
    EMBED_THEMES.has(value as TrafficEmbedTheme)
    ? (value as TrafficEmbedTheme)
    : "auto";
}

/** Unknown or empty `parts` fall back to the whole card. */
export function trafficEmbedParts(value: unknown): TrafficEmbedPart[] {
  if (typeof value !== "string") {
    return [...EMBED_PARTS];
  }
  const requested = new Set(value.split(",").map((part) => part.trim()));
  const parts = EMBED_PARTS.filter((part) => requested.has(part));
  return parts.length === 0 ? [...EMBED_PARTS] : parts;
}

export function trafficEmbedUrl(
  origin: string,
  id: string,
  options: {
    range: TrafficEmbedRange;
    theme: TrafficEmbedTheme;
    parts: readonly TrafficEmbedPart[];
    locale?: string;
  }
): string {
  const url = new URL(`${TRAFFIC_EMBED_PATH_PREFIX}${id}`, origin);
  if (options.range !== TRAFFIC_EMBED_DEFAULT_RANGE) {
    url.searchParams.set("range", options.range);
  }
  if (options.theme !== "auto") {
    url.searchParams.set("theme", options.theme);
  }
  if (options.parts.length < EMBED_PARTS.length) {
    url.searchParams.set("parts", options.parts.join(","));
  }
  if (options.locale) {
    url.searchParams.set("locale", options.locale);
  }
  return url.toString();
}

/**
 * The iframe works on its own at a fixed height; the script only listens for
 * the page's resize messages so the frame grows with its content.
 */
export function trafficEmbedSnippet(
  origin: string,
  src: string,
  title: string
): string {
  return [
    "<iframe",
    `  src="${src}"`,
    `  title="${title.replaceAll('"', "&quot;")}"`,
    "  data-notra-embed",
    '  width="100%"',
    `  height="${TRAFFIC_EMBED_DEFAULT_HEIGHT}"`,
    `  sandbox="${TRAFFIC_EMBED_SANDBOX}"`,
    '  style="border:0;width:100%"',
    '  loading="lazy"',
    "></iframe>",
    `<script src="${origin}/embed.js" async></script>`,
  ].join("\n");
}
