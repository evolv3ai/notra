import { isDemoMode } from "@notra/utils/demo-mode";

import { DEMO_ROBOTS_TXT, ROBOTS_TXT } from "@/constants/robots";

export function GET() {
  return new Response(isDemoMode() ? DEMO_ROBOTS_TXT : ROBOTS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
