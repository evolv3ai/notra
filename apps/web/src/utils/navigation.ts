import {
  Activity01Icon,
  AiBrain01Icon,
  BookOpen01Icon,
  BrowserIcon,
  BubbleChatIcon,
  CommandLineIcon,
  FavouriteIcon,
  Megaphone01Icon,
  QuillWrite01Icon,
  Robot01Icon,
  UserGroupIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { REPORTS_NAV } from "@/constants/reports-navigation";

export interface MarketingNavCard {
  href: string;
  label: string;
  description: string;
  icon: IconSvgElement;
  external?: boolean;
}

export interface MarketingNavRailItem {
  href: string;
  label: string;
  description?: string;
  icon: IconSvgElement;
  external?: boolean;
}

export interface MarketingNavGroup {
  type: "group";
  layout?: "compact";
  panel?: "products" | "resources" | "reports";
  label: string;
  cardsHeading: string;
  cards: readonly MarketingNavCard[];
  railHeading: string;
  rail: readonly MarketingNavRailItem[];
}

interface MarketingNavLink {
  type: "link";
  href: string;
  label: string;
}

export type MarketingNavEntry = MarketingNavGroup | MarketingNavLink;

export const MARKETING_NAV: readonly MarketingNavEntry[] = [
  {
    type: "group",
    panel: "products",
    label: "Products",
    cardsHeading: "Product",
    cards: [
      {
        href: "/features/personas",
        label: "Personas",
        description: "Ask every AI engine as each of your buyers would.",
        icon: UserMultiple02Icon,
      },
      {
        href: "/features/conversations",
        label: "Conversations",
        description:
          "Play a full buying thread and see where you stand at every turn.",
        icon: BubbleChatIcon,
      },
      {
        href: "/features/ai-crawler-logs",
        label: "AI Crawler Logs",
        description: "See every AI bot that reads your site, and why it came.",
        icon: Robot01Icon,
      },
      {
        href: "/features/sites",
        label: "Sites",
        description: "Host your blog and changelog from GitHub.",
        icon: BrowserIcon,
      },
    ],
    railHeading: "Developers",
    rail: [
      {
        href: "https://www.npmjs.com/package/@usenotra/geo",
        label: "GEO SDK",
        icon: Activity01Icon,
        external: true,
      },
      {
        href: "/mcp",
        label: "MCP Server",
        icon: AiBrain01Icon,
      },
      {
        href: "https://www.usenotra.com/docs/devtools/cli",
        label: "CLI",
        icon: CommandLineIcon,
        external: true,
      },
    ],
  },
  {
    type: "group",
    panel: "resources",
    label: "Resources",
    cardsHeading: "Resources",
    cards: [
      {
        href: "/blog",
        label: "Blog",
        description: "Writing on GEO, AI search and DX.",
        icon: QuillWrite01Icon,
      },
      {
        href: "/changelog/notra",
        label: "Changelog",
        description: "Overview of latest Notra changes.",
        icon: Megaphone01Icon,
      },
      {
        href: "/contributors",
        label: "Contributors",
        description: "People building Notra in the open.",
        icon: UserGroupIcon,
      },
    ],
    railHeading: "More",
    rail: [
      {
        href: "https://www.usenotra.com/docs",
        label: "Docs",
        description: "Guides, API and setup.",
        icon: BookOpen01Icon,
        external: true,
      },
      {
        href: "https://www.notrareviews.com/",
        label: "Reviews",
        description: "What teams say about Notra.",
        icon: FavouriteIcon,
        external: true,
      },
    ],
  },
  REPORTS_NAV,
  { type: "link", href: "/pricing", label: "Pricing" },
];
