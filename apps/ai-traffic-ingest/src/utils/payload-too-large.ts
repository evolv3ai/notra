import type { Context } from "hono";

export function payloadTooLarge(context: Context): Response {
  return context.json({ error: "Payload too large" }, 413, {
    Connection: "close",
  });
}
