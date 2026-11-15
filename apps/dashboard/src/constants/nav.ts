import {
  Activity01Icon,
  AiBrowserIcon,
  AiChat01Icon,
  Analytics01Icon,
  Building03Icon,
  ChartAnalysisIcon,
  Comment01Icon,
  Home01Icon,
  Key01Icon,
  Layers01Icon,
  MagicWand01Icon,
  Message01Icon,
  NoteIcon,
  PaintBoardIcon,
  PencilEdit01Icon,
  PlugIcon,
  PlusSignIcon,
  Rocket01Icon,
  Robot01Icon,
  SearchList01Icon,
  Settings01Icon,
  UserGroupIcon,
  WebDesign01Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import {
  GEO_AGENT_READINESS_NAV_LINK,
  GEO_GAPS_NAV_LINK,
  GEO_PROMPTS_NAV_LINK,
} from "@notra/geo-core/constants/geo";
import { GEO_PERSONAS_NAV_LINK } from "@notra/geo-core/constants/geo-personas";
import type { PostStatus } from "@notra/schemas/dashboard/content";
import { DURATION } from "@notra/ui/lib/motion";

import { AGENT_FEEDBACK_NAV_LINK } from "@/constants/agent-feedback";
import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import { SITES_NAV_LINK } from "@/constants/sites";
import type {
  NavGroup,
  NavMainItem,
  NavPrimaryActionConfig,
  NavVisibility,
  SidebarMode,
  SidebarModeOption,
} from "@/types/components/nav";

export const HOME_NAV_LINK = "";
const CHAT_NAV_LINK = "/chat";
const CONTENT_NAV_LINK = "/content";
export const ANALYTICS_NAV_LINK = "/analytics";
const BRAND_IDENTITY_NAV_LINK = "/brand/identity";
const AUTOMATIONS_NAV_LINK = "/automation";
const INTEGRATIONS_NAV_LINK = "/integrations";
const SKILLS_NAV_LINK = "/skills";
const API_KEYS_NAV_LINK = "/api-keys";
export const GEO_OVERVIEW_NAV_LINK = "/geo";
const GEO_TRAFFIC_NAV_LINK = "/geo/traffic";
export const GEO_COMPETITORS_NAV_LINK = "/geo/competitors";
const GEO_SHELF_SPACE_NAV_LINK = "/geo/shelf-space";
export const GEO_SETTINGS_NAV_LINK = "/geo/settings";

export const SIDEBAR_DEFAULT_MODE: SidebarMode = "geo";
export const SIDEBAR_DEFAULT_WIDTH = 256;
/** Matches `--transition-duration-slow`, the sidebar width transition. */
export const SIDEBAR_TRANSITION_MS = 300;
export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_RESIZE_STEP = 8;
export const SIDEBAR_WIDTH_COOKIE_NAME = "sidebar_width";

export const GEO_ROUTE_SECTIONS: ReadonlySet<string> = new Set(["geo"]);

export const SHARED_ROUTE_PREFIXES: readonly string[] = [
  "content",
  "automation",
];

export const STUDIO_ROUTE_SECTIONS: ReadonlySet<string> = new Set([
  "chat",
  "collection",
  "analytics",
  "brand",
  "automation",
  "feedback",
  "sites",
  "autopilot",
]);

export const NAV_MAIN_ITEMS: NavMainItem[] = [
  { link: HOME_NAV_LINK, icon: Home01Icon, labelKey: "home" },
  { link: CHAT_NAV_LINK, icon: Message01Icon, labelKey: "chat" },
  { link: CONTENT_NAV_LINK, icon: NoteIcon, labelKey: "content" },
  { link: SITES_NAV_LINK, icon: WebDesign01Icon, labelKey: "sites" },
  { link: ANALYTICS_NAV_LINK, icon: Analytics01Icon, labelKey: "analytics" },
  {
    link: AGENT_FEEDBACK_NAV_LINK,
    icon: Comment01Icon,
    labelKey: "feedback",
  },
  {
    link: BRAND_IDENTITY_NAV_LINK,
    icon: PaintBoardIcon,
    labelKey: "brandIdentityTitle",
  },
  { link: AUTOPILOT_NAV_LINK, icon: Rocket01Icon, labelKey: "autopilot" },
  {
    link: AUTOMATIONS_NAV_LINK,
    icon: WorkflowSquare03Icon,
    labelKey: "automations",
  },
  { link: INTEGRATIONS_NAV_LINK, icon: PlugIcon, labelKey: "integrations" },
  { link: GEO_OVERVIEW_NAV_LINK, icon: AiBrowserIcon, labelKey: "overview" },
  { link: GEO_TRAFFIC_NAV_LINK, icon: Activity01Icon, labelKey: "traffic" },
  { link: GEO_PROMPTS_NAV_LINK, icon: AiChat01Icon, labelKey: "prompts" },
  { link: GEO_GAPS_NAV_LINK, icon: SearchList01Icon, labelKey: "contentGaps" },
  {
    link: GEO_SHELF_SPACE_NAV_LINK,
    icon: Layers01Icon,
    labelKey: "shelfSpace",
  },
  {
    link: GEO_AGENT_READINESS_NAV_LINK,
    icon: Robot01Icon,
    labelKey: "agentReadiness",
  },
  {
    link: GEO_COMPETITORS_NAV_LINK,
    icon: ChartAnalysisIcon,
    labelKey: "competitors",
  },
  {
    link: GEO_PERSONAS_NAV_LINK,
    icon: UserGroupIcon,
    labelKey: "personas",
    badge: "beta",
  },
  {
    link: GEO_SETTINGS_NAV_LINK,
    icon: Settings01Icon,
    labelKey: "geoSettings",
  },
  { link: SKILLS_NAV_LINK, icon: MagicWand01Icon, labelKey: "skills" },
  { link: API_KEYS_NAV_LINK, icon: Key01Icon, labelKey: "apiKeys" },
];

export const NAV_GEO_IMPROVE_LINKS: readonly string[] = [
  GEO_GAPS_NAV_LINK,
  GEO_SHELF_SPACE_NAV_LINK,
  GEO_AGENT_READINESS_NAV_LINK,
  CONTENT_NAV_LINK,
  AUTOMATIONS_NAV_LINK,
];

/**
 * Main navigation. One row per job: the row opens its first page and reveals
 * the related pages underneath while one of them is active.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "overview",
    icon: Home01Icon,
    labelKey: "overview",
    links: [
      GEO_OVERVIEW_NAV_LINK,
      HOME_NAV_LINK,
      GEO_TRAFFIC_NAV_LINK,
      ANALYTICS_NAV_LINK,
    ],
  },
  {
    id: "prompts",
    icon: AiChat01Icon,
    labelKey: "prompts",
    links: [GEO_PROMPTS_NAV_LINK, GEO_PERSONAS_NAV_LINK],
  },
  {
    id: "competitors",
    icon: ChartAnalysisIcon,
    labelKey: "competitors",
    links: [GEO_COMPETITORS_NAV_LINK, GEO_SHELF_SPACE_NAV_LINK],
  },
  {
    id: "improve",
    icon: SearchList01Icon,
    labelKey: "improve",
    links: [GEO_GAPS_NAV_LINK, GEO_AGENT_READINESS_NAV_LINK],
  },
  {
    id: "automations",
    icon: WorkflowSquare03Icon,
    labelKey: "automations",
    links: [AUTOMATIONS_NAV_LINK],
  },
  {
    id: "content",
    icon: NoteIcon,
    labelKey: "content",
    links: [CONTENT_NAV_LINK, CHAT_NAV_LINK],
  },
  {
    id: "sites",
    icon: WebDesign01Icon,
    labelKey: "sites",
    links: [SITES_NAV_LINK],
  },
  {
    id: "feedback",
    icon: Comment01Icon,
    labelKey: "feedback",
    links: [AGENT_FEEDBACK_NAV_LINK],
  },
  // Behind the autopilot flag; resolveNavItems drops it when the flag is off.
  {
    id: "autopilot",
    icon: Rocket01Icon,
    labelKey: "autopilot",
    links: [AUTOPILOT_NAV_LINK],
  },
];

export const NAV_WORKSPACE_GROUP: NavGroup = {
  id: "workspace",
  icon: Building03Icon,
  labelKey: "workspace",
  listsOwnPage: true,
  links: [
    BRAND_IDENTITY_NAV_LINK,
    INTEGRATIONS_NAV_LINK,
    SKILLS_NAV_LINK,
    API_KEYS_NAV_LINK,
  ],
};

export const DEFAULT_NAV_VISIBILITY: NavVisibility = {
  autopilot: false,
  analytics: true,
  sites: false,
};

const SIDEBAR_MODE_SWOOSH_IN = "ease-[cubic-bezier(0.16,1,0.3,1)]";
const SIDEBAR_MODE_SWOOSH_OUT = "ease-emphasized";
const SIDEBAR_MODE_ENTER_TIMING = `duration-slow ${SIDEBAR_MODE_SWOOSH_IN}`;
const SIDEBAR_MODE_EXIT_TIMING = `duration-fast ${SIDEBAR_MODE_SWOOSH_OUT}`;

export const SIDEBAR_MODE_EXIT_MS = DURATION.fast * 1000;

export const SIDEBAR_MODE_ENTER_CLASS = `z-10 translate-x-0 opacity-100 blur-[0px] ${SIDEBAR_MODE_ENTER_TIMING}`;

export const SIDEBAR_MODE_EXIT_LEFT_CLASS = `pointer-events-none z-0 -translate-x-5 opacity-0 blur-[8px] ${SIDEBAR_MODE_EXIT_TIMING}`;

export const SIDEBAR_MODE_EXIT_RIGHT_CLASS = `pointer-events-none z-0 translate-x-5 opacity-0 blur-[8px] ${SIDEBAR_MODE_EXIT_TIMING}`;

const SIDEBAR_MODE_FADE_CLASS =
  "transition-[opacity,translate,filter] will-change-[opacity,translate,filter] motion-reduce:translate-x-0 motion-reduce:blur-none motion-reduce:transition-opacity";

export const SIDEBAR_MODE_PANEL_CLASS = `flex min-h-0 w-full flex-col ${SIDEBAR_MODE_FADE_CLASS}`;

export const NAV_RECENT_LIMIT = 3;

export const ORG_SWITCH_STATIC_PAGE_SECTIONS: ReadonlySet<string> = new Set([
  "geo",
  "automation",
  "brand",
]);
