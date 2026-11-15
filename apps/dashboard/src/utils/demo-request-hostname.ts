/** Unkey terminates public requests before forwarding to the bind address. */
export function getDemoRequestHostname(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (!host) {
      return new URL(request.url).hostname;
    }
    const url = new URL(`https://${host}`);
    if (
      host.includes(",") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return "";
    }
    return url.hostname;
  } catch {
    return "";
  }
}
