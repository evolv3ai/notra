import {
  AiSearch02Icon,
  BrowserIcon,
  Robot01Icon,
} from "@hugeicons/core-free-icons";
import { Framer } from "@notra/ui/components/ui/svgs/framer";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Granola } from "@notra/ui/components/ui/svgs/granola";
import { Linear } from "@notra/ui/components/ui/svgs/linear";
import { Raycast } from "@notra/ui/components/ui/svgs/raycast";
import { Slack } from "@notra/ui/components/ui/svgs/slack";

import { NAVBAR_BENTO_TINTS } from "@/constants/navbar-bento";
import type {
  NavbarBentoLogo,
  NavbarProductsCard,
  NavbarProductsCrawlerRow,
  NavbarProductsIntegrationLogo,
  NavbarProductsLinkTile,
  NavbarProductsMock,
  NavbarProductsPersona,
  NavbarProductsPurpose,
  NavbarProductsPurposeStyle,
  NavbarProductsTurn,
} from "@/types/navbar-bento";

export const NAVBAR_PRODUCTS_CLASSES = {
  panel: "w-[min(66rem,calc(100vw-3rem))]",
  cards: "grid grid-cols-3 gap-3",
  card: "group relative flex h-80 flex-col overflow-clip rounded-2xl border border-[#1E1E1E14] bg-linear-to-b to-transparent to-60% transition-colors duration-normal ease-out hover:border-[#1E1E1E29] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] dark:border-white/10 dark:hover:border-white/20",
  copy: "flex shrink-0 flex-col p-6 pb-4",
  icon: "flex size-6 items-center justify-center rounded-md",
  title:
    "text-foreground mt-4 font-sans text-base/6 font-medium tracking-[-0.01em]",
  description: "text-muted-foreground mt-1 font-sans text-sm/5 text-pretty",
  mockArea: "pointer-events-none relative grow",
  mockStage:
    "absolute top-0 left-6 flex origin-top-left scale-75 transition-transform duration-slow ease-out group-hover:-translate-y-1.5",
  mockFade:
    "absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-white to-transparent dark:from-neutral-950",
} as const;

export const NAVBAR_PRODUCTS_CARDS: readonly NavbarProductsCard[] = [
  {
    href: "/features",
    label: "AI Search",
    description:
      "See where you stand when buyers ask ChatGPT, Claude and Perplexity.",
    icon: AiSearch02Icon,
    iconClassName: NAVBAR_BENTO_TINTS.violet,
    tintClassName: "from-[#8B5CF6]/10",
    mock: "conversations",
  },
  {
    href: "/features/ai-crawler-logs",
    label: "AI Crawler Logs",
    description: "See every AI bot that reads your site, and why it came.",
    icon: Robot01Icon,
    iconClassName: NAVBAR_BENTO_TINTS.amber,
    tintClassName: "from-[#E8833A]/10",
    mock: "crawler",
  },
  {
    href: "/features/sites",
    label: "Sites",
    description: "Host your blog and changelog from GitHub.",
    icon: BrowserIcon,
    iconClassName: NAVBAR_BENTO_TINTS.green,
    tintClassName: "from-[#16A34A]/10",
    mock: "sites",
  },
];

export const NAVBAR_PRODUCTS_LINK_TILES: readonly NavbarProductsLinkTile[] = [
  {
    href: "/integrations",
    label: "Integrations",
    description: "Notra in the tools you already use.",
    className: "grow-[1.25]",
    copyClassName: "w-56",
    mock: "integrations",
  },
  {
    href: "/mcp",
    label: "MCP & CLI",
    description: "Bring Notra into your agent.",
    className: "grow",
    copyClassName: "w-44",
    mock: "terminal",
  },
];

export const NAVBAR_PRODUCTS_LOGOS: Record<
  NavbarProductsIntegrationLogo,
  NavbarBentoLogo
> = {
  framer: { Logo: Framer },
  github: { Logo: Github },
  granola: { Logo: Granola },
  linear: { Logo: Linear },
  raycast: { Logo: Raycast, className: "[&_path]:fill-[#FF6363]" },
  slack: { Logo: Slack },
};

export const NAVBAR_PRODUCTS_PERSONAS: readonly NavbarProductsPersona[] = [
  {
    name: "Maya Chen",
    role: "Head of Growth · Series B SaaS",
    avatar: "/features/personas/maya.svg",
    memory: "Budget under $500 a month. SOC 2 is a must.",
    rank: 1,
  },
  {
    name: "Daniel Okafor",
    role: "Founder · Developer tools",
    avatar: "/features/personas/daniel.svg",
    memory: "Team of four. Wants a free plan to start.",
    rank: 3,
  },
];

export const NAVBAR_PRODUCTS_TURNS: readonly NavbarProductsTurn[] = [
  {
    question: "What's the best tool to automate changelogs from GitHub?",
    sources: "Searched the web · 12 sources",
    answer:
      "Beamer is the best known. Notra turns merged PRs into changelogs and launch posts.",
    rank: 2,
  },
  {
    question: "Which of those is cheapest for a team of five?",
    sources: "Searched the web · 8 sources",
    answer:
      "Notra has a free plan and doesn't charge per seat. Beamer starts at $59 a month.",
    rank: 1,
  },
  {
    question: "Can it post the update to LinkedIn too?",
    sources: "Searched the web · 6 sources",
    answer:
      "Yes. Notra drafts the post and publishes it to X or LinkedIn after approval.",
    rank: 1,
  },
];

export const NAVBAR_PRODUCTS_PURPOSES: Record<
  NavbarProductsPurpose,
  NavbarProductsPurposeStyle
> = {
  live: {
    label: "Live answer",
    className: "border-[#DDCFFC] bg-[#F1EBFE] text-[#6D3FD9]",
  },
  search: {
    label: "Search index",
    className: "border-[#D3E0F4] bg-[#EEF3FB] text-[#2F5C9E]",
  },
  referral: {
    label: "Referral",
    className: "border-[#CBE8D4] bg-[#EAF6EE] text-[#2F7D4B]",
  },
  training: {
    label: "Training",
    className: "border-[#F2DABA] bg-[#FDF3E7] text-[#A8601A]",
  },
};

export const NAVBAR_PRODUCTS_CRAWLER_ROWS: readonly NavbarProductsCrawlerRow[] =
  [
    {
      time: "14:03:12",
      bot: "ChatGPT-User",
      engine: "chatgpt",
      path: "/pricing",
      purpose: "live",
    },
    {
      time: "14:02:47",
      bot: "PerplexityBot",
      engine: "perplexity",
      path: "/docs/integrations/github",
      purpose: "search",
    },
    {
      time: "14:01:58",
      bot: "chatgpt.com",
      engine: "chatgpt",
      path: "/pricing",
      purpose: "referral",
    },
    {
      time: "14:00:31",
      bot: "ClaudeBot",
      engine: "claude",
      path: "/blog/changelog-guide",
      purpose: "training",
    },
    {
      time: "13:59:04",
      bot: "Claude-User",
      engine: "claude",
      path: "/features/social-updates",
      purpose: "live",
    },
    {
      time: "13:57:40",
      bot: "GPTBot",
      engine: "chatgpt",
      path: "/changelog",
      purpose: "training",
    },
    {
      time: "13:56:22",
      bot: "Google-Extended",
      engine: "google",
      path: "/llms.txt",
      purpose: "training",
    },
  ];

export const NAVBAR_PRODUCTS_LOGO_ROWS: readonly (readonly NavbarProductsIntegrationLogo[])[] =
  [
    ["github", "linear", "slack", "framer"],
    ["granola", "raycast", "github", "slack", "linear"],
    ["framer", "linear", "granola", "raycast"],
  ];

export const NAVBAR_PRODUCTS_TERMINAL_LINES = [
  "$ claude mcp add --transport http notra https://mcp.usenotra.com/mcp",
  "$ notra geo projects list",
  "$ notra geo scans start proj_123 --wait",
] as const;

export const NAVBAR_PRODUCTS_SITE = {
  domain: "usenotra.com/blog",
  deployed: "Deployed 21 s ago",
} as const;
