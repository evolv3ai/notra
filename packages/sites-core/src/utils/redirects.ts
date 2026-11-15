import type {
  SiteRedirectMatch,
  SiteRedirectRule,
} from "@notra/sites-core/types/deployment";
import type { SiteConfig } from "@notra/sites-core/types/site-config";

export function siteRedirectRules(
  redirects: SiteConfig["redirects"]
): SiteRedirectRule[] {
  return redirects.map((rule) => ({
    source: rule.source,
    destination: rule.destination,
    status: rule.permanent ? 308 : 307,
  }));
}

function withoutTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

// Location must be a printable-ASCII header value; destinations may hold any text.
function headerSafeLocation(location: string): string {
  return location.replace(/[^\u0021-\u007E]/gu, encodeURIComponent);
}

export function matchRedirect(
  redirects: readonly SiteRedirectRule[],
  path: string
): SiteRedirectMatch | null {
  const match = findRedirect(redirects, withoutTrailingSlash(path));
  return match && { ...match, location: headerSafeLocation(match.location) };
}

function findRedirect(
  redirects: readonly SiteRedirectRule[],
  bare: string
): SiteRedirectMatch | null {
  for (const rule of redirects) {
    if (rule.source.endsWith("/*")) {
      const prefix = rule.source.slice(0, -2);
      if (bare === prefix || bare.startsWith(`${prefix}/`)) {
        // `path` is decoded; re-encode so the remainder is a valid header value.
        const rest = bare
          .slice(prefix.length)
          .split("/")
          .map(encodeURIComponent)
          .join("/");
        const destination = rule.destination.endsWith("/*")
          ? `${rule.destination.slice(0, -2)}${rest}`
          : rule.destination;
        return { location: destination, status: rule.status };
      }
    } else if (withoutTrailingSlash(rule.source) === bare) {
      return { location: rule.destination, status: rule.status };
    }
  }
  return null;
}
