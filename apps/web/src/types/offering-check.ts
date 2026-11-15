import type { IconSvgElement } from "@hugeicons/react";
import type { ComponentProps, ReactNode } from "react";

export type OfferingVerdict = "knows" | "vague" | "confused" | "unknown";

export type OfferingQuestionKind = "name" | "problem";

export interface OfferingCheckInput {
  domain: string;
  feature: string;
  problem: string;
  webSearch: boolean;
}

export interface OfferingQuestion {
  kind: OfferingQuestionKind;
  text: string;
}

interface OfferingSourcePage {
  url: string;
  cited: boolean;
}

export interface OfferingSourceDomain {
  domain: string;
  pages: number;
  urls: OfferingSourcePage[];
  cited: boolean;
  own: boolean;
  topUrl: string;
}

interface OfferingGrade {
  verdict: OfferingVerdict;
  summary: string;
}

export interface OfferingAnswer extends OfferingGrade {
  kind: OfferingQuestionKind;
  question: string;
  answer: string;
  reasoning: string;
  seconds: number;
  queries: string[];
  searchUsed: boolean;
  sources: OfferingSourceDomain[];
}

export interface OfferingCheckResult {
  domain: string;
  feature: string;
  problem: string;
  companyName: string;
  companyDescription: string;
  model: string;
  otherOfferings: string[];
  answers: OfferingAnswer[];
  checkedAt: string;
}

export type OfferingStreamEvent =
  | { type: "delta"; kind: OfferingQuestionKind; text: string }
  | { type: "reasoning"; kind: OfferingQuestionKind; text: string }
  | {
      type: "search";
      kind: OfferingQuestionKind;
      queries: string[];
      domains: string[];
    }
  | { type: "answered"; kind: OfferingQuestionKind; seconds: number }
  | { type: "result"; result: OfferingCheckResult }
  | { type: "error" };

export type OfferingStreamEmit = (event: OfferingStreamEvent) => void;

export interface OfferingVerdictCopy {
  label: string;
  problemLabel: string;
  badgeClassName: string;
  textClassName: string;
  heroLead: string;
  featureBody: string;
  companyBody: string;
  problemLead: string;
  problemBody: string;
}

export type OfferingCheckSample = OfferingSampleValues;

export type OfferingRateLimitScope = "visitor" | "site" | "busy";

export type OfferingFailureStatus =
  | "rate-limited"
  | "site-limited"
  | "busy"
  | "unknown-site"
  | "unavailable"
  | "error";

type OfferingReportStatus =
  | "checking"
  | "done"
  | "verify"
  | OfferingFailureStatus;

export type OfferingFormProblem =
  | "invalid-domain"
  | "invalid-feature"
  | "invalid-problem"
  | OfferingFailureStatus;

export interface OfferingCheckFormProps {
  samples: readonly OfferingCheckSample[];
}

export interface OfferingReportProps {
  input: OfferingCheckInput;
}

export interface OfferingThread {
  question: OfferingQuestion;
  answer: string;
  reasoning: string;
  seconds: number | null;
  queries: string[];
  domains: string[];
  result: OfferingAnswer | null;
}

export interface OfferingLiveState {
  status: OfferingReportStatus;
  threads: OfferingThread[];
  result: OfferingCheckResult | null;
}

export interface OfferingChatWindowProps {
  feature: string;
  hasFeature: boolean;
  thread: OfferingThread;
  webSearch: boolean;
}

export interface OfferingChatReasoningProps {
  thread: OfferingThread;
  webSearch: boolean;
}

export interface OfferingChatTraceProps {
  thread: OfferingThread;
  reasoning: string;
  answered: boolean;
}

export interface OfferingMarkdownNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: OfferingMarkdownNode[];
}

export interface OfferingSearchActivityProps {
  queries: readonly string[];
  domains: readonly string[];
  links: Readonly<Record<string, string>>;
  live: boolean;
}

export interface OfferingTraceStepProps {
  icon: IconSvgElement;
  label: string;
  meta?: string;
  children: ReactNode;
}

export interface OfferingVerdictRowProps {
  kind: OfferingQuestionKind;
  label: string;
  verdict: OfferingVerdict | null;
  summary: string | null;
  activity: string | null;
}

export interface OfferingReportCardProps {
  input: OfferingCheckInput;
  state: OfferingLiveState;
}

export interface OfferingReportStatProps {
  label: string;
  value: ReactNode;
  pending?: boolean;
}

export interface OfferingSourceSiteProps {
  source: OfferingSourceDomain;
}

export interface OfferingSourcesProps {
  sources: readonly OfferingSourceDomain[];
}

export interface OfferingFaviconProps {
  domain: string;
  className?: string;
}

export interface OfferingSentenceFieldProps extends ComponentProps<"input"> {
  id: string;
  label: string;
  invalid: boolean;
  active?: boolean;
  holdWidth: boolean;
  leading?: ReactNode;
}

export interface OfferingDomainFaviconProps {
  value: string;
}

export type OfferingSampleField = "domain" | "feature" | "problem";

export interface OfferingErrorTooltipProps {
  error: string | null;
  attempt: number;
  inline?: boolean;
  children: ReactNode;
}

declare module "@tanstack/react-router" {
  interface HistoryState {
    offeringTurnstileToken?: string;
  }
}

export type OfferingAnsweredQuestion = Omit<
  OfferingAnswer,
  "verdict" | "summary"
>;

export type OfferingSampleValues = Pick<
  OfferingCheckInput,
  "domain" | "feature" | "problem"
>;

export interface OfferingTypingFrame {
  values: OfferingSampleValues;
  field: OfferingSampleField | null;
  at: number;
}

export type OfferingStreamAction =
  | { type: "event"; event: OfferingStreamEvent }
  | { type: "failed"; status: OfferingFailureStatus }
  | { type: "verify" }
  | { type: "restart" };

export interface OfferingRateLimitCheck {
  key: string;
  requests: number;
  windowMs: number;
  scope: OfferingRateLimitScope;
}

export interface OfferingHeroCopy {
  lead: string;
  body: string;
}

export interface OfferingNoticeDescription {
  field: OfferingSampleField | null;
  message: string;
}

export interface OfferingSourceSummary {
  sites: number;
  pages: number;
  ownSite: string;
}

export interface OfferingReportSearch {
  domain?: string;
  feature?: string;
  problem?: string;
  webSearch?: boolean;
}
