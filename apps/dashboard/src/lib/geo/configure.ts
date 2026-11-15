import { checkContentBilling } from "@notra/ai/billing/content-billing";
import { FEATURES } from "@notra/ai/billing/features";
import {
  GeoContentBillingService,
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
import { Effect, Layer } from "effect";

import { addActiveGeneration, generateRunId } from "@/lib/generations/tracking";
import { resolveZdrEntitlement } from "@/utils/resolve-zdr-entitlement";

const workflowLayer = Layer.succeed(GeoWorkflowService, {
  startGeoScanRun: Effect.fn("GeoDashboardWorkflow.startGeoScanRun")(
    (payload) =>
      Effect.tryPromise({
        try: async () =>
          (await import("@/lib/workflows/start")).startGeoScanRun(payload),
        catch: (cause) => new GeoWorkflowStartError({ cause }),
      })
  ),
  startGeoWriterRun: Effect.fn("GeoDashboardWorkflow.startGeoWriterRun")(
    (payload) =>
      Effect.tryPromise({
        try: async () =>
          (await import("@/lib/workflows/start")).startGeoWriterRun(payload),
        catch: (cause) => new GeoWorkflowStartError({ cause }),
      })
  ),
  startAgentReadinessRun: Effect.fn(
    "GeoDashboardWorkflow.startAgentReadinessRun"
  )((payload) =>
    Effect.tryPromise({
      try: async () =>
        (await import("@/lib/workflows/start")).startAgentReadinessRun(payload),
      catch: (cause) => new GeoWorkflowStartError({ cause }),
    })
  ),
});

const billingLayer = Layer.succeed(GeoContentBillingService, {
  gateContentBilling: Effect.fn("GeoDashboardBilling.gate")((input) =>
    Effect.tryPromise({
      try: async () =>
        (
          await import("@/workflows/steps/content-generation-steps")
        ).gateContentBilling(input),
      catch: (cause) => new GeoBillingError({ cause }),
    })
  ),
  finalizeContentBilling: Effect.fn("GeoDashboardBilling.finalize")((input) =>
    Effect.tryPromise({
      try: async () =>
        (
          await import("@/workflows/steps/content-generation-steps")
        ).finalizeContentBilling(input),
      catch: (cause) => new GeoBillingError({ cause }),
    })
  ),
});

const entitlementLayer = Layer.succeed(GeoEntitlementService, {
  resolveZdrEntitlement: Effect.fn("GeoDashboardEntitlement.resolveZdr")(
    (organizationId) =>
      Effect.promise(() => resolveZdrEntitlement(organizationId))
  ),
  checkScanBilling: Effect.fn("GeoDashboardEntitlement.checkScanBilling")(
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
  addActiveGeneration: Effect.fn("GeoDashboardGeneration.addActive")(
    (organizationId, generation) =>
      Effect.tryPromise({
        try: () => addActiveGeneration(organizationId, generation),
        catch: (cause) => new GeoGenerationTrackingError({ cause }),
      })
  ),
  generateRunId: Effect.fn("GeoDashboardGeneration.generateRunId")(
    (triggerId) => Effect.sync(() => generateRunId(triggerId))
  ),
});

export const geoCoreDashboardLayer = Layer.mergeAll(
  agentReadinessNetworkLayer,
  geoModelLayer,
  geoSearchConsoleLive,
  workflowLayer,
  billingLayer,
  entitlementLayer,
  geoCodingAgentAccessLayer,
  generationLayer
);
