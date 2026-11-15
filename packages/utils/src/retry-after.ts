/**
 * Delay a Retry-After header asks for, in milliseconds: delay-seconds or an
 * HTTP-date (RFC 9110 10.2.3). A past HTTP-date gives a negative delay.
 */
export function parseRetryAfterMs(
  value: string | null | undefined,
  now = Date.now()
): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? seconds * 1000 : undefined;
  }
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? retryAt - now : undefined;
}
