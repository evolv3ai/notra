import type {
  GeoContentBillingService,
  GeoEntitlementService,
  GeoCodingAgentAccessService,
  GeoGenerationService,
  GeoWorkflowService,
  AgentReadinessNetwork,
  GeoModelService,
  GeoSearchConsoleService,
} from "@notra/geo-core/deps";

export type GeoDashboardRuntime =
  | AgentReadinessNetwork
  | GeoModelService
  | GeoSearchConsoleService
  | GeoContentBillingService
  | GeoEntitlementService
  | GeoCodingAgentAccessService
  | GeoGenerationService
  | GeoWorkflowService;
