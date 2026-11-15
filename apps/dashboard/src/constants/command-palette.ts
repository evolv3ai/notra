import {
  Activity01Icon,
  AiBrowserIcon,
  AiChat01Icon,
  Analytics01Icon,
  AnalyticsUpIcon,
  ChartAnalysisIcon,
  Comment01Icon,
  CorporateIcon,
  CreditCardIcon,
  Github01Icon,
  Globe02Icon,
  Home01Icon,
  Key01Icon,
  Layers01Icon,
  LinkSquare02Icon,
  Message01Icon,
  NoteIcon,
  Notification01Icon,
  PlugIcon,
  QuotesIcon,
  SearchList01Icon,
  Settings01Icon,
  UserCircleIcon,
  UserGroupIcon,
  Wallet01Icon,
  WebDesign01Icon,
  Rocket01Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import type {
  CommandPaletteEntityKind,
  CommandRoute,
  CommandRouteId,
  CommandSection,
} from "@/types/components/command-palette";

export const COMMAND_ROUTE_LABEL_KEYS = {
  home: "home",
  chat: "chat",
  analytics: "analytics",
  autopilot: "autopilot",
  geo: "overview",
  "geo-traffic": "traffic",
  "geo-prompts": "prompts",
  "geo-personas": "personas",
  "geo-gaps": "contentGaps",
  "geo-shelf-space": "shelfSpace",
  "geo-competitors": "competitors",
  "geo-write": "write",
  "geo-settings-brand": "brand",
  "geo-settings-languages": "languages",
  "geo-settings-models": "models",
  content: "content",
  sites: "sites",
  "brand-company-info": "companyInfo",
  "brand-references": "references",
  automations: "automations",
  "api-keys": "apiKeys",
  integrations: "integrations",
  "github-integration": "github",
  logs: "logs",
  "settings-account": "account",
  "settings-general": "generalSettings",
  "settings-members": "members",
  "settings-notifications": "notifications",
  "settings-billing": "billing",
  "settings-usage": "usage",
  "settings-credits": "credits",
} as const satisfies Record<CommandRouteId, string>;

export const COMMAND_SECTION_LABEL_KEYS = {
  Navigation: "labels.navigation",
  GEO: "labels.geo",
  Workspace: "labels.workspace",
  Automation: "labels.automation",
  Manage: "actions.manage",
  Settings: "actions.settings",
} as const satisfies Record<CommandSection, string>;

export const COMMAND_ROUTES: CommandRoute[] = [
  {
    id: "home",
    label: "Home",
    keywords: ["dashboard", "start", "overview"],
    icon: Home01Icon,
    section: "Navigation",
    path: (slug) => `/${slug}`,
  },
  {
    id: "chat",
    label: "Chat",
    keywords: ["ai", "assistant", "conversation", "message"],
    icon: Message01Icon,
    section: "Navigation",
    path: (slug) => `/${slug}/chat`,
  },
  {
    id: "autopilot",
    label: "Autopilot",
    keywords: ["pull requests", "prs", "daily", "brief", "proactive", "merge"],
    icon: Rocket01Icon,
    section: "Navigation",
    path: (slug) => `/${slug}/autopilot`,
    flag: "autopilot",
  },
  {
    id: "analytics",
    label: "Analytics",
    keywords: ["stats", "metrics", "followers", "engagement", "social"],
    icon: Analytics01Icon,
    section: "Navigation",
    path: (slug) => `/${slug}/analytics`,
    flag: "analytics",
  },
  {
    id: "geo",
    label: "Overview",
    keywords: ["geo", "ai", "mentions", "visibility", "chatgpt"],
    icon: AiBrowserIcon,
    section: "GEO",
    path: (slug) => `/${slug}/geo`,
  },
  {
    id: "geo-traffic",
    label: "Traffic",
    keywords: [
      "geo",
      "ai",
      "traffic",
      "crawlers",
      "referrals",
      "visits",
      "citations",
      "bots",
    ],
    icon: Activity01Icon,
    section: "GEO",
    path: (slug) => `/${slug}/geo/traffic`,
  },
  {
    id: "geo-prompts",
    label: "Prompts",
    keywords: ["geo", "ai", "prompts", "questions", "tracking"],
    icon: AiChat01Icon,
    section: "GEO",
    path: (slug) => `/${slug}/geo/prompts`,
  },
  {
    id: "geo-personas",
    label: "Personas",
    keywords: [
      "geo",
      "ai",
      "personas",
      "buyers",
      "icp",
      "customer profiles",
      "memories",
    ],
    icon: UserGroupIcon,
    section: "GEO",
    path: (slug) => `/${slug}/geo/personas`,
  },
  {
    id: "geo-gaps",
    label: "Content Gaps",
    keywords: [
      "geo",
      "ai",
      "gaps",
      "content gap",
      "write",
      "opportunity",
      "mentions",
    ],
    icon: SearchList01Icon,
    section: "GEO",
    path: (slug) => `/${slug}/geo/gaps`,
  },
  {
    id: "geo-shelf-space",
    label: "Shelf Space",
    keywords: [
      "geo",
      "ai",
      "shelf",
      "shelf space",
      "citations",
      "sources",
      "backlinks",
      "listicle",
      "opportunity",
      "ticket",
    ],
    icon: Layers01Icon,
    section: "GEO",
    path: (slug) => `/${slug}/geo/shelf-space`,
  },
  {
    id: "geo-competitors",
    label: "Competitors",
    keywords: ["geo", "ai", "competitors", "share of voice", "brands"],
    icon: ChartAnalysisIcon,
    section: "GEO",
    path: (slug) => `/${slug}/geo/competitors`,
  },
  {
    id: "geo-settings-brand",
    label: "Brand",
    keywords: [
      "geo",
      "ai",
      "settings",
      "brand",
      "aliases",
      "company",
      "conversion",
    ],
    icon: CorporateIcon,
    section: "GEO",
    path: (slug) => `/${slug}?settings=geo-brand`,
    settingsSection: "geo-brand",
  },
  {
    id: "geo-settings-languages",
    label: "Languages",
    keywords: ["geo", "ai", "settings", "language", "locale"],
    icon: Globe02Icon,
    section: "GEO",
    path: (slug) => `/${slug}?settings=geo-languages`,
    settingsSection: "geo-languages",
  },
  {
    id: "geo-settings-models",
    label: "Models",
    keywords: ["geo", "ai", "settings", "models", "engines", "scanning"],
    icon: AiBrowserIcon,
    section: "GEO",
    path: (slug) => `/${slug}?settings=geo-models`,
    settingsSection: "geo-models",
  },
  {
    id: "content",
    label: "Content",
    keywords: ["posts", "drafts", "notes", "articles"],
    icon: NoteIcon,
    section: "Workspace",
    path: (slug) => `/${slug}/content`,
  },
  {
    id: "sites",
    label: "Sites",
    flag: "sites",
    keywords: [
      "sites",
      "blog",
      "changelog",
      "hosting",
      "deployments",
      "domains",
      "previews",
    ],
    icon: WebDesign01Icon,
    section: "Workspace",
    path: (slug) => `/${slug}/sites`,
  },
  {
    id: "brand-company-info",
    label: "Company Info",
    keywords: ["brand", "identity", "voice", "tone", "company"],
    icon: CorporateIcon,
    section: "Workspace",
    path: (slug) => `/${slug}/brand/identity`,
  },
  {
    id: "brand-references",
    label: "References",
    keywords: ["brand", "identity", "references", "examples", "posts"],
    icon: Comment01Icon,
    section: "Workspace",
    path: (slug) => `/${slug}/brand/identity?view=references`,
  },
  {
    id: "automations",
    label: "Automations",
    keywords: [
      "schedules",
      "cron",
      "recurring",
      "events",
      "triggers",
      "alerts",
      "webhooks",
      "slack",
    ],
    icon: WorkflowSquare03Icon,
    section: "Automation",
    path: (slug) => `/${slug}/automation`,
  },
  {
    id: "api-keys",
    label: "API Keys",
    keywords: ["tokens", "secrets", "credentials", "auth"],
    icon: Key01Icon,
    section: "Manage",
    path: (slug) => `/${slug}/api-keys`,
  },
  {
    id: "integrations",
    label: "Integrations",
    keywords: ["github", "linear", "framer", "raycast", "connect"],
    icon: PlugIcon,
    section: "Manage",
    path: (slug) => `/${slug}/integrations`,
  },
  {
    id: "github-integration",
    label: "GitHub",
    keywords: [
      "github",
      "repositories",
      "pull request",
      "draft",
      "permissions",
    ],
    icon: Github01Icon,
    section: "Manage",
    path: (slug) => `/${slug}/integrations/github`,
  },
  {
    id: "logs",
    label: "Logs",
    keywords: ["audit", "activity", "events", "history"],
    icon: AnalyticsUpIcon,
    section: "Settings",
    path: (slug) => `/${slug}?settings=logs`,
    settingsSection: "logs",
  },
  {
    id: "settings-account",
    label: "Account",
    keywords: ["profile", "user", "email", "password"],
    icon: UserCircleIcon,
    section: "Settings",
    path: (slug) => `/${slug}?settings=account`,
    settingsSection: "account",
  },
  {
    id: "settings-general",
    label: "General Settings",
    keywords: ["organization", "workspace", "name", "logo"],
    icon: Settings01Icon,
    section: "Settings",
    path: (slug) => `/${slug}?settings=general`,
    settingsSection: "general",
  },
  {
    id: "settings-members",
    label: "Members",
    keywords: ["team", "users", "invite", "people"],
    icon: UserGroupIcon,
    section: "Settings",
    path: (slug) => `/${slug}?settings=members`,
    settingsSection: "members",
  },
  {
    id: "settings-notifications",
    label: "Notifications",
    keywords: ["alerts", "email", "preferences"],
    icon: Notification01Icon,
    section: "Settings",
    path: (slug) => `/${slug}?settings=notifications`,
    settingsSection: "notifications",
  },
  {
    id: "settings-billing",
    label: "Billing",
    keywords: ["subscription", "plan", "invoice", "payment"],
    icon: CreditCardIcon,
    section: "Settings",
    path: (slug) => `/${slug}?settings=billing`,
    settingsSection: "billing",
  },
  {
    id: "settings-usage",
    label: "Usage",
    keywords: ["usage", "remaining", "limits", "quota", "answers"],
    icon: ChartAnalysisIcon,
    section: "Settings",
    path: (slug) => `/${slug}?settings=usage`,
    settingsSection: "usage",
  },
  {
    id: "settings-credits",
    label: "Credits",
    keywords: ["balance", "top up", "tokens", "ai"],
    icon: Wallet01Icon,
    section: "Settings",
    path: (slug) => `/${slug}?settings=credits`,
    requiresAiCredits: true,
    settingsSection: "credits",
  },
];

export const COMMAND_SECTIONS: CommandSection[] = [
  "Navigation",
  "GEO",
  "Workspace",
  "Automation",
  "Manage",
  "Settings",
];

export const COMMAND_PALETTE_JEV_FEATURE = "command_palette_navigation";

export const COMMAND_PALETTE_JEV_TIMEOUT_MS = 1200;

export const COMMAND_PALETTE_JEV_MIN_CONFIDENCE = 0.5;

export const COMMAND_PALETTE_JEV_CHAT_CHOICE = "chat";

export const COMMAND_PALETTE_RECENTS_LIMIT = 5;

export const COMMAND_PALETTE_SUGGESTED_ROUTES = {
  geo: ["geo", "geo-prompts", "geo-gaps", "geo-competitors"],
  studio: ["home", "content", "chat", "automations"],
} as const satisfies Record<string, readonly CommandRouteId[]>;

export const COMMAND_PALETTE_ENTITY_ICONS = {
  post: NoteIcon,
  voice: CorporateIcon,
  reference: QuotesIcon,
  github: Github01Icon,
  linear: LinkSquare02Icon,
  social: UserCircleIcon,
  prompt: AiChat01Icon,
  competitor: ChartAnalysisIcon,
  persona: UserGroupIcon,
  site: WebDesign01Icon,
  chat: Message01Icon,
} as const satisfies Record<CommandPaletteEntityKind, IconSvgElement>;

export const COMMAND_PALETTE_THEME_SHORTCUT = "D";

export const COMMAND_PALETTE_ENTITY_DESCRIPTIONS = {
  prompt: "tracked GEO prompt",
  competitor: "competitor brand tracked in AI answers",
  persona: "GEO buyer persona",
  post: "content post",
  chat: "earlier AI chat",
  site: "hosted docs or blog site",
  voice: "brand voice",
  reference: "brand voice reference",
  github: "GitHub integration",
  linear: "Linear integration",
  social: "connected social account",
} as const satisfies Record<CommandPaletteEntityKind, string>;

export const COMMAND_PALETTE_NAME_MATCH_MIN_LENGTH = 3;

export const COMMAND_PALETTE_SEARCH_DEBOUNCE_MS = 300;

export const COMMAND_PALETTE_SEARCH_MIN_LENGTH = 2;

export const COMMAND_PALETTE_REFERENCE_SNIPPET_MAX = 80;

export const COMMAND_PALETTE_PUMPKIN_EASTER_EGG = {
  query: "pumpkin",
  sound: "/easter-eggs/pumpkin.mp3",
  volume: 0.3,
  image: "/easter-eggs/dominik.jpg",
} as const;

const PUMPKIN_PIXEL_COLORS: Record<string, string> = {
  S: "#3f6212",
  d: "#c2410c",
  O: "#f97316",
  F: "#431407",
};

const PUMPKIN_PIXEL_ROWS = [
  "....SS....",
  "...SS.....",
  ".dOOdOOOd.",
  "dOOOdOOOOd",
  "dOFFdOFFOd",
  "dOOOdOOOOd",
  "dFOFFFFOFd",
  "dOFFOFFOOd",
  ".dOOdOOOd.",
];

export const PUMPKIN_PIXEL_SIZE = {
  width: Math.max(...PUMPKIN_PIXEL_ROWS.map((row) => row.length)),
  height: PUMPKIN_PIXEL_ROWS.length,
};

export const PUMPKIN_PIXELS = PUMPKIN_PIXEL_ROWS.flatMap((row, y) =>
  [...row].flatMap((cell, x) => {
    const fill = PUMPKIN_PIXEL_COLORS[cell];
    return fill ? [{ x, y, fill }] : [];
  })
);

export const PUMPKIN_RAIN_DROPS = Array.from({ length: 16 }, (_, index) => ({
  left: (index * 61.8) % 96,
  delay: (index * 0.37) % 2.4,
  duration: 2.4 + ((index * 0.53) % 1.6),
  size: 20 + (index % 3) * 10,
}));
