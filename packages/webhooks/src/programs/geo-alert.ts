import { Effect } from "effect";

import type { GeoAlertWebhook } from "../types/geo-alert";
import { publishEvent } from "./events";

export const publishGeoAlert = Effect.fn("webhooks.publishGeoAlert")(
  function* ({ organizationId, sourceKey, ...data }: GeoAlertWebhook) {
    return yield* publishEvent({
      organizationId,
      sourceKey,
      event: { type: "geo.alert.triggered", data },
    });
  }
);
