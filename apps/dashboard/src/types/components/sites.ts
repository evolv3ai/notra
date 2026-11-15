import type { AlertCircleIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type {
  SiteBuildLogEntry,
  SiteBuildLogFold,
  SiteBuildLogLine,
} from "@notra/sites-core/types/build-log";
import type { ReactElement, ReactNode } from "react";

import type {
  InthConsent,
  InthConsentStatus,
  InthOAuthErrorCode,
} from "@/types/site-consent";
import type {
  SiteIntegrationProvider,
  SiteIntegrationAutosaveState,
} from "@/types/site-integrations";
import type { SiteWorkspaceValue } from "@/types/site-workspace";
import type {
  RepositorySuggestionsResult,
  SiteBuildAgentPromptInput,
  SiteBulkRow,
  SiteBulkRowEdit,
  SiteBulkSlugIssue,
  SiteCreateFieldErrors,
  SiteCreateFormValues,
  SiteCreateSectionPlan,
  SiteCreateStepId,
  SiteDeployment,
  SiteDiagnostic,
  SiteDeploymentRecord,
  SiteDeploymentStatus,
  SiteDetail,
  SiteDomain,
  SiteDomainChipStatus,
  SiteDomainRecord,
  SiteImportableRepository,
  SiteEditorDraft,
  SiteListItem,
  SiteMounts,
  SitePreviewRow,
  SitePreviewVisibility,
  SiteRecord,
  SiteRepository,
  SiteScope,
  SiteSection,
} from "@/types/sites";

export interface SitesPageShellProps {
  children: ReactNode;
  className?: string;
}

export interface SitesEmptyStateProps {
  /** `null` once the plan's site limit is reached. */
  newSiteHref: string | null;
}

export interface ProjectSitesListProps {
  organizationId: string;
  organizationSlug: string;
  projectId: string;
  showAll: boolean;
}

export interface SiteCreateProjectProps {
  organizationId: string;
}

export interface SiteHeaderProps {
  slug: string;
  organizationId: string;
  site: SiteRecord;
}

export interface SiteSwitcherProps extends SiteHeaderProps {
  /** Page to open on the picked site. */
  section: SiteSection;
}

export interface SiteLoadErrorProps {
  organizationSlug: string;
  error: unknown;
}

export interface SiteDeploymentTimelineProps {
  deployment: SiteDeploymentRecord;
  log: string | null;
}

export interface SiteLayoutProps {
  organizationSlug: string;
  siteId: string;
  children: ReactNode;
}

export interface SiteUpgradeDialogProps {
  organizationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SitesListProps {
  organizationId: string;
  organizationSlug: string;
  sites: SiteListItem[];
}

export interface SiteListCardProps {
  organizationId: string;
  organizationSlug: string;
  site: SiteListItem;
}

export type SiteVisitorsSummaryProps = Pick<
  SiteListCardProps,
  "organizationId" | "site"
>;

export interface SiteListMenuItemsProps extends Pick<
  SiteListCardProps,
  "organizationSlug" | "site"
> {
  onDelete: () => void;
  onRedeploy: () => void;
  redeployPending: boolean;
  variant: "context" | "dropdown";
}

export interface SiteCreateFormProps {
  organizationId: string;
  organizationSlug: string;
  hostingDomain: string | null;
}

export interface SiteCreateSourceFieldsProps {
  idPrefix: string;
  organizationId: string;
  hostingDomain: string | null;
  form: SiteCreateFormValues;
  onChange: <K extends keyof SiteCreateFormValues>(
    key: K,
    value: SiteCreateFormValues[K]
  ) => void;
  repository: SiteRepository | null;
  slugInvalid: boolean;
  errors: SiteCreateFieldErrors;
  starterPullRequestUrl: string | null;
  onStarterRequestStart: () => (url: string) => void;
  suggestions: RepositorySuggestionsResult;
  sections: SiteCreateSectionPlan;
}

export interface SiteCreateBulkToggleProps {
  id: string;
  count: number;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export interface SiteCreateBulkFieldsProps {
  idPrefix: string;
  hostingDomain: string | null;
  branch: string;
  onBranchChange: (value: string) => void;
  branchLocked: boolean;
  repository: SiteRepository | null;
  suggestions: RepositorySuggestionsResult;
  rows: SiteBulkRow[];
  issues: Record<string, SiteBulkSlugIssue>;
  onRowChange: (rootDirectory: string, edit: SiteBulkRowEdit) => void;
  onSelectAll: (selected: boolean) => void;
  previewsEnabled: boolean;
  onPreviewsChange: (enabled: boolean) => void;
  /** Locks every control while a bulk import is running. */
  disabled: boolean;
}

export interface SiteCreateBulkResultsProps {
  organizationSlug: string;
  rows: SiteBulkRow[];
  isRetrying: boolean;
  onRetry: () => void;
  onEdit: () => void;
}

export interface SiteCreateSectionFieldsProps {
  idPrefix: string;
  plan: SiteCreateSectionPlan;
  onBlogPathChange: (value: string) => void;
  onChangelogPathChange: (value: string) => void;
  error?: string;
}

export interface SiteAddressInputProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  invalid: boolean;
  placeholder: string;
  hostingDomain: string | null;
  describedBy?: string;
  disabled?: boolean;
  onBlur?: () => void;
}

export interface SiteDeleteDialogProps extends SiteScope {
  organizationSlug: string;
  siteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SiteMetaProps {
  icon: IconSvgElement;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}

export interface SiteRelativeTimeProps {
  date: Date | string;
  className?: string;
  inline?: boolean;
}

export interface SiteStatusBadgeProps {
  status: SiteDeploymentStatus;
  duration?: string | null;
  className?: string;
}

export interface SitePreviewFrameProps {
  url: string | null;
  className?: string;
  fallback?: ReactNode;
}

export interface SiteOverviewInfoRowProps {
  icon: IconSvgElement;
  label: string;
  children: ReactNode;
}

export interface SiteOverviewExternalLinkProps {
  href: string;
  children: ReactNode;
  muted?: boolean;
}

export interface SiteProductionBuildProps {
  deployment: SiteDeployment;
}

export interface SiteOverviewStatusProps {
  /** The newest unpublished production build, else the live one. */
  deployment: SiteDeployment | null;
  suspended: boolean;
}

export interface SiteOverviewPreviewProps {
  url: string | null;
  suspended: boolean;
  firstBuild: boolean;
  live: boolean;
}

export interface SiteOverviewDomainsProps {
  domains: SiteDomain[];
  aliasUrl: string;
}

export interface SiteViewAllLinkProps {
  href: string;
  label: string;
}

export interface SiteUpdatedLineProps {
  deployment: SiteDeployment | null;
}

export interface SiteBuildLogHighlightProps {
  text: string;
  query: string;
  /** `[start, end)` range rendered in the muted tag color. */
  muted?: readonly [start: number, end: number];
}

export interface SiteBuildLogPlainProps {
  text: string;
  /** Where `text` starts within the full line, to place the muted range. */
  offset: number;
  muted?: readonly [start: number, end: number];
}

export interface SiteBuildLogLineTextProps {
  line: SiteBuildLogLine;
  query: string;
}

export interface SiteBuildLogLineProps {
  line: SiteBuildLogLine;
  offset: string | undefined;
  query: string;
}

export interface SiteBuildLogFoldRowProps {
  entry: SiteBuildLogFold;
  offsets: Map<number, string>;
}

export interface SiteBuildLogRowsProps {
  entries: SiteBuildLogEntry[];
  matchingLines: SiteBuildLogLine[];
  matchOffsets: Map<number, string>;
  offsets: Map<number, string>;
  query: string;
}

export interface SiteBuildLogFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export interface SiteBuildLogEmptyProps {
  inProgress: boolean;
  queued: boolean;
  showSpinner?: boolean;
}

export interface SiteBuildLogCopyButtonProps {
  log: string | null;
}

export interface SiteBuildLogsProps {
  log: string | null;
  heading?: ReactNode;
  /** Overrides "Build logs" when the log shows something other than a build. */
  title?: string;
  inProgress: boolean;
  queued: boolean;
  startAtEnd?: boolean;
}

export interface SiteDeploymentMenuProps {
  deployment: Pick<
    SiteDeploymentRecord,
    "id" | "kind" | "live" | "status" | "url" | "commitSha"
  >;
  canRollback: boolean;
  canPromote: boolean;
  canUndoRollback: boolean;
  canRedeploy: boolean;
  detailHref?: string;
  redeployPending: boolean;
  onRedeploy: () => void;
  onRollback: () => void;
  onPromote: () => void;
  preview?: SitePreviewRow;
  onOpenPreview?: () => void;
  onCopyShareLink?: () => void;
  onDeletePreview?: () => void;
}

export interface SiteDeploymentsTableProps {
  organizationId: string;
  organizationSlug: string;
  siteId: string;
  deployments: SiteDeployment[];
  /** Unfiltered list; decides which deployment is live by default. */
  allDeployments?: SiteDeployment[];
  emptyState?: ReactNode;
  withActions?: boolean;
  highlightNewRows?: boolean;
  emptyHeight?: number;
  pageSize: number;
  previewRows?: SitePreviewRow[];
}

export type SiteDeploymentProductionActionsProps = Pick<
  SiteDeploymentMenuProps,
  "canRollback" | "canPromote" | "canUndoRollback" | "onRollback" | "onPromote"
>;

export interface SiteDeploymentDetailPageProps {
  deploymentId: string;
}

export interface SiteDeploymentDetailProps extends SiteScope {
  detail: SiteDetail;
  deployment: SiteDeploymentRecord;
  log: string | null;
}

export interface SiteDeploymentActionsProps extends SiteScope {
  deployment: SiteDeploymentRecord;
  live: boolean;
  primaryUrl: string;
  onRollback: () => void;
}

export interface SiteEnvironmentBadgeProps {
  kind: SiteDeployment["kind"];
  previewKey: string | null;
  className?: string;
}

export interface SiteDeploymentSummaryProps {
  detail: SiteDetail;
  deployment: SiteDeploymentRecord;
  live: boolean;
  urls: string[];
  primaryUrl: string;
}

export interface SiteDeploymentFactProps {
  label: string;
  children: ReactNode;
}

export interface SiteDeploymentExternalLinkProps {
  href: string | null;
  children: ReactNode;
  mono?: boolean;
}

export interface SiteDeploymentRecordProps {
  deployment: SiteDeploymentRecord;
}

export interface SiteDiagnosticItemProps {
  diagnostic: SiteDiagnostic;
  failed: boolean;
}

export interface SiteFailureChipProps {
  failed: boolean;
}

export interface SiteFailureBodyProps {
  errorMessage: string | null;
  diagnostics: Array<{ diagnostic: SiteDiagnostic; key: string }>;
  failed: boolean;
}

export interface SiteDeploymentFailureProps extends SiteDeploymentRecordProps {
  site: SiteBuildAgentPromptInput["site"];
  log: string | null;
}

export interface SiteRollbackDialogProps extends SiteScope {
  deployment: SiteDeployment | null;
  onOpenChange: (open: boolean) => void;
}

export interface SitePromoteDialogProps extends SiteScope {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SitePreviewsTableProps extends SiteScope {
  organizationSlug: string;
  rows: SitePreviewRow[];
  repository: SiteRecord["repository"];
  compact?: boolean;
  emptyState?: ReactNode;
}

export interface SitePreviewRowMenuProps {
  row: SitePreviewRow;
  onCopyShareLink: () => void;
  onViewDeployment: () => void;
  onDelete: () => void;
}

export interface SitePreviewDeleteDialogProps extends SiteScope {
  preview: SitePreviewRow | null;
  onOpenChange: (open: boolean) => void;
}

export interface SiteOpenPreviewButtonProps {
  label: string;
  tooltip: string;
  disabled: boolean;
  onOpen: () => void;
}

export interface SitePreviewBranchDialogProps extends SiteScope {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SiteSettingsDangerZoneProps extends SiteScope {
  organizationSlug: string;
  site: SiteRecord;
}

export interface SitePublishDialogProps extends SiteScope {
  conflicts?: readonly string[];
  onRebase?: () => void;
  rebasePending?: boolean;
  branchControls?: import("@/types/site-branches").SiteBranchControlsProps;
  unsaved?: boolean;
  /** Pending autosave; Publish flushes it first. */
  saving?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftCount: number;
  drafts: SiteEditorDraft[];
  sourcePaths: ReadonlySet<string>;
  onPublished: () => void;
  onConflict: (paths: string[]) => void;
}

export interface SiteProxySetupProps {
  hostname: string;
  aliasOrigin: string;
  mounts: SiteMounts;
}

export interface SiteDnsSetupProps extends SiteScope {
  domain: SiteDomain;
}

export interface SiteDnsRecordValueProps {
  value: string;
  label: string;
}

export interface SiteDnsRecordsTableProps {
  records: SiteDomainRecord[];
}

export interface SiteDnsProviderButtonProps {
  providerName: string;
  href: string;
  oneClick?: boolean;
}

export interface SiteDomainCardProps extends SiteScope {
  domain: SiteDomain;
  aliasOrigin: string;
  mounts: SiteMounts;
  onRemove: (domain: SiteDomain) => void;
}

export interface SiteDomainStatusBadgeProps {
  status: SiteDomainChipStatus;
}

export interface SiteDomainCheckButtonProps {
  scope: SiteScope;
  domain: Pick<SiteDomain, "id" | "hostname">;
  variant?: "ghost" | "outline";
}

export interface SiteDomainMenuProps {
  hostname: string;
  url: string;
  canOpen: boolean;
  onRemove: () => void;
}

export interface SiteDomainAddFormProps extends SiteScope {
  mounts: SiteMounts;
  autoFocus?: boolean;
  onAdded?: () => void;
  renderActions: (state: { canSubmit: boolean; pending: boolean }) => ReactNode;
}

export interface SiteDomainAddDialogProps extends SiteScope {
  mounts: SiteMounts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SiteDomainRemoveDialogProps extends SiteScope {
  domain: SiteDomain | null;
  aliasOrigin: string;
  onOpenChange: (open: boolean) => void;
}

export interface SiteSuggestInputProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  suggestions: string[];
  icon: IconSvgElement;
  placeholder?: string;
  emptyLabel: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

type SiteIntegrationBrand = Pick<
  SiteIntegrationProvider,
  "logo" | "name" | "recommended"
> & { fill?: boolean };

export interface SiteIntegrationLogoProps {
  provider: SiteIntegrationBrand;
  className?: string;
}

export interface SiteIntegrationRowProps {
  provider: SiteIntegrationBrand;
  description: string;
  /** Visible label of the set-up button; defaults to "Add". */
  addLabel?: string;
  /** Accessible name of the set-up button; defaults to "Add {provider}". */
  addAriaLabel?: string;
  isSetUp: boolean;
  loading?: boolean;
  disabled: boolean;
  onOpen: () => void;
  onRemove?: () => void;
}

export interface SiteConsentSectionProps {
  branch?: string;
  isSetUp: boolean;
  loading: boolean;
  disabled: boolean;
}

export interface SiteIntegrationDialogProps {
  scope: SiteScope;
  provider: SiteIntegrationProvider;
  settings: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SiteIntegrationSaveStatusProps {
  state: SiteIntegrationAutosaveState;
  invalid: boolean;
  busy: boolean;
  removalFailed: boolean;
  onRetry: () => void;
}

export interface SiteImportListProps {
  organizationId: string;
  organizationSlug: string;
  repositories: SiteImportableRepository[];
  installed: boolean;
  isLoading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  importingId: string | null;
  onImport: (repository: SiteImportableRepository) => void;
  callbackPath?: string;
  actionLabel?: string;
  actionAriaLabel?: (repository: string) => string;
  currentRepository?: { owner: string; name: string } | null;
}

export type SiteCreateStepState = "active" | "done" | "locked";

export interface SiteCreateStepProps {
  title: string;
  description?: string;
  state: SiteCreateStepState;
  footer?: ReactNode;
  onActivate?: () => void;
  children: ReactNode;
}

export interface SiteCreateStepListProps<Id extends string = SiteCreateStepId> {
  steps: { id: Id; label: string; state: SiteCreateStepState }[];
  onSelect: (id: Id) => void;
}

export interface SiteCreateScrollListProps {
  children: ReactNode;
}

export interface SiteCreateStageProps {
  activeIndex: number;
  left: ReactNode;
  right: ReactNode;
  children: ReactNode;
}

export type SiteCreateDeployPhase =
  | "pending"
  | "ready"
  | "failed"
  | "lookupFailed";

export interface SiteCreateDeployHeadingProps {
  headline: string;
  tone: "pending" | "success" | "error";
}

export interface SiteCreateDeployActionsProps {
  phase: SiteCreateDeployPhase;
  settingsHref: string;
  overviewHref: string;
  liveUrl: string;
  isReloadingStatus: boolean;
  onReloadStatus: () => void;
  isRetrying: boolean;
  onRetry: () => void;
}

export interface SiteCreateDeployProps {
  organizationId: string;
  organizationSlug: string;
  site: Pick<
    SiteRecord,
    | "id"
    | "projectId"
    | "name"
    | "liveUrl"
    | "repository"
    | "productionBranch"
    | "rootDirectory"
  >;
  deploymentQueued: boolean;
}

export interface SiteCreateStarterProps {
  organizationId: string;
  repositoryId: string;
  branch: string;
  rootDirectory: string;
  pullRequestUrl: string | null;
  onRequestStart: () => (url: string) => void;
  configDirectories: string[];
  suggestionsReady: boolean;
  suggestionsComplete: boolean;
  onRootDirectoryChange: (value: string) => void;
}

export interface SiteRootDirectoryToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export interface SitesLiveProviderProps {
  organizationSlug: string;
  children: ReactNode;
}

export interface SiteConfigExampleProps {
  value: string;
}

export interface SiteInthDialogProps {
  branch?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSetUp: boolean;
  oauthError: InthOAuthErrorCode | null;
}

export interface SiteInthManagedPanelProps {
  inth: InthConsent;
  authorizeHref: string;
}

export interface SiteInthProjectSettingsProps {
  inth: InthConsent;
  status: InthConsentStatus;
}

export interface SiteChangesStripProps {
  tone: "info" | "warning" | "destructive";
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
}
export interface SiteChangeItem {
  key: string;
  label: string;
  /** Where the change was made; without one, the item opens the publish review. */
  href?: string;
  title?: string;
}

export interface SiteUnpublishedTitle {
  key: "unpublishedTitle" | "unpublishedFilesTitle" | "unpublishedMixedTitle";
  count: number;
}

export interface SiteChangeListProps {
  items: readonly SiteChangeItem[];
  /** Changes beyond `items`, summed up as "N more". */
  more: number;
  onReview: () => void;
}

export interface SiteChangesStripStateProps {
  state: SiteWorkspaceValue;
}

export interface SiteDiscardChangesButtonProps {
  state: SiteWorkspaceValue;
  variant?: "secondary" | "ghost";
}

export interface SiteHeaderMenuProps {
  branch: string;
  /** Hides the Branches toggle where the selector cannot be turned off. */
  branchesRequired: boolean;
}

export interface SiteWorkspaceErrorStateProps {
  icon: typeof AlertCircleIcon;
  title: string;
  description: string;
  children: ReactNode;
}
