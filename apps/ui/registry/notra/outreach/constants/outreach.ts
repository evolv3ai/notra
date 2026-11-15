import type {
  OutreachDraft,
  OutreachProspect,
  OutreachStat,
  OutreachStatus,
  OutreachStatusConfig,
  OutreachStepStatus,
  OutreachVariable,
} from "../types/outreach";

export const OUTREACH_STATUSES: Record<OutreachStatus, OutreachStatusConfig> = {
  declined: { className: "text-muted-foreground", label: "Declined" },
  drafted: {
    className: "text-violet-600 dark:text-violet-300",
    label: "Drafted",
  },
  found: { className: "text-muted-foreground", label: "Found" },
  listed: {
    className: "text-emerald-600 dark:text-emerald-400",
    label: "Listed",
  },
  opened: { className: "text-sky-600 dark:text-sky-400", label: "Opened" },
  replied: {
    className: "text-amber-600 dark:text-amber-400",
    label: "Replied",
  },
  sent: { className: "text-blue-600 dark:text-blue-400", label: "Sent" },
};

export const OUTREACH_STEP_STATUSES: Record<
  OutreachStepStatus,
  OutreachStatusConfig
> = {
  cancelled: { className: "bg-muted-foreground/40", label: "Cancelled" },
  opened: { className: "bg-sky-500", label: "Opened" },
  replied: { className: "bg-amber-500", label: "Replied" },
  scheduled: {
    className: "bg-background ring-1 ring-foreground/25",
    label: "Scheduled",
  },
  sent: { className: "bg-blue-500", label: "Sent" },
};

export const OUTREACH_MODEL = "gpt-5";

export const OUTREACH_STATS: OutreachStat[] = [
  {
    hint: "Cited by an AI answer this month",
    label: "Listicles found",
    value: "37",
  },
  { hint: "12 waiting for a follow-up", label: "Pitches sent", value: "21" },
  { hint: "Industry average is 8%", label: "Reply rate", value: "28.6%" },
  { hint: "+4 citations in ChatGPT since", label: "Now listed", value: "5" },
];

export const OUTREACH_PROSPECTS: OutreachProspect[] = [
  {
    citations: [
      { engine: "openai", prompts: 9 },
      { engine: "perplexity", prompts: 6 },
      { engine: "gemini", prompts: 3 },
    ],
    competitors: [
      { name: "Beamer", position: 1 },
      { name: "LaunchNotes", position: 2 },
      { name: "Headway", position: 4 },
    ],
    contact: {
      email: "maya@example.com",
      name: "Maya Lindqvist",
      role: "Editor",
      source: "Author bio",
    },
    domain: "saasbase.dev",
    domainRating: 71,
    id: "saasbase",
    sequence: [
      {
        at: "Oct 20",
        day: 0,
        id: "s1",
        status: "opened",
        subject: "Notra for your changelog roundup",
      },
      {
        at: "Oct 23",
        day: 3,
        id: "s2",
        status: "replied",
        subject: "Re: Notra for your changelog roundup",
      },
    ],
    status: "replied",
    title: "The 12 best changelog tools in 2026",
    updatedAt: "2h ago",
    url: "https://saasbase.dev/best-changelog-tools",
  },
  {
    citations: [
      { engine: "perplexity", prompts: 7 },
      { engine: "openai", prompts: 2 },
    ],
    competitors: [
      { name: "LaunchNotes", position: 1 },
      { name: "Beamer", position: 3 },
    ],
    contact: {
      email: "jonas@example.com",
      name: "Jonas Meyer",
      role: "Founder",
      source: "Contact page",
    },
    domain: "devtools.fm",
    domainRating: 64,
    id: "devtools",
    sequence: [
      {
        at: "Oct 22",
        day: 0,
        id: "s1",
        status: "opened",
        subject: "A release-notes tool for your list",
      },
      {
        at: "Oct 25",
        day: 3,
        id: "s2",
        status: "scheduled",
        subject: "Quick follow-up",
      },
      {
        at: "Oct 29",
        day: 7,
        id: "s3",
        status: "scheduled",
        subject: "Last note from me",
      },
    ],
    status: "opened",
    title: "Top release notes apps for dev teams",
    updatedAt: "Yesterday",
    url: "https://devtools.fm/top-release-notes-apps",
  },
  {
    citations: [
      { engine: "gemini", prompts: 5 },
      { engine: "grok", prompts: 2 },
    ],
    competitors: [
      { name: "Headway", position: 2 },
      { name: "Beamer", position: 5 },
    ],
    contact: {
      email: "editor@example.com",
      name: "Priya Raman",
      role: "Managing editor",
      source: "Masthead",
    },
    domain: "productledhq.com",
    domainRating: 58,
    id: "productled",
    sequence: [
      {
        at: "Oct 24",
        day: 0,
        id: "s1",
        status: "sent",
        subject: "Changelog automation for your guide",
      },
      {
        at: "Oct 27",
        day: 3,
        id: "s2",
        status: "scheduled",
        subject: "Quick follow-up",
      },
    ],
    status: "sent",
    title: "9 product update tools that save PMs time",
    updatedAt: "Yesterday",
    url: "https://productledhq.com/product-update-tools",
  },
  {
    citations: [{ engine: "openai", prompts: 4 }],
    competitors: [{ name: "LaunchNotes", position: 3 }],
    contact: {
      email: "sam@example.com",
      name: "Sam Okafor",
      role: "Writer",
      source: "Author bio",
    },
    domain: "shipfaster.io",
    domainRating: 47,
    id: "shipfaster",
    sequence: [],
    status: "drafted",
    title: "How to write release notes people read (+ 7 tools)",
    updatedAt: "3h ago",
    url: "https://shipfaster.io/release-notes-guide",
  },
  {
    citations: [
      { engine: "perplexity", prompts: 3 },
      { engine: "claude", prompts: 2 },
    ],
    competitors: [
      { name: "Beamer", position: 1 },
      { name: "Headway", position: 2 },
    ],
    contact: {
      email: "hello@example.com",
      name: "Lea Fischer",
      role: "Owner",
      source: "WHOIS",
    },
    domain: "indiestack.co",
    domainRating: 39,
    id: "indiestack",
    sequence: [],
    status: "found",
    title: "Best tools for indie SaaS founders: changelogs",
    updatedAt: "Just now",
    url: "https://indiestack.co/changelog-tools",
  },
  {
    citations: [{ engine: "openai", prompts: 6 }],
    competitors: [
      { name: "Notra", position: 3 },
      { name: "Beamer", position: 1 },
    ],
    contact: {
      email: "tom@example.com",
      name: "Tom Becker",
      role: "Editor",
      source: "Author bio",
    },
    domain: "growthnotes.com",
    domainRating: 66,
    id: "growthnotes",
    sequence: [
      {
        at: "Oct 2",
        day: 0,
        id: "s1",
        status: "replied",
        subject: "Notra for your roundup",
      },
    ],
    status: "listed",
    title: "The changelog stack for growth teams",
    updatedAt: "Oct 9",
    url: "https://growthnotes.com/changelog-stack",
  },
];

export const OUTREACH_VARIABLES: OutreachVariable[] = [
  { key: "first_name", label: "First name", value: "Maya" },
  {
    key: "listicle_title",
    label: "Listicle",
    value: "The 12 best changelog tools in 2026",
  },
  { key: "company", label: "Company", value: "Notra" },
  {
    key: "proof_point",
    label: "Proof point",
    value: "a weekly changelog takes minutes instead of an afternoon",
  },
];

export const OUTREACH_DRAFTS: OutreachDraft[] = [
  {
    body: `Hi {{first_name}},

I read "{{listicle_title}}" while researching how teams pick a changelog tool. It's one of the pages ChatGPT and Perplexity quote most for that question.

I work on {{company}}. It turns merged pull requests into changelog posts and release notes, so {{proof_point}}.

Would you consider adding it to the list? Happy to send a demo account, screenshots or anything else that makes it easy.

Thanks,
Alex`,
    subject: "{{company}} for {{listicle_title}}",
    to: "",
  },
  {
    body: `Hi {{first_name}},

Quick one: your roundup "{{listicle_title}}" is cited in AI answers for "best changelog tool", and {{company}} is missing from it.

We're an AI changelog writer for dev teams; {{proof_point}}. If it's a fit, I can send everything you need for a write-up, no strings attached.

Best,
Alex`,
    subject: "A missing pick for {{listicle_title}}?",
    to: "",
  },
];

export const OUTREACH_MAX_COMPETITORS = 4;

export const OUTREACH_REWRITE_MS = 1200;

export const OUTREACH_SEND_MS = 900;

export const OUTREACH_PITCHABLE = new Set<OutreachStatus>([
  "declined",
  "drafted",
  "found",
]);
