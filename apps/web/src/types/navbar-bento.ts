import type { ComponentType, ReactNode } from "react";

import type {
  MarketingNavCard,
  MarketingNavGroup,
  MarketingNavRailItem,
} from "@/utils/navigation";

export interface NavbarBentoPanelProps {
  group: MarketingNavGroup;
  onSelect: () => void;
}

export interface NavbarBentoFeatureStyle<TMock extends string> {
  iconClassName: string;
  mock: TMock;
}

export interface NavbarBentoLinkStyle<TMock extends string> {
  className: string;
  copyClassName: string;
  mock: TMock;
}

interface NavbarBentoLink {
  href: string;
  label: string;
  description?: string;
  external?: boolean;
}

export interface NavbarBentoTileProps {
  link: NavbarBentoLink;
  onSelect: () => void;
  className: string;
  children: ReactNode;
}

export interface NavbarBentoFeatureTileProps {
  card: MarketingNavCard | MarketingNavRailItem;
  iconClassName?: string;
  onSelect: () => void;
  className: string;
  children: ReactNode;
}

export interface NavbarBentoLinkTileProps {
  link: NavbarBentoLink;
  style: Omit<NavbarBentoLinkStyle<string>, "mock">;
  onSelect: () => void;
  children?: ReactNode;
}

export interface NavbarBentoMockHeaderProps {
  title: string;
  meta: string;
  children: ReactNode;
}

export interface NavbarBentoWindowProps {
  label: string;
  className: string;
  children: ReactNode;
}

export interface NavbarBentoMockProps<TMock extends string> {
  mock: TMock;
}

export interface NavbarProductsPersona {
  name: string;
  role: string;
  avatar: string;
  memory: string;
  rank: number;
}

export interface NavbarProductsTurn {
  question: string;
  sources: string;
  answer: string;
  rank: number;
}

export type NavbarProductsPurpose = "live" | "search" | "referral" | "training";

export interface NavbarProductsPurposeStyle {
  label: string;
  className: string;
}

export interface NavbarProductsCrawlerRow {
  time: string;
  bot: string;
  engine: NavbarReportsEngine;
  path: string;
  purpose: NavbarProductsPurpose;
}

export type NavbarProductsIntegrationLogo =
  | "framer"
  | "github"
  | "granola"
  | "linear"
  | "raycast"
  | "slack";

export type NavbarProductsMock =
  | "personas"
  | "conversations"
  | "crawler"
  | "sites"
  | "integrations"
  | "terminal";

export interface NavbarProductsCard extends MarketingNavCard {
  iconClassName: string;
  tintClassName: string;
  mock: NavbarProductsMock;
}

export interface NavbarProductsLinkTile
  extends NavbarBentoLink, NavbarBentoLinkStyle<NavbarProductsMock> {}

interface NavbarBentoLogoProps {
  className?: string;
  "aria-hidden"?: boolean;
}

export interface NavbarBentoLogo {
  Logo: ComponentType<NavbarBentoLogoProps>;
  className?: string;
}

export type NavbarResourcesMock =
  | "blog"
  | "changelog"
  | "contributors"
  | "docs"
  | "reviews";

export interface NavbarResourcesPost {
  title: string;
  description: string;
  authorSlug: string;
  date: string;
}

export interface NavbarResourcesRelease {
  date: string;
  type: "feat" | "fix";
  title: string;
}

export interface NavbarResourcesPullRequest {
  login: string;
  avatar: string;
  title: string;
  number: number;
}

export type NavbarReportsEngine =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "perplexity"
  | "google";

export interface NavbarEngineLogoProps {
  engine: NavbarReportsEngine;
}
