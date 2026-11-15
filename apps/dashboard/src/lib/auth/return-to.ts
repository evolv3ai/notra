import { sanitizeReturnTo } from "@notra/utils/auth-redirect";

export function buildPostAuthRedirectPath(
  returnTo: string | null | undefined
): string {
  const safeReturnTo = sanitizeReturnTo(returnTo ?? null);

  if (!safeReturnTo) {
    return "/callback";
  }

  const callbackPath = safeReturnTo.split(/[?#]/, 1)[0];
  if (callbackPath === "/callback") {
    return safeReturnTo;
  }

  return `/callback?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
