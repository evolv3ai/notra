import { NAVBAR_BENTO_TINTS } from "@/constants/navbar-bento";
import type {
  NavbarBentoFeatureStyle,
  NavbarBentoLinkStyle,
  NavbarResourcesMock,
  NavbarResourcesPost,
  NavbarResourcesPullRequest,
  NavbarResourcesRelease,
} from "@/types/navbar-bento";

export const NAVBAR_RESOURCES_FEATURE_STYLES: Record<
  string,
  NavbarBentoFeatureStyle<NavbarResourcesMock>
> = {
  "/blog": { iconClassName: NAVBAR_BENTO_TINTS.violet, mock: "blog" },
  "/changelog/notra": {
    iconClassName: NAVBAR_BENTO_TINTS.indigo,
    mock: "changelog",
  },
  "/contributors": {
    iconClassName: NAVBAR_BENTO_TINTS.amber,
    mock: "contributors",
  },
};

export const NAVBAR_RESOURCES_LINK_STYLES: Record<
  string,
  NavbarBentoLinkStyle<NavbarResourcesMock>
> = {
  "https://www.usenotra.com/docs": {
    className: "grow-[1.25]",
    copyClassName: "w-44",
    mock: "docs",
  },
  "https://www.notrareviews.com/": {
    className: "grow",
    copyClassName: "w-48",
    mock: "reviews",
  },
};

export const NAVBAR_RESOURCES_FALLBACK_LINK_STYLE = {
  className: "grow",
  copyClassName: "w-48",
} as const;

export const NAVBAR_RESOURCES_POSTS: readonly NavbarResourcesPost[] = [
  {
    title: "How to build a Muse connector",
    description:
      "Turn your MCP server into a Meta Muse connector and submit it to the directory.",
    authorSlug: "dominik",
    date: "Oct 7",
  },
  {
    title:
      "Connect Google Search Console and track your ranking queries across AI engines",
    description:
      "Sync your ranking queries weekly and see them surface as prompt suggestions.",
    authorSlug: "jan",
    date: "Sep 16",
  },
];

export const NAVBAR_RESOURCES_RELEASE_TYPES = {
  feat: "border-[#DDCFFC] bg-[#F1EBFE] text-[#6D3FD9]",
  fix: "border-[#F2DABA] bg-[#FDF3E7] text-[#A8601A]",
} as const;

export const NAVBAR_RESOURCES_RELEASES: readonly NavbarResourcesRelease[] = [
  {
    date: "Oct 10",
    type: "feat",
    title: "AI traffic from Vercel log drains and Cloudflare Logpush",
  },
  {
    date: "Oct 10",
    type: "feat",
    title: "Web search toggle in the offering check",
  },
  {
    date: "Oct 10",
    type: "feat",
    title: "Brand icons in report summaries",
  },
  {
    date: "Oct 10",
    type: "fix",
    title: "Deployment timeline bars grow in real time",
  },
];

const GITHUB_AVATAR = "https://avatars.githubusercontent.com/u";

export const NAVBAR_RESOURCES_PULL_REQUESTS: readonly NavbarResourcesPullRequest[] =
  [
    {
      login: "mezotv",
      avatar: `${GITHUB_AVATAR}/68947960?s=64`,
      title: "Ingest AI traffic from Vercel log drains",
      number: 1609,
    },
    {
      login: "janburzinski",
      avatar: `${GITHUB_AVATAR}/156842394?s=64`,
      title: "Brand icons in report named-first summaries",
      number: 1603,
    },
    {
      login: "mezotv",
      avatar: `${GITHUB_AVATAR}/68947960?s=64`,
      title: "Web search toggle in the offering check",
      number: 1607,
    },
    {
      login: "janburzinski",
      avatar: `${GITHUB_AVATAR}/156842394?s=64`,
      title: "Toggle web trend series in the dashboard",
      number: 1601,
    },
  ];

export const NAVBAR_RESOURCES_DOCS_PAGES = [
  "Quickstart",
  "GEO SDK",
  "MCP server",
  "CLI",
  "API reference",
] as const;

export const NAVBAR_RESOURCES_REVIEW_LINES = ["w-44", "w-32", "w-38"] as const;
