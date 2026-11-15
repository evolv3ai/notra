import type {
  GeoProspectChannel,
  GeoProspectClaimStatus,
  GeoProspectPromptIntent,
  GeoProspectReportJson,
  GeoProspectReportStatus,
  GeoProspectSentiment,
} from "@notra/db/types/geo-prospect-report";

export type GeoPromptIntent = GeoProspectPromptIntent;
export type GeoSentiment = GeoProspectSentiment;
export type GeoClaimStatus = GeoProspectClaimStatus;
export type GeoChannel = GeoProspectChannel;
export type GeoReportStatus = GeoProspectReportStatus;
export type GeoReport = GeoProspectReportJson;

export type GeoReportSectionId =
  | "cover"
  | "summary"
  | "prompts"
  | "competitors"
  | "perceptions"
  | "shelf-space"
  | "sources"
  | "plan";

export interface GeoModel {
  id: string;
  gatewayModelId: string;
  name: string;
  provider: string;
  providerDomain: string;
  surface: string;
}

type GeoCompany = GeoReport["company"];
export type GeoTrackedPrompt = GeoReport["prompts"][number];
export type GeoCompetitor = GeoReport["competitors"][number];
export type GeoClaim = GeoReport["perceptions"][number]["claims"][number];
export type GeoModelPerception = GeoReport["perceptions"][number];
export type GeoShelfSpaceOpportunity = GeoReport["opportunities"][number];
export type GeoCitedSource = GeoReport["sources"][number];

export interface GeoReportSection {
  id: GeoReportSectionId;
  label: string;
  description: string;
}

export type GeoReportSectionState = Record<GeoReportSectionId, boolean>;

interface GeoReportRenderOptions {
  sections: GeoReportSectionState;
  models: GeoModel[];
}

export interface GeoReportListItem {
  id: string;
  company: GeoCompany;
  status: GeoReportStatus;
  modelsTested: number;
  promptsTracked: number;
  visibilityScore: number | null;
  updatedAt: string;
  kind: "example" | "saved";
  shareToken: string | null;
}

/** What the save action hands back: the persisted id and the public link token. */
export interface GeoSavedReport {
  id: string;
  shareToken: string;
}

export type GeoSaveState = "saved" | "saving" | "unsaved" | "error";

export interface DeleteReportDialogProps {
  slug: string;
  reportId: string;
  companyName: string;
  onDeleted: () => void;
  size?: "sm" | "icon-sm";
}

interface GeoCompetitorSuggestion {
  name: string;
  domain: string;
  description: string;
  confidence: "high" | "medium";
}

export interface BrandLogoProps {
  domain: string;
  name: string;
  className?: string;
  size?: number;
}

export interface GeoReportDocumentProps {
  report: GeoReport;
  options: GeoReportRenderOptions;
}

export interface GeoReportSectionProps {
  id: GeoReportSectionId;
  title: string;
  lede: string;
  children: React.ReactNode;
}

export interface GeoReportsClientProps {
  reports: GeoReportListItem[];
  slug: string;
}

export interface CoverDitherProps {
  color: string;
  className?: string;
}

export interface GeoCompetitorRow {
  id: string;
  domain: string;
  name: string;
  note: string;
  fraction: number;
  tone: "brand" | "ahead" | "behind" | "tied";
}

export interface CompetitorRowsProps {
  report: GeoReport;
  models: GeoModel[];
}

export interface GeoReportEditorProps {
  slug: string;
  initialReport: GeoReport;
  /** `null` until the first save creates the row. */
  reportId: string | null;
  shareToken: string | null;
}

export type GeoReportUpdater = (
  recipe: (report: GeoReport) => GeoReport
) => void;

export interface GeoEditorSectionProps {
  report: GeoReport;
  update: GeoReportUpdater;
}

export interface GeoScanSource {
  url: string;
  title: string;
}

export interface GeoScanResult {
  modelId: string;
  rank: number | null;
  intent: GeoPromptIntent;
  mentioned: string[];
  sentiment: GeoSentiment;
  quote: string;
  claims: GeoClaim[];
  sources: GeoScanSource[];
  answer: string;
}

export interface GeoCompanyLookup {
  name: string;
  category: string;
  summary: string;
  siteText: string;
  competitors: GeoCompetitorSuggestion[];
}

export interface GeoGeneratedPrompt {
  text: string;
  intent: GeoPromptIntent;
}

export interface GeoRecommendation {
  id: string;
  action: string;
  channel: GeoChannel;
}

export interface GeoScanProgress {
  total: number;
  done: number;
  current: string;
  failed: number;
}

export interface PromptGridProps {
  report: GeoReport;
  models: GeoModel[];
}
