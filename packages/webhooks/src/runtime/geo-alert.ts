import { ManagedRuntime } from "effect";

import { publishGeoAlert } from "../programs/geo-alert";
import type { GeoAlertWebhook } from "../types/geo-alert";
import { postgresDatabaseLayer } from "./postgres";

const runtime = ManagedRuntime.make(postgresDatabaseLayer);

export const recordGeoAlert = (alert: GeoAlertWebhook) =>
  runtime.runPromise(publishGeoAlert(alert));
