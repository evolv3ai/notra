import { TRAFFIC_EMBED_NAME_MAX_LENGTH } from "@notra/schemas/dashboard/traffic-embed";

/**
 * The dialog has no name field, so the first domain names the embed, cut to
 * the length the server accepts.
 */
export function trafficEmbedName(origins: readonly string[]): string {
  const first = origins[0]?.replace(/^https?:\/\//, "");
  return (first || "Embed").slice(0, TRAFFIC_EMBED_NAME_MAX_LENGTH);
}
