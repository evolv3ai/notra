import { extractDemoAffected } from "@notra/ai/utils/demo-affected";
import { recordDemoRequest } from "@notra/ai/utils/demo-request-log";
import { DEMO_CONSOLE_HEADER } from "@notra/utils/constants/demo";
import type { Context, Next } from "hono";

import { getOrganizationIdFromAuth } from "../types/auth";
import type { ApiEnv } from "../types/env";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const STREAMED_CONTENT_TYPES = ["text/event-stream", "application/x-ndjson"];

async function readBody(source: Request | Response): Promise<string | null> {
  try {
    const text = await source.clone().text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function isStreamed(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return STREAMED_CONTENT_TYPES.some((type) => contentType.includes(type));
}

export async function demoRequestLogMiddleware(c: Context<ApiEnv>, next: Next) {
  const startedAt = performance.now();
  const isMutation = MUTATION_METHODS.has(c.req.method);
  const requestBody = isMutation ? await readBody(c.req.raw) : null;

  await next();

  const auth = c.get("auth");
  const organizationId = auth ? getOrganizationIdFromAuth(auth) : null;
  if (!organizationId) {
    return;
  }
  const path = new URL(c.req.url).pathname;
  const responseBody = isStreamed(c.res) ? null : await readBody(c.res);
  await recordDemoRequest({
    organizationId,
    source: c.req.header(DEMO_CONSOLE_HEADER) ? "console" : "api",
    method: c.req.method,
    path,
    status: c.res.status,
    durationMs: performance.now() - startedAt,
    requestBody,
    responseBody,
    affected:
      isMutation && c.res.ok ? extractDemoAffected(path, responseBody) : [],
  });
}
