import type {
  GeoAudienceType,
  GeoBrandSearchResult,
  GeoCompetitor,
  GeoCompetitorSuggestionsResponse,
  GeoDiscoveredPrompt,
  GeoOnboardingStage,
  GeoWebsiteDiscovery,
} from "@notra/geo-core/types/geo";
import type { onboardingWorkspaceSchema } from "@notra/schemas/dashboard/onboarding/workspace";
import type { OnboardingHeardAboutNotraSource } from "@notra/schemas/types/dashboard/onboarding";
import type { UseQueryResult } from "@tanstack/react-query";
import type * as z from "zod";

import type { OnboardingStep } from "@/types/analytics/events";

type OnboardingWorkspaceInput = z.infer<typeof onboardingWorkspaceSchema>;

/** Response of `onboarding.companyLogo`, also the cached representation. */
export interface CompanyLogoResult {
  domain: string | null;
  url: string | null;
}

export type OnboardingProgressHrefs = readonly (string | null)[];

export interface OnboardingExistingOrg {
  heardAboutNotraOther: string | null;
  heardAboutNotraSource: string | null;
  id: string;
  logo: string | null;
  slug: string;
  name: string;
  dailySummary: boolean;
  marketingEmails: boolean;
  /** A brand exists, so the GEO onboarding steps can run without a new website. */
  hasBrand?: boolean;
  /** Website the existing brand was analyzed from. */
  websiteUrl?: string | null;
}

export interface WorkspaceFormProps {
  existingOrg?: OnboardingExistingOrg;
  progressHrefs?: OnboardingProgressHrefs;
}

export interface WorkspaceSlugCheck {
  slug: string;
  status: "checking" | "available" | "unavailable" | "error";
}

export interface WebsiteDiscoveryStatusProps {
  host: string;
  isReading: boolean;
  failed: boolean;
  onRetry: (websiteUrl: string) => void;
}

export interface PrefixedInputFieldProps {
  id: string;
  label: string;
  prefix: string;
  error: string | null;
  preview?: OnboardingPreviewFocus;
  inputClassName?: string;
  inputProps: Omit<
    React.ComponentProps<"input">,
    "id" | "className" | "type" | "aria-describedby" | "aria-invalid"
  >;
  children?: React.ReactNode;
}

export interface SlugStatusIndicatorProps {
  status: WorkspaceSlugCheck["status"] | null;
}

export interface HeardAboutNotraFieldProps {
  source: string;
  other: string;
  sourceError: string | null;
  otherError: string | null;
  disabled: boolean;
  onSourceChange: (value: OnboardingHeardAboutNotraSource) => void;
  onOtherChange: (value: string) => void;
  onOtherBlur: () => void;
}

interface OnboardingSplitLayoutProps {
  children: React.ReactNode;
}

export interface SkipOnboardingFormProps {
  slug: string;
  step: OnboardingStep;
}

export interface OnboardingStepLayoutProps extends OnboardingSplitLayoutProps {
  step: OnboardingStep;
}

export interface OnboardingProgressProps {
  current: number;
  hrefs?: OnboardingProgressHrefs;
}

export interface OnboardingProgressHrefInput {
  current: number;
  hasOrganization: boolean;
  hasBrand: boolean;
  stage: GeoOnboardingStage | null;
  projectId?: string;
  replay?: boolean;
}

export interface VisibilityFormProps {
  organizationId: string;
  projectId?: string;
  websiteUrl: string;
  companyName: string | null;
  /** Saved languages, or the browser's Accept-Language for a new project. */
  initialLanguages: string[];
  /** Saved prompt language; it stays first and cannot be removed. */
  lockedLanguage: string | null;
  nextHref: string;
  skipHref: string;
  inOnboardingFlow: boolean;
  progressHrefs?: OnboardingProgressHrefs;
}

export interface VisibilityReviewProps {
  organizationId: string;
  websiteUrl: string;
  discovery: GeoWebsiteDiscovery | null;
  fallbackCompanyName: string;
  /** Tracked languages; the first one is the language prompts are written in. */
  languages: readonly string[];
  nextHref: string;
  skipHref: string;
  previewFocus: OnboardingPreviewFocus | null;
  previewWebsite: string;
}

export interface CompetitorsFormProps {
  organizationId: string;
  projectId?: string;
  domain: string | null;
  companyName: string;
  nextHref: string;
  inOnboardingFlow: boolean;
  progressHrefs?: OnboardingProgressHrefs;
}

export interface CompetitorBrandLogoProps {
  name: string;
  domain: string | null;
  logo: string | null;
  className?: string;
}

export interface CompetitorChoiceRowProps {
  name: string;
  domain: string | null;
  description?: string | null;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export interface SelectedCompetitorsProps {
  competitors: readonly GeoCompetitor[];
  disabled: boolean;
  onRemove: (competitor: GeoCompetitor) => void;
}

export interface CompetitorSuggestionsProps {
  domain: string;
  suggestions: UseQueryResult<GeoCompetitorSuggestionsResponse>;
  competitors: readonly GeoCompetitor[];
  remainingCount: number;
  busy: boolean;
  atLimit: boolean;
  onAdd: (name: string, domain: string | null) => void;
  onRemove: (competitor: GeoCompetitor) => void;
  onAddAll: () => void;
}

export interface PromptChoiceRowProps {
  prompt: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export type CompetitorsPickerProps = Omit<
  CompetitorsFormProps,
  "projectId" | "inOnboardingFlow"
>;

export interface CompetitorSearchProps {
  organizationId: string;
  ownDomain: string | null;
  selected: readonly GeoCompetitor[];
  disabled: boolean;
  onAdd: (result: CompetitorSearchResult) => void;
}

export interface CompetitorSearchResult extends Omit<
  GeoBrandSearchResult,
  "domain"
> {
  domain: string | null;
  source: "manual" | "search";
}

export interface CompetitorSearchItemsInput {
  ownDomain: string | null;
  query: string;
  searchResults: readonly GeoBrandSearchResult[];
  searching: boolean;
  selected: readonly GeoCompetitor[];
}

export interface UseCompetitorSearchStateInput {
  organizationId: string;
  ownDomain: string | null;
  selected: readonly GeoCompetitor[];
}

export interface CompetitorSearchContentProps {
  items: readonly CompetitorSearchResult[];
  onRetry: () => void;
  searchError: boolean;
  searchFetching: boolean;
  searching: boolean;
}

export interface SearchRetryNoticeProps {
  onRetry: () => void;
  searchFetching: boolean;
}

export interface CompetitorSearchResultRowProps {
  entry: CompetitorSearchResult;
  searchUnavailable: boolean;
}

export interface VisibilityBrandDraft {
  companyName: string;
  aliases: readonly string[];
  audienceType?: GeoAudienceType;
  prompts: readonly GeoDiscoveredPrompt[];
  languages: readonly string[];
}

export interface OrgLogoFieldProps {
  disabled?: boolean;
  isLoading?: boolean;
  onSelect: (file: File) => void;
  previewUrl: string | null;
}

interface OnboardingWorkspaceFormValues {
  heardAboutNotraOther: string;
  heardAboutNotraSource: string;
  name: string;
  slug: string;
  websiteUrl: string;
  dailySummary: boolean;
  marketingEmails: boolean;
}

export interface SubmitWorkspaceFormArgs {
  existingOrg?: OnboardingExistingOrg;
  onOrganizationCreated?: (organization: OnboardingExistingOrg) => void;
  logoFile: File | null;
  logoSourceUrl: string | null;
  value: OnboardingWorkspaceFormValues;
}

export interface SubmitWorkspaceStepArgs extends SubmitWorkspaceFormArgs {
  setSubmitting: (submitting: boolean) => void;
  onError: (error: unknown) => void;
}

export type SaveOnboardingAttributionInput = Pick<
  OnboardingWorkspaceInput,
  "heardAboutNotraOther" | "heardAboutNotraSource"
> & {
  organizationId: string;
};

export type SaveOnboardingAttributionResult =
  | { success: true }
  | { success: false; error: string };

export type SaveOnboardingNotificationSettingsInput = {
  organizationId: string;
  dailySummary: boolean;
  marketingEmails: boolean;
};

export type SaveOnboardingNotificationSettingsResult =
  | { success: true }
  | { success: false; error: string };

export interface OnboardingEmailPrefsProps {
  dailySummary: boolean;
  marketingEmails: boolean;
  disabled: boolean;
  onDailySummaryChange: (checked: boolean) => void;
  onMarketingEmailsChange: (checked: boolean) => void;
}

export type LogoFileValidationError = "invalidType" | "tooLarge";

export type WorkspaceFormField =
  | "name"
  | "slug"
  | "websiteUrl"
  | "heardAboutNotraSource"
  | "heardAboutNotraOther";

export type OnboardingPreviewFocus =
  | "name"
  | "website"
  | "brand"
  | "prompts"
  | "competitors";

export interface OnboardingPreviewZoom {
  scale?: number;
  page?: OnboardingPreviewPage;
}

export interface OnboardingDashboardPreviewProps {
  focus: OnboardingPreviewFocus | null;
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  logoDomain?: string | null;
  logoName?: string;
  website?: string;
  prompts?: readonly string[];
  competitors?: readonly { id: string; name: string; domain: string | null }[];
  defaultPage?: OnboardingPreviewPage;
}

export type OnboardingPreviewPage = "overview" | "prompts" | "competitors";

export interface OnboardingPreviewOverviewPageProps {
  companyName: string;
}

export interface OnboardingPreviewPromptsPageProps {
  prompts: readonly string[];
}

export interface OnboardingPreviewCompetitorsPageProps {
  competitors: readonly { id: string; name: string; domain: string | null }[];
}

export interface OnboardingPreviewLens {
  transform: string;
  width: number;
  height: number;
}

export interface OnboardingPreviewLensState extends OnboardingPreviewLens {
  focus: OnboardingPreviewFocus | null;
  glide: boolean;
}

export interface UseOnboardingPreviewLensInput {
  viewport: HTMLDivElement | null;
  lensContent: HTMLDivElement | null;
  focus: OnboardingPreviewFocus | null;
  scale: number | undefined;
  page: OnboardingPreviewPage;
}

export interface OnboardingPreviewAddressBarProps {
  slug: string;
  page: OnboardingPreviewPage;
}

export interface OnboardingPreviewMainProps {
  page: OnboardingPreviewPage;
  companyName: string;
  prompts: readonly string[];
  competitors: readonly { id: string; name: string; domain: string | null }[];
}

export interface OnboardingPreviewNavProps {
  page: OnboardingPreviewPage;
}

export interface OnboardingPreviewSkeletonChipProps {
  className: string;
}

export type OnboardingConnectClient = "chatgpt" | "claude";

export interface ConnectStepProps {
  companyName: string;
  nextHref: string;
}

export interface OnboardingConnectPreviewProps {
  client: OnboardingConnectClient;
  companyName: string;
}
