import { SITES_LIVE_CHANNEL_PREFIX } from "../constants/sites";

export function sitesLiveChannel(organizationId: string): string {
  return `${SITES_LIVE_CHANNEL_PREFIX}:${organizationId}`;
}
