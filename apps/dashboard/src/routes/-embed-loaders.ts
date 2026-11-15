import { isDemoMode } from "@notra/utils/demo-mode";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import type { UiRouteInput } from "@/types/ui-route";
import { isTrafficEmbedId, trafficEmbedRange } from "@/utils/traffic-embed";

export const loadTrafficEmbed = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params, searchParams } }) => {
    const embedId = params.id ?? "";
    if (isDemoMode() || !isTrafficEmbedId(embedId)) {
      throw notFound();
    }
    const { loadPublicTrafficEmbed } = await import("@/lib/geo/traffic-embeds");
    const embed = await loadPublicTrafficEmbed(
      embedId,
      trafficEmbedRange(searchParams.range)
    );
    if (!embed) {
      throw notFound();
    }
    return embed;
  });
