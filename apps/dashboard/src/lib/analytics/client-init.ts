import { POSTHOG_PROJECT_TOKEN } from "@/constants/posthog";
import { initPostHog } from "@/lib/analytics/posthog-lazy";
import { isTrafficEmbedPath } from "@/utils/traffic-embed";

const POSTHOG_INIT_FALLBACK_DELAY_MS = 2000;

// Embeds are viewed by other companies' visitors, who never agreed to this.
if (
  POSTHOG_PROJECT_TOKEN &&
  typeof window !== "undefined" &&
  !isTrafficEmbedPath(window.location.pathname)
) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => initPostHog(), {
      timeout: POSTHOG_INIT_FALLBACK_DELAY_MS,
    });
  } else {
    window.setTimeout(() => initPostHog(), POSTHOG_INIT_FALLBACK_DELAY_MS);
  }
}
