import type { SitesDeps } from "../types/worker";

export function requestHost(
  deps: SitesDeps,
  request: Request,
  url: URL
): string {
  const override = request.headers.get("x-notra-host");
  if (
    override &&
    deps.devHostOverrideToken &&
    request.headers.get("x-notra-dev-token") === deps.devHostOverrideToken
  ) {
    return override;
  }
  return url.hostname;
}
