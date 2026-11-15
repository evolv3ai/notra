import { realtime } from "@notra/ai/realtime";
import { sitesLiveChannel } from "@notra/sites-core/utils/live";

import { errorMessage } from "./utils/errors";

/**
 * Tells open dashboard tabs that a site's deployments changed so they refetch
 * instead of waiting for the next poll. Call it after the change committed; a
 * failed publish only costs the live update, polling still catches up.
 */
export async function publishSiteDeploymentChange(
  organizationId: string,
  siteId: string
): Promise<void> {
  if (!realtime) {
    return;
  }
  try {
    await realtime
      .channel(sitesLiveChannel(organizationId))
      .emit("sites.deployment", { siteId });
  } catch (error) {
    console.warn("sites.live_publish_failed", errorMessage(error));
  }
}
