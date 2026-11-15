import type { GeoModelCatalogEntry } from "@notra/geo-core/types/geo";
import type {
  GeoScanResultSummary,
  GeoScanRunSummary,
} from "@notra/geo-core/types/geo-scan-history";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { useTranslations } from "use-intl";

import type { useGeoScanRun } from "@/lib/hooks/use-geo-scan-history";

export interface GeoScanActivityStatusProps {
  run: GeoScanRunSummary;
  /** A newer scan was triggered but has not written its row yet. */
  starting: boolean;
}

export interface GeoScanRequest {
  engines: string[];
  prompt?: { id: string; prompt: string };
}

export interface GeoScanControls {
  prepare: (request: GeoScanRequest) => void;
}

export interface GeoScanControlsProviderProps {
  organizationId: string;
  promptCount?: number;
  children: ReactNode;
}

export interface GeoScanModelOption {
  id: string;
  label: string;
  tracked: boolean;
  zdrBlocked: boolean;
}

export interface GeoScanModelMenuProps {
  disabledReason?: string;
  /** Tracked models, preselected every time the menu opens. */
  engines: readonly string[];
  /** Full catalog the organization can scan; falls back to `engines`. */
  catalog?: readonly GeoModelCatalogEntry[];
  enforceZdr?: boolean;
  nonZdrApprovedEngines?: readonly string[];
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  primary?: boolean;
  /** Controlled open state, e.g. for a hotkey. Uncontrolled when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onContinue: (engines: string[]) => void;
}

export interface GeoScanRunDetailProps {
  organizationId: string;
}

export interface GeoScanRunDetailState {
  /** Scan the pages and filters below belong to. */
  runId: string | null;
  view: GeoScanRunView;
  offset: number;
  pendingOffset: number;
  engine: string;
}

export interface GeoScanOpenAnswer {
  checkId: string;
  scanId: string;
  language: string;
}

export interface GeoScanRunEmptyProps {
  isError: boolean;
  onRetry: () => void;
}

export interface GeoScanRunLoadedProps {
  organizationId: string;
  run: GeoScanRunSummary;
  query: ReturnType<typeof useGeoScanRun>;
  state: GeoScanRunDetailState;
  /** A scan is in flight per the settings; this run may be the older one. */
  starting: boolean;
  onStateChange: Dispatch<SetStateAction<GeoScanRunDetailState>>;
}

export interface GeoScanViewCountProps {
  count: number;
  locale: string;
}

export type GeoScanRunView = "answers" | "mentioned" | "pending";

export type GeoScanPendingAnswer = NonNullable<
  ReturnType<typeof useGeoScanRun>["data"]
>["pending"][number];

type GeoScanLivePage = NonNullable<
  NonNullable<ReturnType<typeof useGeoScanRun>["data"]>["live"]
>;

type GeoScanLiveRow = GeoScanLivePage["rows"][number];

export interface GeoScanAnswerTableRow extends GeoScanResultSummary {
  /** Same prompt as the row above, so its text steps back. */
  repeated: boolean;
}

export interface GeoScanLiveTableRow extends GeoScanLiveRow {
  /** Same prompt as the row above, so its text steps back. */
  repeated: boolean;
}

export interface GeoScanLiveStatusCellProps {
  status: GeoScanLiveRow["status"];
}

export interface GeoScanRunLiveTableProps {
  live: GeoScanLivePage;
  showLanguage: boolean;
  emptyState: ReactNode;
  onOffsetChange: (offset: number) => void;
  height: number;
  loading: boolean;
  onRowClick: (row: GeoScanResultSummary) => void;
}

export interface GeoScanRunFiltersProps {
  view: GeoScanRunView;
  onViewChange: (view: GeoScanRunView) => void;
  answerCount: number;
  mentionedCount: number;
  pendingCount: number;
  running: boolean;
  engine: string;
  engines: readonly string[];
  onEngineChange: (engine: string) => void;
}

export interface GeoScanAnswerProps {
  scanId: string;
  initialLanguage?: string;
  organizationId: string;
  checkId: string | null;
  onClose: () => void;
}

export interface GeoScanModelCellProps {
  engine: string;
}

export interface GeoScanPromptCellProps {
  prompt: string;
  turn: number | null;
  repeated?: boolean;
}

export interface GeoScanRunEmptyStateInput {
  isError: boolean;
  hasData: boolean;
  loading: boolean;
  onRetry: () => void;
}

export interface GeoScanRunPendingTableProps {
  pending: GeoScanPendingAnswer[];
  showLanguage: boolean;
  emptyState: ReactNode;
  offset: number;
  onOffsetChange: (offset: number) => void;
  total: number;
  height: number;
  loading: boolean;
}

export interface GeoScanRunAnswersTableProps {
  results: GeoScanResultSummary[];
  showLanguage: boolean;
  emptyState: ReactNode;
  offset: number;
  onOffsetChange: (offset: number) => void;
  total: number;
  height: number;
  loading: boolean;
  onRowClick: (row: GeoScanResultSummary) => void;
}

export interface ScanRunDetailViewInput {
  run: GeoScanRunSummary;
  view: GeoScanRunView;
  data: ReturnType<typeof useGeoScanRun>["data"];
  isPending: boolean;
  isPlaceholderData: boolean;
  pendingOffset: number;
}

export interface ScanRunDetailView {
  running: boolean;
  /** Plan-ordered page of a running scan, null once it has finished. */
  live: GeoScanLivePage | null;
  pendingTotal: number;
  pending: GeoScanPendingAnswer[];
  results: GeoScanResultSummary[];
  activeView: GeoScanRunView;
  showLanguage: boolean;
  loading: boolean;
  hasFilters: boolean;
  engines: readonly string[];
  height: number;
  pendingOffset: number;
  total: number;
  answerCount: number;
  mentionedCount: number;
}

export type ScanRunDetailTranslator = ReturnType<
  typeof useTranslations<"geo.scanRunDetail">
>;
