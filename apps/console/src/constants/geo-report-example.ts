import type { GeoReport, GeoReportListItem } from "@/types/geo-report";

/**
 * Example report used until report generation is wired to a backend.
 * Company and competitors are real domains so Logo Link resolves; the
 * numbers and quotes are illustrative.
 */
export const EXAMPLE_GEO_REPORT: GeoReport = {
  id: "example-resend",
  status: "ready",
  company: {
    name: "Resend",
    domain: "resend.com",
    category: "Transactional email API",
  },
  preparedAt: "2026-08-31T00:00:00.000Z",
  preparedBy: "Notra",
  modelIds: [
    "gpt-5-6-sol",
    "claude-opus-5",
    "gemini-3-7-flash",
    "grok-4-6",
    "kimi-k3",
    "glm-5-3",
    "deepseek-v4-pro",
  ],
  summary: {
    visibilityScore: 58,
    shareOfVoice: 0.21,
    shareOfVoiceRank: 3,
    sentimentScore: 4.2,
    citations: 37,
  },
  prompts: [
    {
      id: "p1",
      text: "Best transactional email API for developers",
      intent: "best-of",
      ranks: {
        "gpt-5-6-sol": 2,
        "claude-opus-5": 1,
        "gemini-3-7-flash": 4,
        "grok-4-6": 3,
        "kimi-k3": 2,
        "glm-5-3": null,
        "deepseek-v4-pro": 3,
      },
    },
    {
      id: "p2",
      text: "How do I send emails from a Next.js app?",
      intent: "how-to",
      ranks: {
        "gpt-5-6-sol": 1,
        "claude-opus-5": 1,
        "gemini-3-7-flash": 1,
        "grok-4-6": 1,
        "kimi-k3": 1,
        "glm-5-3": 2,
        "deepseek-v4-pro": 1,
      },
    },
    {
      id: "p3",
      text: "Alternatives to SendGrid",
      intent: "alternatives",
      ranks: {
        "gpt-5-6-sol": 4,
        "claude-opus-5": 3,
        "gemini-3-7-flash": null,
        "grok-4-6": null,
        "kimi-k3": 5,
        "glm-5-3": null,
        "deepseek-v4-pro": null,
      },
    },
    {
      id: "p4",
      text: "Which email provider has the best deliverability?",
      intent: "best-of",
      ranks: {
        "gpt-5-6-sol": null,
        "claude-opus-5": null,
        "gemini-3-7-flash": null,
        "grok-4-6": null,
        "kimi-k3": null,
        "glm-5-3": null,
        "deepseek-v4-pro": null,
      },
    },
    {
      id: "p5",
      text: "Resend vs Postmark",
      intent: "comparison",
      ranks: {
        "gpt-5-6-sol": 1,
        "claude-opus-5": 1,
        "gemini-3-7-flash": 1,
        "grok-4-6": 1,
        "kimi-k3": 1,
        "glm-5-3": 1,
        "deepseek-v4-pro": 1,
      },
    },
    {
      id: "p6",
      text: "Email API with React email templates",
      intent: "best-of",
      ranks: {
        "gpt-5-6-sol": 1,
        "claude-opus-5": 1,
        "gemini-3-7-flash": 2,
        "grok-4-6": 1,
        "kimi-k3": 1,
        "glm-5-3": 1,
        "deepseek-v4-pro": 2,
      },
    },
    {
      id: "p7",
      text: "Cheapest email API for startups",
      intent: "pricing",
      ranks: {
        "gpt-5-6-sol": null,
        "claude-opus-5": 3,
        "gemini-3-7-flash": null,
        "grok-4-6": null,
        "kimi-k3": 4,
        "glm-5-3": null,
        "deepseek-v4-pro": null,
      },
    },
    {
      id: "p8",
      text: "Best email service for SaaS onboarding emails",
      intent: "best-of",
      ranks: {
        "gpt-5-6-sol": null,
        "claude-opus-5": null,
        "gemini-3-7-flash": null,
        "grok-4-6": 4,
        "kimi-k3": null,
        "glm-5-3": null,
        "deepseek-v4-pro": null,
      },
    },
    {
      id: "p9",
      text: "How to send email from a Vercel serverless function",
      intent: "how-to",
      ranks: {
        "gpt-5-6-sol": 1,
        "claude-opus-5": 1,
        "gemini-3-7-flash": 1,
        "grok-4-6": 2,
        "kimi-k3": 1,
        "glm-5-3": 3,
        "deepseek-v4-pro": 1,
      },
    },
    {
      id: "p10",
      text: "Email API with webhooks and event tracking",
      intent: "best-of",
      ranks: {
        "gpt-5-6-sol": null,
        "claude-opus-5": 4,
        "gemini-3-7-flash": null,
        "grok-4-6": null,
        "kimi-k3": null,
        "glm-5-3": null,
        "deepseek-v4-pro": null,
      },
    },
    {
      id: "p11",
      text: "Mailgun vs Resend",
      intent: "comparison",
      ranks: {
        "gpt-5-6-sol": 1,
        "claude-opus-5": 1,
        "gemini-3-7-flash": 1,
        "grok-4-6": 1,
        "kimi-k3": 1,
        "glm-5-3": 2,
        "deepseek-v4-pro": 1,
      },
    },
    {
      id: "p12",
      text: "Is Resend production ready for high volume?",
      intent: "branded",
      ranks: {
        "gpt-5-6-sol": 1,
        "claude-opus-5": 1,
        "gemini-3-7-flash": 1,
        "grok-4-6": 1,
        "kimi-k3": 1,
        "glm-5-3": 1,
        "deepseek-v4-pro": 1,
      },
    },
  ],
  competitors: [
    {
      id: "sendgrid",
      name: "SendGrid",
      domain: "sendgrid.com",
      shareOfVoice: 0.27,
      mentionRate: 0.74,
      winsOn: "Deliverability and enterprise scale questions",
    },
    {
      id: "postmark",
      name: "Postmark",
      domain: "postmarkapp.com",
      shareOfVoice: 0.24,
      mentionRate: 0.69,
      winsOn: "Deliverability, onboarding and lifecycle email",
    },
    {
      id: "mailgun",
      name: "Mailgun",
      domain: "mailgun.com",
      shareOfVoice: 0.14,
      mentionRate: 0.48,
      winsOn: "Pricing and inbound parsing",
    },
    {
      id: "ses",
      name: "Amazon SES",
      domain: "aws.amazon.com",
      shareOfVoice: 0.09,
      mentionRate: 0.41,
      winsOn: "Cheapest per email, AWS-native stacks",
    },
    {
      id: "loops",
      name: "Loops",
      domain: "loops.so",
      shareOfVoice: 0.05,
      mentionRate: 0.19,
      winsOn: "SaaS onboarding sequences",
    },
  ],
  perceptions: [
    {
      modelId: "gpt-5-6-sol",
      sentiment: "positive",
      mentionRate: 0.58,
      quote:
        "If you're on React or Next.js, Resend is the easy pick. Small SDK, React Email templates work out of the box, setup takes a few minutes. For big marketing sends most teams still go with SendGrid or SES.",
      claims: [
        { id: "c1", text: "Native React Email support", status: "accurate" },
        {
          id: "c2",
          text: "Free tier: 3,000 emails per month",
          status: "accurate",
        },
        { id: "c3", text: "No dedicated IPs available", status: "outdated" },
        { id: "c4", text: "Broadcast / marketing emails", status: "missing" },
      ],
    },
    {
      modelId: "claude-opus-5",
      sentiment: "positive",
      mentionRate: 0.67,
      quote:
        "For a new project I'd start with Resend. The API is tiny, the docs are good, and with React Email your templates sit next to your components. If deliverability is the thing you care about most, Postmark is still the safer bet.",
      claims: [
        { id: "c5", text: "Native React Email support", status: "accurate" },
        { id: "c6", text: "Webhooks for delivery events", status: "accurate" },
        { id: "c7", text: "Multi-region sending", status: "accurate" },
        {
          id: "c8",
          text: "Audience and broadcast features",
          status: "missing",
        },
      ],
    },
    {
      modelId: "gemini-3-7-flash",
      sentiment: "neutral",
      mentionRate: 0.42,
      quote:
        "Resend is a newer email API that JavaScript developers like. Setup is easy. It has fewer features than SendGrid, which has marketing campaigns, analytics and dedicated IPs.",
      claims: [
        {
          id: "c9",
          text: "Popular with JavaScript developers",
          status: "accurate",
        },
        {
          id: "c10",
          text: "Smaller feature set than SendGrid",
          status: "outdated",
        },
        { id: "c11", text: "No dedicated IPs", status: "wrong" },
        { id: "c12", text: "SDKs beyond Node.js", status: "missing" },
      ],
    },
    {
      modelId: "grok-4-6",
      sentiment: "positive",
      mentionRate: 0.5,
      quote:
        "Most indie devs on X are shipping with Resend right now. Nice DX, decent free tier, and React Email on top is hard to beat. If you need SMTP relay at scale, SES is cheaper.",
      claims: [
        { id: "c13", text: "Generous free tier", status: "accurate" },
        { id: "c14", text: "SMTP support", status: "accurate" },
        {
          id: "c15",
          text: "Pricing at 100k emails per month",
          status: "outdated",
        },
        { id: "c16", text: "Deliverability track record", status: "missing" },
      ],
    },
    {
      modelId: "kimi-k3",
      sentiment: "positive",
      mentionRate: 0.58,
      quote:
        "Resend is a developer email API with SDKs for Node, Python, Go, Ruby and PHP, React Email templates and webhooks. G2 reviewers mention fast setup. A few complain there's not much for marketing email.",
      claims: [
        { id: "c17", text: "SDKs for multiple languages", status: "accurate" },
        { id: "c18", text: "Webhooks for delivery events", status: "accurate" },
        { id: "c19", text: "Limited marketing tooling", status: "outdated" },
        { id: "c20", text: "Deliverability benchmarks", status: "missing" },
      ],
    },
    {
      modelId: "glm-5-3",
      sentiment: "mixed",
      mentionRate: 0.25,
      quote:
        "Resend is a lightweight email service for developers. Fine for transactional notifications, but it doesn't have the deliverability tooling, templates or analytics you get with SendGrid or Mailgun.",
      claims: [
        { id: "c21", text: "Aimed at developers", status: "accurate" },
        { id: "c22", text: "Lacks templates", status: "wrong" },
        { id: "c23", text: "Lacks analytics", status: "outdated" },
        { id: "c24", text: "React Email integration", status: "missing" },
      ],
    },
    {
      modelId: "deepseek-v4-pro",
      sentiment: "neutral",
      mentionRate: 0.42,
      quote:
        "Resend has a simple REST API for transactional email, e.g. resend.emails.send({ from, to, subject, react }). The free plan is capped at 100 emails a day and paid plans start at $20 a month.",
      claims: [
        {
          id: "c25",
          text: "Simple REST API with Node SDK",
          status: "accurate",
        },
        {
          id: "c26",
          text: "Free tier daily limit of 100 emails",
          status: "accurate",
        },
        {
          id: "c27",
          text: "Paid plans begin at $20 per month",
          status: "outdated",
        },
        {
          id: "c28",
          text: "Multi-region and dedicated IPs",
          status: "missing",
        },
      ],
    },
  ],
  opportunities: [
    {
      id: "o1",
      prompt: "Which email provider has the best deliverability?",
      occupiedBy: ["postmark", "sendgrid", "ses"],
      gap: "No model mentions Resend. Every answer cites Postmark's published deliverability benchmarks and SendGrid's scale numbers.",
      action:
        "Publish a deliverability page with inbox placement numbers per ISP. Link it from the docs and post it in the r/webdev thread the models already cite.",
      channel: "docs",
    },
    {
      id: "o2",
      prompt: "Best email service for SaaS onboarding emails",
      occupiedBy: ["loops", "postmark", "sendgrid"],
      gap: "Every model treats Resend as transactional only, so onboarding and lifecycle questions go to Loops and Postmark.",
      action:
        "Write an onboarding sequence guide on Broadcasts and Audiences, with a Next.js example people can copy.",
      channel: "docs",
    },
    {
      id: "o3",
      prompt: "Cheapest email API for startups",
      occupiedBy: ["ses", "mailgun", "sendgrid"],
      gap: "5 of 7 models quote old Resend pricing or skip it. SES and Mailgun get the cheap answer.",
      action:
        "Ship a pricing comparison page with a volume calculator, and a changelog post with the current tiers.",
      channel: "comparison-page",
    },
    {
      id: "o4",
      prompt: "Alternatives to SendGrid",
      occupiedBy: ["postmark", "mailgun", "ses"],
      gap: "Resend shows up 3rd to 5th in three models and not at all in four. The listicles they cite (Zapier, G2, dev.to) rank it low or leave it out.",
      action:
        "Get into the top three 'SendGrid alternatives' listicles and publish a SendGrid migration guide.",
      channel: "listicle",
    },
    {
      id: "o5",
      prompt: "Email API with webhooks and event tracking",
      occupiedBy: ["sendgrid", "mailgun", "postmark"],
      gap: "The webhooks exist, but there is no single page the models can point to, so they point to Mailgun's event docs.",
      action:
        "Add an 'Email events and webhooks' docs page with payload examples, plus a sample repo on GitHub.",
      channel: "github",
    },
    {
      id: "o6",
      prompt: "Resend feature set vs established providers",
      occupiedBy: ["sendgrid"],
      gap: "Gemini and GLM describe the product as it was in 2023: no dedicated IPs, no analytics, no marketing tooling.",
      action:
        "Publish a 'what's new' changelog roundup and a short YouTube walkthrough. The retrieval models will pick both up.",
      channel: "changelog",
    },
  ],
  sources: [
    {
      id: "s1",
      domain: "resend.com",
      name: "resend.com/docs",
      share: 0.22,
      brandPresent: true,
    },
    {
      id: "s2",
      domain: "github.com",
      name: "GitHub",
      share: 0.18,
      brandPresent: true,
    },
    {
      id: "s3",
      domain: "reddit.com",
      name: "Reddit",
      share: 0.15,
      brandPresent: false,
    },
    {
      id: "s4",
      domain: "dev.to",
      name: "dev.to",
      share: 0.11,
      brandPresent: true,
    },
    {
      id: "s5",
      domain: "g2.com",
      name: "G2",
      share: 0.1,
      brandPresent: true,
    },
    {
      id: "s6",
      domain: "zapier.com",
      name: "Zapier blog",
      share: 0.09,
      brandPresent: false,
    },
    {
      id: "s7",
      domain: "youtube.com",
      name: "YouTube",
      share: 0.08,
      brandPresent: false,
    },
    {
      id: "s8",
      domain: "news.ycombinator.com",
      name: "Hacker News",
      share: 0.07,
      brandPresent: true,
    },
  ],
};

export const GEO_REPORTS: GeoReportListItem[] = [
  {
    id: EXAMPLE_GEO_REPORT.id,
    company: EXAMPLE_GEO_REPORT.company,
    status: EXAMPLE_GEO_REPORT.status,
    modelsTested: EXAMPLE_GEO_REPORT.modelIds.length,
    promptsTracked: EXAMPLE_GEO_REPORT.prompts.length,
    visibilityScore: EXAMPLE_GEO_REPORT.summary.visibilityScore,
    updatedAt: EXAMPLE_GEO_REPORT.preparedAt,
    kind: "example",
    shareToken: null,
  },
];
