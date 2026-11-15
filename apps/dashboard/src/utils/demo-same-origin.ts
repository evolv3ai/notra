const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originOf(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * The demo session cookie is SameSite=None (the demo runs in an iframe), so
 * the browser attaches it to cross-site posts too. State-changing demo
 * routes only accept requests the demo's own pages sent. `request.url`
 * can carry the bind address behind a reverse proxy, so the public host comes from
 * the forwarded headers; requests without either header (curl) pass, since
 * they can't carry a victim's cookie.
 */
export function isForeignDemoRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return false;
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return true;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const allowed = new Set(
    [host ? `${proto}://${host}` : undefined, process.env.APP_URL, request.url]
      .map(originOf)
      .filter((value) => value !== null)
  );
  const requestOrigin = originOf(origin);
  return !(requestOrigin && allowed.has(requestOrigin));
}
