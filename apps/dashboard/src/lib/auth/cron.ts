import { timingSafeEqual } from "node:crypto";

/**
 * Checks the `Authorization: Bearer <CRON_SECRET>` header Vercel Cron sends.
 * Fails closed when CRON_SECRET is unset, including in local development, so
 * to call a cron route by hand set CRON_SECRET and send it as the bearer.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  if (received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(received, expected);
}
