const WWW_PREFIX_REGEX = /^www\./;
const TRAILING_DOTS_REGEX = /\.+$/;
const IPV4_HOST_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const LOCAL_HOST_SUFFIX_REGEX =
  /(?:^|\.)(?:localhost|localdomain|local|internal|test|invalid|onion|home\.arpa)$/;
const TWITTER_HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;
const TWITTER_HOSTS = new Set(["twitter.com", "x.com"]);
const TWITTER_RESERVED_SEGMENTS = new Set([
  "i",
  "home",
  "search",
  "hashtag",
  "intent",
  "explore",
  "share",
]);

export function getReferenceDomain(
  sourceUrl: string | null | undefined
): string | null {
  if (!sourceUrl) {
    return null;
  }
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    // `example.com.` is the same host as `example.com`.
    const hostname = parsed.hostname.replace(TRAILING_DOTS_REGEX, "");
    return isPublicHost(hostname)
      ? hostname.replace(WWW_PREFIX_REGEX, "")
      : null;
  } catch {
    return null;
  }
}

/**
 * Loopback, LAN names and raw IPs. Agents and search sandboxes see these, but
 * no reader can open them, so they never count as a cited source.
 */
function isPublicHost(hostname: string): boolean {
  return (
    hostname.includes(".") &&
    !hostname.startsWith("[") &&
    !IPV4_HOST_REGEX.test(hostname) &&
    !LOCAL_HOST_SUFFIX_REGEX.test(hostname)
  );
}

/** The sources `getReferenceDomain` accepts. */
export function withPublicUrls<T extends { url: string }>(
  sources: readonly T[]
): T[] {
  return sources.filter((source) => getReferenceDomain(source.url) !== null);
}

export function getTwitterHandleFromUrl(
  sourceUrl: string | null | undefined
): string | null {
  if (!sourceUrl) {
    return null;
  }
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    const host = parsed.hostname.replace(WWW_PREFIX_REGEX, "");
    if (!TWITTER_HOSTS.has(host)) {
      return null;
    }
    const [firstSegment] = parsed.pathname.split("/").filter(Boolean);
    if (
      !firstSegment ||
      TWITTER_RESERVED_SEGMENTS.has(firstSegment.toLowerCase()) ||
      !TWITTER_HANDLE_REGEX.test(firstSegment)
    ) {
      return null;
    }
    return firstSegment;
  } catch {
    return null;
  }
}

export function getMetadataString(
  metadata: Record<string, unknown> | null,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getTwitterAvatarUrl(handle: string): string {
  return `https://unavatar.io/x/${encodeURIComponent(handle)}?fallback=false`;
}
