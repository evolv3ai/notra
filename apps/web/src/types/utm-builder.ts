import type { inferParserType } from "nuqs";

import type { utmBuilderParsers } from "@/schemas/utm-builder";

export type UtmBuilderState = inferParserType<typeof utmBuilderParsers>;

export type UtmFieldKey =
  | "source"
  | "medium"
  | "campaign"
  | "id"
  | "term"
  | "content"
  | "platform"
  | "format"
  | "tactic";

export interface UtmField {
  key: UtmFieldKey;
  param: string;
  label: string;
  placeholder: string;
  description: string;
  requirement: "required" | "recommended" | "optional";
  advanced?: boolean;
}

type Ga4Channel =
  | "Direct"
  | "Cross-network"
  | "Paid Shopping"
  | "Paid Search"
  | "Paid Social"
  | "Paid Video"
  | "Display"
  | "Paid Other"
  | "Organic Shopping"
  | "Organic Social"
  | "Organic Video"
  | "Organic Search"
  | "Referral"
  | "Email"
  | "Affiliates"
  | "Audio"
  | "SMS"
  | "Mobile Push Notifications"
  | "Unassigned";

export interface Ga4ChannelRule {
  channel: Ga4Channel;
  rule: string;
}

export interface Ga4Classification {
  channel: Ga4Channel;
  reason: string;
}

export type UtmIssueLevel = "error" | "warning" | "info";

export interface UtmIssue {
  level: UtmIssueLevel;
  message: string;
}

export interface UtmChannelPreset {
  id: string;
  label: string;
  source: string;
  medium: string;
  term?: string;
  content?: string;
  note?: string;
}

export interface UtmParam {
  param: string;
  input: string;
  value: string;
}

export interface UtmBuildResult {
  url: string | null;
  params: UtmParam[];
  classification: Ga4Classification | null;
  issues: UtmIssue[];
}

export interface UtmChannelLink {
  preset: UtmChannelPreset;
  result: UtmBuildResult;
}

export interface UtmResultCardProps {
  result: UtmBuildResult;
  shareHref: string;
  markdownHref: string;
}

export interface UtmIssueListProps {
  issues: readonly UtmIssue[];
}

export interface UtmChannelLinksProps {
  links: readonly UtmChannelLink[];
  selected: readonly string[];
  onToggle: (id: string) => void;
}

export interface UtmFieldInputProps {
  field: UtmField;
  value: string;
  listId?: string;
  onChange: (value: string) => void;
}
