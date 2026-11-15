import type { IconSvgElement } from "@hugeicons/react";
import type { SITE_DEPLOYMENT_STATUSES } from "@notra/sites-core/constants/sites";
import type { RepositoryContentCount } from "@notra/sites-server/types/github";
import type { SiteInputField } from "@notra/sites-server/types/sites";
import type { Badge } from "@notra/ui/components/ui/badge";
import type { InferRouterInputs, InferRouterOutputs } from "@orpc/server";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";

import type { SITE_CREATE_STEP_IDS } from "@/constants/site-create";
import type {
  POST_PREVIEW_LIFETIME_OPTIONS,
  SITE_DETAIL_TABS,
  SITE_DOMAIN_CONNECT_OUTCOMES,
  SITE_PROXY_RECIPES,
} from "@/constants/sites";
import type { DashboardRouter } from "@/lib/orpc/router";

type SitesOutputs = InferRouterOutputs<DashboardRouter>["sites"];
type SitesInputs = InferRouterInputs<DashboardRouter>["sites"];

export type SiteCreateInput = SitesInputs["create"];
export type SiteCreateManyInput = SitesInputs["createMany"];
export type SiteBulkResult = SitesOutputs["createMany"]["results"][number];

export type SiteListResult = SitesOutputs["list"];
export type SiteListItem = SiteListResult["sites"][number];
export type SiteDetail = SitesOutputs["get"];
export type SiteRecord = SiteDetail["site"];
export type SiteDeployment = SiteDetail["deployments"][number];
export type SiteDeploymentDetail = SitesOutputs["deployments"]["get"];
export type SiteDeploymentRecord = SiteDeploymentDetail["deployment"];
type SitePreview = SiteDetail["previews"][number];
export type SiteDomain = SiteDetail["domains"][number];
export type SiteRepository = SitesOutputs["connectRepository"];
export type SiteCreateStepId = (typeof SITE_CREATE_STEP_IDS)[number];
export type SiteImportableRepository =
  SitesOutputs["importableRepositories"]["repositories"][number];
export type SiteEditorFiles = SitesOutputs["editor"]["files"];
export type SiteEditorDraft = SiteEditorFiles["drafts"][number];
export type SiteEditorDocument = SitesOutputs["editor"]["read"];
export type SiteDiagnostic = SiteDeploymentRecord["diagnostics"][number];

export interface SiteBuildAgentPromptInput {
  site: Pick<
    SiteRecord,
    "name" | "repository" | "productionBranch" | "rootDirectory"
  >;
  deployment: Pick<
    SiteDeploymentRecord,
    "status" | "branch" | "commitSha" | "diagnostics" | "errorMessage"
  > | null;
  log: string | null;
}

export type SiteDeploymentStatus = (typeof SITE_DEPLOYMENT_STATUSES)[number];

export interface SiteStatusBadgeConfig {
  variant: NonNullable<ComponentProps<typeof Badge>["variant"]>;
  icon?: IconSvgElement;
  square?: boolean;
  spin?: boolean;
}
export type SiteSection = (typeof SITE_DETAIL_TABS)[number];

export interface SitesEmptyPoint {
  key: "write" | "deploy" | "domain";
  icon: IconSvgElement;
}

export interface SiteSectionConfig {
  section: SiteSection;
  path: string;
  icon: IconSvgElement;
}
export type SiteProxyRecipeId = (typeof SITE_PROXY_RECIPES)[number];
export type SitePreviewVisibility = SiteRecord["previewVisibility"];
export type SiteMounts = SiteRecord["mounts"];
export type SiteDomainKind = SiteDomain["kind"];

export interface SiteRepositoryRef {
  owner: string;
  name: string;
}

export interface SiteProxyRecipe {
  id: SiteProxyRecipeId;
  filename: string;
  code: string;
}

export interface SitesPageClientProps {
  organizationSlug: string;
  showAll?: boolean;
}

export interface SiteDomainConnectRouteContext {
  params: Promise<{ token: string }>;
}

export interface SiteScope {
  branch?: string;
  organizationId: string;
  siteId: string;
}

export interface SiteContextValue {
  organizationId: string;
  organizationSlug: string;
  siteId: string;
  detail: SiteDetail;
  liveDeployment: SiteDeployment | null;
}

export interface SitePreviewRow extends Omit<
  SitePreview,
  "visibility" | "activatedAt"
> {
  visibility: SitePreview["visibility"] | null;
  activatedAt: SitePreview["activatedAt"] | null;
  served: boolean;
  status: SiteDeploymentStatus;
  latestDeploymentId: string;
  updatedAt: Date | string;
}

export interface SiteSettingsForm {
  name: string;
  productionBranch: string;
  rootDirectory: string;
  blogEnabled: boolean;
  blogPath: string;
  changelogEnabled: boolean;
  changelogPath: string;
  previewCommentsEnabled: boolean;
  smartDeployments: boolean;
}

export type SiteSettingsSource = Pick<
  SiteRecord,
  | "name"
  | "productionBranch"
  | "rootDirectory"
  | "mounts"
  | "previewCommentsEnabled"
  | "smartDeployments"
>;

export interface SiteCreateFormValues {
  repositoryId: string | null;
  name: string;
  slug: string;
  branch: string;
  rootDirectory: string;
  blogPath: string | null;
  changelogPath: string | null;
  previewVisibility: SitePreviewVisibility;
}

export type SiteCreateFieldErrors = Partial<Record<SiteInputField, string>>;

export interface SiteCreateTarget {
  organizationId: string;
  repositoryId: string;
  projectId: string;
}

export interface SiteSettingsPatch {
  name?: string;
  repositoryId?: string;
  productionBranch?: string;
  rootDirectory?: string;
  mounts?: { blog?: string; changelog?: string };
  previewCommentsEnabled?: boolean;
  smartDeployments?: boolean;
  showBranding?: boolean;
  analyticsEnabled?: boolean;
}

export type SiteSettingsRowKey =
  | "repository"
  | "branch"
  | "rootDirectory"
  | "sections"
  | "variables";

export type SiteSettingsToggleField =
  | "previewCommentsEnabled"
  | "smartDeployments"
  | "showBranding";

export type SiteDomainRecord = SiteDomain["records"][number];
export type SiteDomainConnectOutcome =
  (typeof SITE_DOMAIN_CONNECT_OUTCOMES)[number];
export type SiteDomainChipStatus =
  | "active"
  | "dnsRequired"
  | "proxyRequired"
  | "verifying"
  | "failed";

export type SiteDeploymentKind = SiteDeployment["kind"];
export type SiteDeploymentTrigger = SiteDeployment["trigger"];
export type SiteDeploymentStatusFilter =
  | "ready"
  | "building"
  | "queued"
  | "failed"
  | "canceled"
  | "superseded"
  | "skipped"
  | "expired";

export type SiteDeploymentEnvironmentFilter = SiteDeploymentKind | "all";

export interface SiteDeploymentFilters {
  environment: SiteDeploymentEnvironmentFilter;
  status: SiteDeploymentStatusFilter | "all";
}

export interface SiteCreateSectionPlan {
  blogPath: string;
  changelogPath: string;
  counts: RepositoryContentCount | null;
}

/** What the user changed on one row of a bulk import; the rest is derived. */
export interface SiteBulkRowEdit {
  name?: string;
  slug?: string;
  selected?: boolean;
}

/** One folder with a blog.json, as a site the bulk import would create. */
export interface SiteBulkRow {
  rootDirectory: string;
  name: string;
  slug: string;
  selected: boolean;
  sections: SiteCreateSectionPlan;
  /** Outcome of the last attempt, or null when it was never submitted. */
  result: SiteBulkResult | null;
}

export interface SiteBulkSubmitOptions {
  branch: string;
  previewsEnabled: boolean;
}

export type SiteBulkSlugIssue = "invalid" | "reserved" | "duplicate";

export interface SiteBulkRowsInput {
  directories: string[];
  contentCounts: Record<string, RepositoryContentCount> | undefined;
  repositoryName: string;
  edits: Record<string, SiteBulkRowEdit>;
  results: Record<string, SiteBulkResult>;
}

export interface SiteBulkImportScope {
  repository: SiteRepository | null;
  branch: string;
  suggestions: RepositorySuggestionsResult;
}

/** The folders of the last complete repository scan for one branch. */
export interface SiteBulkScan {
  scope: string;
  directories: string[];
  contentCounts: Record<string, RepositoryContentCount> | undefined;
}

export interface RepositorySuggestionsResult {
  branches: string[];
  defaultBranch: string | null;
  configDirectories: string[];
  contentCounts: Record<string, RepositoryContentCount> | undefined;
  isLoading: boolean;
  isReady: boolean;
  isComplete: boolean;
}

export type RepositorySuggestionsScope =
  | { organizationId: string; repositoryId: string | null; branch: string }
  | { organizationId: string; siteId: string; branch: string };

export interface SiteStarterInput {
  organizationId: string;
  repositoryId: string;
  branch: string;
  rootDirectory: string;
}

export type PostPreviewLifetime =
  (typeof POST_PREVIEW_LIFETIME_OPTIONS)[number];

export type PostPreviewState =
  | "none"
  | "building"
  | "live"
  | "expired"
  | "failed";

export type SiteValidationQuery = Pick<
  UseQueryResult<{ ok: boolean }>,
  "data" | "isPlaceholderData" | "isSuccess"
>;

export type SiteValidationReviewQuery = Pick<
  UseQueryResult<{ ok: boolean }>,
  "data" | "isError"
>;
