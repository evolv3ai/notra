import { Context } from "effect";

import type { AgentReadinessNetworkShape } from "./types/agent-readiness";
import type {
  GeoContentBillingServiceShape,
  GeoEntitlementServiceShape,
  GeoCodingAgentAccessServiceShape,
  GeoGenerationServiceShape,
  GeoWorkflowServiceShape,
  GeoSearchConsoleServiceShape,
} from "./types/deps";
import type { GeoModelServiceShape } from "./types/model";

export class AgentReadinessNetwork extends Context.Service<
  AgentReadinessNetwork,
  AgentReadinessNetworkShape
>()("@notra/geo-core/AgentReadinessNetwork") {}

/** Paid model I/O. Host runtimes supply the live adapter; tests supply answers. */
export class GeoModelService extends Context.Service<
  GeoModelService,
  GeoModelServiceShape
>()("@notra/geo-core/GeoModelService") {}

export class GeoSearchConsoleService extends Context.Service<
  GeoSearchConsoleService,
  GeoSearchConsoleServiceShape
>()("@notra/geo-core/GeoSearchConsoleService") {}

/** Host-owned workflow starters used by GEO domain programs. */
export class GeoWorkflowService extends Context.Service<
  GeoWorkflowService,
  GeoWorkflowServiceShape
>()("@notra/geo-core/GeoWorkflowService") {}

/** Host-owned content billing gates and reservation settlement. */
export class GeoContentBillingService extends Context.Service<
  GeoContentBillingService,
  GeoContentBillingServiceShape
>()("@notra/geo-core/GeoContentBillingService") {}

/** Host-owned organization entitlement reads. */
export class GeoEntitlementService extends Context.Service<
  GeoEntitlementService,
  GeoEntitlementServiceShape
>()("@notra/geo-core/GeoEntitlementService") {}

export const GeoEngineCredentialsRequired = Context.Reference<boolean>(
  "@notra/geo-core/GeoEngineCredentialsRequired",
  { defaultValue: () => true }
);

export class GeoCodingAgentAccessService extends Context.Service<
  GeoCodingAgentAccessService,
  GeoCodingAgentAccessServiceShape
>()("@notra/geo-core/GeoCodingAgentAccessService") {}

/** Host-owned generation tracking and run-id generation. */
export class GeoGenerationService extends Context.Service<
  GeoGenerationService,
  GeoGenerationServiceShape
>()("@notra/geo-core/GeoGenerationService") {}
