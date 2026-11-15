import {
  GEO_CONTEXT_GOOGLE_ORIGIN,
  GEO_CONTEXT_SOURCE_TIMEOUT_MS,
} from "../constants/geo-context";
import { geoContextSourceUrl } from "./geo-context-answer";

/** Only Google is contacted. Never follow an untrusted citation to its target. */
export async function resolveGeoContextSource(
  value: string,
  signal: AbortSignal
): Promise<string> {
  let current = new URL(value);
  for (let redirects = 0; redirects < 4; redirects += 1) {
    if (current.hostname !== "www.google.com") {
      const resolved = geoContextSourceUrl(current.href);
      if (!resolved || current.hostname === "google.com") {
        throw new Error("Context citation has an invalid destination");
      }
      return resolved;
    }
    if (
      current.origin !== GEO_CONTEXT_GOOGLE_ORIGIN ||
      !["/goto", "/url"].includes(current.pathname) ||
      current.username ||
      current.password
    ) {
      throw new Error("Context citation is not a supported Google redirect");
    }
    const response = await fetch(current.href, {
      redirect: "manual",
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(GEO_CONTEXT_SOURCE_TIMEOUT_MS),
      ]),
    });
    await response.body?.cancel();
    const location = response.headers.get("location");
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) {
      throw new Error("Google citation destination could not be resolved");
    }
    current = new URL(location, current);
    if (!geoContextSourceUrl(current.href)) {
      throw new Error("Google citation redirected to an invalid destination");
    }
  }
  throw new Error("Google citation exceeded the redirect limit");
}
