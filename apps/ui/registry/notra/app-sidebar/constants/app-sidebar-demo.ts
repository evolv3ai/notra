import {
  BookOpenIcon,
  ChartColumnIcon,
  HouseIcon,
  LayoutTemplateIcon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  NotebookPenIcon,
  SearchCheckIcon,
  SettingsIcon,
} from "lucide-react";

import type {
  SidebarNavGroup,
  SidebarSwitcherOption,
} from "../types/app-sidebar";

export const DEMO_PROJECTS: SidebarSwitcherOption[] = [
  { value: "notra", label: "Notra", description: "usenotra.com", icon: "N" },
  { value: "acme", label: "Acme", description: "acme.dev", icon: "A" },
  { value: "blume", label: "Blume", description: "blume.sh", icon: "B" },
];

export const DEMO_NAV_GROUPS: SidebarNavGroup[] = [
  {
    title: "Overview",
    href: "#overview",
    icon: HouseIcon,
    items: [
      { title: "Traffic", href: "#traffic" },
      { title: "Analytics", href: "#analytics" },
    ],
  },
  {
    title: "Prompts",
    href: "#prompts",
    icon: MessagesSquareIcon,
    items: [{ title: "Personas", href: "#personas" }],
  },
  {
    title: "Competitors",
    href: "#competitors",
    icon: ChartColumnIcon,
    items: [{ title: "Shelf space", href: "#shelf-space" }],
  },
  {
    title: "Improve",
    href: "#gaps",
    icon: SearchCheckIcon,
    items: [{ title: "Agent readiness", href: "#agent-readiness" }],
  },
  {
    title: "Content",
    href: "#content",
    icon: NotebookPenIcon,
    items: [
      { title: "Chat", href: "#chat", badge: "Beta" },
      { title: "Schedules", href: "#schedules" },
      { title: "Events", href: "#events" },
    ],
  },
  { title: "Sites", href: "#sites", icon: LayoutTemplateIcon },
  {
    title: "Feedback",
    href: "#feedback",
    icon: MessageSquareTextIcon,
    badge: "Beta",
  },
];

export const DEMO_FOOTER_GROUPS: SidebarNavGroup[] = [
  {
    title: "Workspace",
    href: "#brand",
    icon: SettingsIcon,
    items: [
      { title: "Brand identity", href: "#brand" },
      { title: "Integrations", href: "#integrations" },
      { title: "Skills", href: "#skills" },
      { title: "API keys", href: "#api-keys" },
    ],
  },
  { title: "Docs", href: "#docs", icon: BookOpenIcon },
];

export const DEMO_PAGE_TITLES: Record<string, string> = Object.fromEntries(
  [...DEMO_NAV_GROUPS, ...DEMO_FOOTER_GROUPS].flatMap((group) => [
    [group.href, group.title],
    ...(group.items ?? []).map((item) => [item.href, item.title]),
  ])
);
