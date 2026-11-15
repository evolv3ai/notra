import {
  GitPullRequestIcon,
  Loading03Icon,
  Rocket01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { StatusBadgeAppearance } from "@notra/ui/types/status-badge";

import type {
  FeatureDetailCopy,
  FeatureStageImage,
} from "@/types/feature-detail-page";
import type { FaqContent } from "@/types/landing/faq";
import type {
  JsonToken,
  SitesConfigCard,
  SitesDeploymentStatus,
  SitesDeploymentsCard,
  SitesDomainStatus,
  SitesDomainsCard,
  SitesEnvironment,
  SitesFilesCard,
  SitesStagePost,
  SitesStatusBadge,
} from "@/types/sites-page";

export const SITES_PAGE: FeatureDetailCopy = {
  meta: {
    path: "/features/sites",
    title: "Sites",
    description:
      "Notra Sites hosts your blog and changelog from MDX files in your GitHub repository, with a preview for every pull request, your own domain and pages AI engines can read.",
    ogImageKey: "features",
  },
  heroSubtitle:
    "Write posts as MDX in your repository. Notra builds every push and hosts your blog and changelog on blog.acme.com or acme.com/blog.",
  signupSource: "feature_sites",
  overview: {
    heading: "Everything a blog needs, nothing to run",
    description:
      "Notra builds, hosts and serves the site. You write posts and merge pull requests.",
    facts: [],
  },
  steps: {
    heading: "From repository to live blog",
    items: [
      {
        title: "Import your repository",
        description:
          "Install the Notra GitHub App and pick the repository. Posts go in blog/ and changelog entries in changelog/.",
      },
      {
        title: "Merge the starter PR",
        description:
          "Notra opens a pull request with your logo, colors and links from Brand Identity. Merge it and the site is live.",
      },
      {
        title: "Add your domain",
        description:
          "Point blog.acme.com at Notra, or serve acme.com/blog with a rewrite from the website you already run.",
      },
    ],
  },
  cta: {
    heading: "Ship your blog like you ship code",
    subcopy:
      "Import a repository from your dashboard and your first post is live in minutes.",
  },
};

export const SITES_HEADLINE = {
  before: "Push to",
  mark: "GitHub,",
  after: "and your blog is live.",
} as const;

export const SITES_FAQ: FaqContent = {
  heading: "Frequently asked questions",
  subcopy: "What to know before you import a repository.",
  items: [
    {
      id: "sites-access",
      question: "Can I use Notra Sites today?",
      answer:
        "Yes. Sites is available in every workspace. Open Sites in the dashboard and import a repository to get started.",
      defaultOpen: true,
    },
    {
      id: "sites-repository",
      question: "Do I need a special repository?",
      answer:
        "No. Use a new repository or a folder in an existing one, including a monorepo. Notra only reads the site folder with blog/, changelog/ and an optional blog.json, and never runs your app's build.",
      defaultOpen: false,
    },
    {
      id: "sites-domain",
      question: "Can the blog live at acme.com/blog?",
      answer:
        "Yes. Serve it under a path with a rewrite from the website you already run, with guides for Vercel, Next.js, Netlify, Cloudflare and nginx, or point a subdomain like blog.acme.com at Notra.",
      defaultOpen: false,
    },
    {
      id: "sites-previews",
      question: "Can I see a post before it goes live?",
      answer:
        "Yes. Every pull request gets a private preview link, and the GitHub check lists any build error with the file and line to fix. Merging switches the whole site live at once.",
      defaultOpen: false,
    },
    {
      id: "sites-design",
      question: "Will it look like the rest of my website?",
      answer:
        "Set colors, fonts, layout and navigation in blog.json, add your own header, footer and CSS, and use your own React components in posts.",
      defaultOpen: false,
    },
    {
      id: "sites-agents",
      question: "Can AI engines read my posts?",
      answer:
        "Every page has a Markdown version, and each site ships llms.txt, sitemaps, RSS and structured data without any setup.",
      defaultOpen: false,
    },
  ],
};

export const SITES_DEPLOYMENTS_CARD = {
  copy: {
    title: "A preview for every pull request",
    description:
      "Each pull request gets its own private link and a GitHub check. Merging to main switches the whole site live at once.",
  },
  frame: { heading: "Deployments", subhead: "usenotra.com/blog" },
  headers: {
    deployment: "Deployment",
    environment: "Environment",
    status: "Status",
  },
  rows: [
    {
      title: "Add the Composio launch post",
      sha: "a1f3c9e",
      branch: "composio-post",
      environment: "Preview",
      status: "building",
    },
    {
      title: "Publish the Claude Code tracking post",
      sha: "7be20d4",
      branch: "main",
      environment: "Production",
      status: "ready",
      duration: "21s",
      live: true,
    },
    {
      title: "Fix a typo in the demo post",
      sha: "3c9d011",
      branch: "main",
      environment: "Production",
      status: "ready",
      duration: "18s",
    },
  ],
  live: "Live",
} as const satisfies SitesDeploymentsCard;

export const SITES_DEPLOYMENT_BADGES = {
  ready: {
    label: "Ready",
    appearance: { variant: "success", icon: Tick02Icon, square: true },
  },
  building: {
    label: "Building",
    appearance: { variant: "warning", icon: Loading03Icon, spin: true },
  },
} as const satisfies Record<SitesDeploymentStatus, SitesStatusBadge>;

export const SITES_ENVIRONMENT_ICONS = {
  Production: Rocket01Icon,
  Preview: GitPullRequestIcon,
} as const satisfies Record<SitesEnvironment, IconSvgElement>;

export const SITES_DOMAINS_CARD = {
  copy: {
    title: "On your domain, or under /blog",
    description:
      "Point a subdomain at Notra, or serve acme.com/blog with one rewrite from the website you already run. SSL is included.",
  },
  frame: { heading: "Domains", subhead: "3 connected" },
  headers: { domain: "Domain", setup: "Setup", status: "Status" },
  rows: [
    { domain: "usenotra.com/blog", setup: "Vercel rewrite", status: "active" },
    { domain: "blog.acme.com", setup: "CNAME", status: "active" },
    { domain: "changelog.acme.com", setup: "CNAME", status: "verifying" },
  ],
} as const satisfies SitesDomainsCard;

export const SITES_DOMAIN_BADGES = {
  active: {
    label: "Active",
    appearance: { variant: "success", icon: Tick02Icon, square: true },
  },
  verifying: {
    label: "Verifying",
    appearance: { variant: "info", icon: Loading03Icon, spin: true },
  },
} as const satisfies Record<SitesDomainStatus, SitesStatusBadge>;

export const SITES_FILES_CARD = {
  copy: {
    title: "Readable by AI engines",
    description:
      "Every page also answers as clean Markdown, and every deploy writes llms.txt, sitemaps and RSS. There's nothing to set up.",
  },
  frame: { heading: "Generated files", subhead: "Written on every deploy" },
  headers: { file: "File", reader: "Read by" },
  rows: [
    { file: "/blog/llms.txt", reader: "AI engines" },
    {
      file: "/blog/notra-is-now-available-on-composio.md",
      reader: "AI engines",
    },
    { file: "/blog/sitemap.xml", reader: "Search engines" },
    { file: "/blog/rss.xml", reader: "Feed readers" },
  ],
} as const satisfies SitesFilesCard;

export const SITES_CONFIG_CARD = {
  copy: {
    title: "Looks like the rest of your website",
    description:
      "Set colors, fonts and navigation in blog.json, add your own header and CSS, and use your own React components in posts.",
  },
  frame: {
    heading: "Site config",
    subhead: "blog.json, checked on every push",
  },
  source: `{
  "name": "Notra",
  "colors": { "primary": "#8B5CF6" },
  "fonts": { "family": "Inter" },
  "appearance": "system",
  "background": { "decoration": "grid" },
  "navbar": {
    "links": [{ "label": "Product", "href": "/" }]
  }
}`,
} as const satisfies SitesConfigCard;

export const SITES_JSON_TOKEN_CLASS = {
  key: "text-[#7C3AED] dark:text-[#C4B5FD]",
  string: "text-[#15803D] dark:text-[#86EFAC]",
  literal: "text-[#C2410C] dark:text-[#FDBA74]",
  punctuation: "text-muted-foreground",
} as const satisfies Record<JsonToken["kind"], string>;

export const SITES_STAGE_IMAGE: FeatureStageImage = {
  src: "/features/sites/stage-sunset.webp",
  author: "892509844tc",
  authorUrl: "https://pixabay.com/users/892509844tc-1493763/",
  photoUrl:
    "https://pixabay.com/photos/the-scenery-sunset-yellow-pink-sky-977226/",
};

export const SITES_STAGE_PUSH = {
  file: "blog/composio.mdx",
  branch: "main",
} as const;

export const SITES_STAGE_BADGES = {
  published: "Published",
  live: "Live",
  publishedAppearance: {
    variant: "success",
    icon: Tick02Icon,
    square: true,
  } satisfies StatusBadgeAppearance,
} as const;

export const SITES_STAGE_POSTS: SitesStagePost[] = [
  {
    title: "Notra is now available on Composio",
    excerpt:
      "Our GEO and AEO tools are now on Composio, so ChatGPT, Claude and Cursor can use them.",
    author: "Dominik Koch",
    avatar: "/blog/authors/dominik.png",
    date: "Oct 21",
    path: "/blog/notra-is-now-available-on-composio",
    fresh: true,
  },
  {
    title: "We now track what Claude Code, Codex and OpenCode say about you",
    excerpt:
      "A developer asking Claude Code to add a rate limiter is making a buying decision.",
    author: "Jan Burzinski",
    avatar: "/blog/authors/jan.webp",
    date: "Oct 19",
    path: "/blog/we-now-track-what-claude-code-codex-and-opencode-say-about-you",
  },
  {
    title: "How we built demo.usenotra.com",
    excerpt:
      "Every visitor gets their own Notra workspace in 0.4 seconds, without signing up.",
    author: "Jan Burzinski",
    avatar: "/blog/authors/jan.webp",
    date: "Oct 12",
    path: "/blog/how-we-built-the-notra-demo",
  },
];

export const SITES_STAGE_OUTPUTS = {
  label: "Served on usenotra.com/blog with",
  items: ["Markdown", "llms.txt", "RSS", "Sitemap"],
} as const;
