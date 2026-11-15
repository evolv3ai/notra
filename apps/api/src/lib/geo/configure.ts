import {
  allowUnmeteredAiInDevelopment,
  autumn,
} from "@notra/ai/billing/autumn";
import { checkContentBilling } from "@notra/ai/billing/content-billing";
import { FEATURES } from "@notra/ai/billing/features";
import {
  GeoEngineCredentialsRequired,
  GeoEntitlementService,
  GeoGenerationService,
  GeoWorkflowService,
} from "@notra/geo-core/deps";
import {
  agentReadinessNetworkLayer,
  geoModelLayer,
  geoCodingAgentAccessLayer,
} from "@notra/geo-core/geo/host-layers";
import { geoSearchConsoleLive } from "@notra/geo-core/geo/search-console-live";
import {
  GeoBillingError,
  GeoGenerationTrackingError,
  GeoWorkflowStartError,
} from "@notra/geo-core/schemas/host-service-errors";
import type { GeoZdrEntitlement } from "@notra/geo-core/types/geo";
import { Redis } from "@upstash/redis";
import { Effect, Layer } from "effect";

import {
  AGENT_READINESS_INTERNAL_WORKFLOW_PATH,
  GEO_SCAN_INTERNAL_WORKFLOW_PATH,
  GEO_WRITER_INTERNAL_WORKFLOW_PATH,
} from "../../constants/geo";
import { addActiveGeneration } from "../../utils/active-generations";
import {
  getInternalWorkflowUrl,
  startDashboardWorkflowEffect,
} from "../../utils/internal-workflow";
import { internalDashboardLive } from "../internal-dashboard";

const redis = Redis.fromEnv();

function startWorkflowRun(spanName: string, path: string) {
  return Effect.fn(spanName)(function* (payload: unknown) {
    const runId = yield* startDashboardWorkflowEffect(
      getInternalWorkflowUrl(process.env, path),
      payload
    ).pipe(
      Effect.provide(internalDashboardLive),
      Effect.mapError((cause) => new GeoWorkflowStartError({ cause }))
    );
    return { runId };
  });
}

const workflowLayer = Layer.succeed(GeoWorkflowService, {
  startGeoScanRun: startWorkflowRun(
    "GeoApiWorkflow.startGeoScanRun",
    GEO_SCAN_INTERNAL_WORKFLOW_PATH
  ),
  startGeoWriterRun: startWorkflowRun(
    "GeoApiWorkflow.startGeoWriterRun",
    GEO_WRITER_INTERNAL_WORKFLOW_PATH
  ),
  startAgentReadinessRun: startWorkflowRun(
    "GeoApiWorkflow.startAgentReadinessRun",
    AGENT_READINESS_INTERNAL_WORKFLOW_PATH
  ),
});

const entitlementLayer = Layer.succeed(GeoEntitlementService, {
  resolveZdrEntitlement: Effect.fn("GeoApiEntitlement.resolveZdr")(
    function* (organizationId) {
      if (allowUnmeteredAiInDevelopment) {
        return "entitled";
      }
      const client = autumn;
      if (!client) {
        return process.env.NODE_ENV === "production"
          ? "not_entitled"
          : "entitled";
      }
      return yield* Effect.promise(async (): Promise<GeoZdrEntitlement> => {
        try {
          const data = await client.check({
            customerId: organizationId,
            featureId: FEATURES.ZDR,
          });
          return data.allowed === true ? "entitled" : "not_entitled";
        } catch {
          return "unknown";
        }
      });
    }
  ),
  checkScanBilling: Effect.fn("GeoApiEntitlement.checkScanBilling")(
    (organizationId) =>
      Effect.tryPromise({
        try: () =>
          checkContentBilling({
            organizationId,
            outputType: null,
            quotaFeatureId: FEATURES.AI_ANSWERS,
          }),
        catch: (cause) => new GeoBillingError({ cause }),
      })
  ),
});

const generationLayer = Layer.succeed(GeoGenerationService, {
  addActiveGeneration: Effect.fn("GeoApiGeneration.addActive")(
    (organizationId, generation) =>
      Effect.tryPromise({
        try: () => addActiveGeneration(redis, organizationId, generation),
        catch: (cause) => new GeoGenerationTrackingError({ cause }),
      })
  ),
  generateRunId: Effect.fn("GeoApiGeneration.generateRunId")((triggerId) =>
    Effect.sync(() => `${triggerId}-${Date.now()}`)
  ),
});

const engineCredentialsLayer = Layer.succeed(
  GeoEngineCredentialsRequired,
  false
);

export const geoCoreApiLayer = Layer.mergeAll(
  engineCredentialsLayer,
  agentReadinessNetworkLayer,
  geoModelLayer,
  geoSearchConsoleLive,
  workflowLayer,
  entitlementLayer,
  geoCodingAgentAccessLayer,
  generationLayer
);
