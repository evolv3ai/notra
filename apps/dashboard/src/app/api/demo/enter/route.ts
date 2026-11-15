import { isDemoMode } from "@notra/utils/demo-mode";

import { DEMO_START_PATH } from "@/constants/demo";
import { getCurrentDemoSandbox } from "@/lib/demo/session";
import { safeDemoReturnTo } from "@/utils/demo-return-to";

function redirectTo(location: string) {
  return new Response(null, {
    status: 307,
    headers: { location, "Cache-Control": "no-store" },
  });
}

/**
 * GET must not allocate workspaces or refill the pool: new visitors pass
 * the human check before POST /api/demo/sandbox claims any capacity.
 */
export async function GET(request: Request) {
  if (!isDemoMode()) {
    return new Response(null, { status: 404 });
  }
  const target = safeDemoReturnTo(
    new URL(request.url).searchParams.get("returnTo")
  );
  if (await getCurrentDemoSandbox()) {
    return redirectTo(target ?? "/");
  }

  const query = target ? `?${new URLSearchParams({ returnTo: target })}` : "";
  return redirectTo(`${DEMO_START_PATH}${query}`);
}
