import { logWarn } from "@notra/ai/utils/server-log";
import { isDemoMode } from "@notra/utils/demo-mode";
import { getRequestHeaders as headers } from "@tanstack/react-start/server";

import { verifyDemoHumanCheck } from "@/lib/demo/human-check";
import { createDemoSandbox, maintainDemoSandboxPool } from "@/lib/demo/sandbox";
import { writeDemoSession } from "@/lib/demo/session";
import { demoSandboxAdmissionInputSchema } from "@/schemas/demo";
import type { DemoSandboxCreateResponse } from "@/types/demo";
import { getDemoClientIp, hashDemoClientIp } from "@/utils/demo-ip-hash";
import { getDemoRequestHostname } from "@/utils/demo-request-hostname";
import { isForeignDemoRequest } from "@/utils/demo-same-origin";
import { ratelimit } from "@/utils/ratelimit";

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return new Response(null, { status: 404 });
  }
  if (isForeignDemoRequest(request)) {
    return Response.json({ error: "Cross-site request" }, { status: 403 });
  }

  const ipHash = hashDemoClientIp(getDemoClientIp(await headers()));
  const { success } = await ratelimit.demoSandboxCreate.limit(ipHash);
  if (!success) {
    logWarn("[demo] Workspace admission rate limited", {
      reason: "rate_limited",
    });
    return Response.json(
      { error: "Too many demo workspaces from this network" },
      { status: 429 }
    );
  }

  const parsed = demoSandboxAdmissionInputSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    logWarn("[demo] Invalid workspace admission request", {
      reason: "invalid_admission",
    });
    return Response.json(
      { error: "Complete the human verification and try again." },
      { status: 403 }
    );
  }
  if (
    !(await verifyDemoHumanCheck(
      parsed.data["cf-turnstile-response"],
      getDemoRequestHostname(request)
    ))
  ) {
    return Response.json(
      { error: "Complete the human verification and try again." },
      { status: 403 }
    );
  }
  const sandbox = await createDemoSandbox({
    timeZone: parsed.data.timeZone ?? null,
    ipHash,
  });
  if (!sandbox) {
    return Response.json(
      { error: "Demo workspace creation is busy. Please try again." },
      { status: 503, headers: { "Retry-After": "3" } }
    );
  }
  await writeDemoSession(sandbox.anonymousId);
  maintainDemoSandboxPool();

  const body: DemoSandboxCreateResponse = { slug: sandbox.slug };
  return Response.json(body, { status: 201 });
}
