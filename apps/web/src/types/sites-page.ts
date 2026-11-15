import type { StatusBadgeAppearance } from "@notra/ui/types/status-badge";

import type { FeaturesCardCopy } from "@/types/landing/features";

export interface SitesStagePost {
  title: string;
  excerpt: string;
  author: string;
  avatar: string;
  date: string;
  path: string;
  fresh?: boolean;
}

interface SitesCardFrame {
  heading: string;
  subhead: string;
}

export interface SitesStatusBadge {
  label: string;
  appearance: StatusBadgeAppearance;
}

export type SitesDeploymentStatus = "ready" | "building";

export type SitesEnvironment = "Production" | "Preview";

export interface SitesDeploymentsCard {
  copy: FeaturesCardCopy;
  frame: SitesCardFrame;
  headers: { deployment: string; environment: string; status: string };
  rows: readonly {
    title: string;
    sha: string;
    branch: string;
    environment: SitesEnvironment;
    status: SitesDeploymentStatus;
    duration?: string;
    live?: boolean;
  }[];
  live: string;
}

export type SitesDomainStatus = "active" | "verifying";

export interface SitesDomainsCard {
  copy: FeaturesCardCopy;
  frame: SitesCardFrame;
  headers: { domain: string; setup: string; status: string };
  rows: readonly { domain: string; setup: string; status: SitesDomainStatus }[];
}

export interface SitesFilesCard {
  copy: FeaturesCardCopy;
  frame: SitesCardFrame;
  headers: { file: string; reader: string };
  rows: readonly { file: string; reader: string }[];
}

export interface SitesConfigCard {
  copy: FeaturesCardCopy;
  frame: SitesCardFrame;
  source: string;
}

export interface JsonToken {
  kind: "key" | "string" | "literal" | "punctuation";
  text: string;
}
