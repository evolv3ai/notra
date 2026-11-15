import { Effect } from "effect";

import type {
  GeoModelCatalog,
  GeoScopeInput,
  GeoSkipFields,
  GeoZdrPolicy,
} from "../types/geo";
import { isGeoConsumerConversationEngine } from "../utils/geo-conversation-engine";
import { resolveGeoZdrMode } from "../utils/geo-engines";
import { geoLogWarn } from "../utils/geo-log";
import { geoSkip } from "./effect";
import { startGeoScanScoped } from "./programs";

/** Tracked consumer-app engines a manual conversation run may use under ZDR. */
export const resolveGeoManualOlostepEngines = Effect.fn(
  "geo.resolveManualOlostepEngines"
)(function* (
  catalog: GeoModelCatalog,
  engines: readonly string[],
  zdrPolicy: GeoZdrPolicy,
  fields: GeoSkipFields
) {
  const allowed: string[] = [];
  for (const engine of engines) {
    if (
      !isGeoConsumerConversationEngine(engine) ||
      !catalog.models.some((model) => model.id === engine)
    ) {
      continue;
    }
    if (resolveGeoZdrMode(catalog, engine, zdrPolicy) === null) {
      yield* geoLogWarn({
        event: "geo.scan.skipped",
        reason: "zdr",
        ...fields,
        engine,
      });
      continue;
    }
    allowed.push(engine);
  }
  return allowed;
});

/**
 * Consumer apps use Context captures or Olostep batches that can take half an hour, so
 * a manual run hands them to a scan scoped to this conversation instead of
 * holding the request open. The scan takes the slot claim, billing and
 * finalize like any other, and runs while automatic scans are paused just like
 * the synchronous API engines do. A failed hand-off only fails the run when no
 * API engine answered synchronously.
 */
export function queueGeoOlostepConversationScan(
  input: GeoScopeInput,
  promptId: string,
  engines: readonly string[],
  fields: GeoSkipFields,
  required: boolean
) {
  if (engines.length === 0) {
    return Effect.succeed(null);
  }
  const started = startGeoScanScoped(input, [promptId], engines, true);
  return required
    ? started
    : started.pipe(geoSkip("olostep conversation scan start failed", fields));
}
