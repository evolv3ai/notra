import type { DemoPersonalization } from "@notra/db/types/demo";
import { isDemoMode } from "@notra/utils/demo-mode";

import { resetDemoSandboxExclusive } from "@/lib/demo/sandbox";
import { getCurrentDemoSandbox } from "@/lib/demo/session";
import type { DemoSandbox } from "@/types/demo";
import { isForeignDemoRequest } from "@/utils/demo-same-origin";
import { ratelimit } from "@/utils/ratelimit";

/**
 * Wraps a demo API route: 404 outside the demo, 403 for cross-site writes,
 * 401 without a sandbox, otherwise runs `handler` with the visitor's sandbox.
 */
export function demoSandboxRoute<TArgs extends unknown[]>(
  handler: (
    sandbox: DemoSandbox,
    request: Request,
    ...args: TArgs
  ) => Promise<Response>
): (request: Request, ...args: TArgs) => Promise<Response> {
  return async (request, ...args) => {
    if (!isDemoMode()) {
      return new Response(null, { status: 404 });
    }
    if (isForeignDemoRequest(request)) {
      return Response.json({ error: "Cross-site request" }, { status: 403 });
    }
    const sandbox = await getCurrentDemoSandbox();
    if (!sandbox) {
      return Response.json({ error: "No demo workspace" }, { status: 401 });
    }
    return handler(sandbox, request, ...args);
  };
}

/**
 * Reset and customize both reseed a whole workspace, so they share a
 * per-sandbox budget and never run twice at once for the same sandbox.
 */
export async function rebuildDemoSandboxResponse(
  sandbox: DemoSandbox,
  personalization?: DemoPersonalization | null
): Promise<Response> {
  const { success } = await ratelimit.demoSandboxReset.limit(
    sandbox.anonymousId
  );
  if (!success) {
    return Response.json(
      { error: "Too many resets. Please wait a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  const result = await resetDemoSandboxExclusive(sandbox, personalization);
  if (result === "busy") {
    return Response.json(
      { error: "This workspace is already being rebuilt." },
      { status: 409 }
    );
  }
  return Response.json({ slug: result.slug });
}
