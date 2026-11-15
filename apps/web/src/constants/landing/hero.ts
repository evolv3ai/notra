import { ClaudeAiIcon } from "@notra/ui/components/ui/svgs/claudeAiIcon";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { Slack } from "@notra/ui/components/ui/svgs/slack";

import type { HeroCycleWord, HeroVariantCopy } from "@/types/landing/hero";

export const HERO_HEADLINE_LINE_ONE = "Be the answer when";

export const HERO_HEADLINE_LINE_TWO_PREFIX = "buyers ask";

export const HERO_HEADLINE_SUFFIX = ".";

export const HERO_HEADLINE_CYCLE: HeroCycleWord[] = [
  { text: "ChatGPT", engine: "chatgpt" },
  { text: "Claude", engine: "claude" },
  { text: "Perplexity", engine: "perplexity" },
  { text: "Gemini", engine: "gemini" },
  { text: "Grok", engine: "grok" },
  { text: "Kimi", engine: "kimi" },
];

export const HERO_HEADLINE_CYCLE_MOBILE = HERO_HEADLINE_CYCLE.filter(
  (word) => word.text.length <= 7
);

export const HERO_HEADLINE_CYCLE_MS = 2600;

export const HERO_SUBHEAD =
  "Notra is a GEO tool that asks ChatGPT, Claude and Gemini the questions your buyers ask. It shows whether you appear, who appears instead and how to fix it.";

const HERO_BOOK_A_CALL_HREF = "/contact";

const HERO_CLAUDE_CONNECTOR_HREF = "https://claude.ai/directory/notra";

const HERO_CHATGPT_APP_HREF =
  "https://chatgpt.com/plugins/plugin_asdk_app_6ad054bf08248191a320ed1334e3ffde";

export const HERO_EXPERIMENT_FLAG = "landing-hero";

export const HERO_CONTROL_VARIANT = "control";

export const HERO_VARIANTS: Record<string, HeroVariantCopy> = {
  [HERO_CONTROL_VARIANT]: {
    headlineLineOne: HERO_HEADLINE_LINE_ONE,
    headlineLineTwoPrefix: HERO_HEADLINE_LINE_TWO_PREFIX,
    subhead: HERO_SUBHEAD,
    cta: "Start for free",
    secondaryLabel: "Book a Call",
    secondaryHref: HERO_BOOK_A_CALL_HREF,
  },
  visibility: {
    headlineLineOne: "See if you show up",
    headlineLineTwoPrefix: "in",
    subhead:
      "See which prompts your buyers ask AI, whether you show up in the answer and exactly what to publish to win the ones you lose.",
    cta: "Check your AI visibility",
    secondaryLabel: "Book a Call",
    secondaryHref: HERO_BOOK_A_CALL_HREF,
  },
  slack: {
    headlineLineOne: {
      before: "Use",
      icon: Slack,
      name: "Slack",
      after: "to show up",
    },
    headlineLineTwoPrefix: "in",
    subhead:
      "Ask Notra in Slack how your brand shows up in ChatGPT, Claude and Gemini. It replies in the thread with the prompts you lose and drafts the pages that win them back, ready to approve without leaving Slack.",
    cta: "Add Notra to Slack",
    secondaryLabel: "See the Slack app",
    secondaryHref: "/integrations/slack",
  },
  claude: {
    headlineLineOne: {
      before: "Ask",
      icon: ClaudeAiIcon,
      name: "Claude",
      after: "if buyers",
    },
    headlineLineTwoPrefix: "find you in",
    subhead:
      "Notra is a verified Claude connector. Ask Claude where your brand appears in AI answers, who shows up instead and what to publish next, all from the chat you already use.",
    cta: "Start for free",
    secondaryLabel: "Add to Claude",
    secondaryHref: HERO_CLAUDE_CONNECTOR_HREF,
  },
  "claude-expert": {
    headlineLineOne: {
      before: "Turn",
      icon: ClaudeAiIcon,
      name: "Claude",
      after: "into an",
    },
    headlineLineTwo: "SEO & GEO expert",
    subhead:
      "Connect Notra to Claude and ask how your brand shows up in ChatGPT, Claude and Gemini. Claude finds the prompts you lose and drafts the pages that win them back.",
    cta: "Start for free",
    secondaryLabel: "Add to Claude",
    secondaryHref: HERO_CLAUDE_CONNECTOR_HREF,
  },
  chatgpt: {
    headlineLineOne: {
      before: "Ask",
      icon: Openai,
      iconClassName: "dark:fill-white",
      name: "ChatGPT",
      after: "if buyers",
    },
    headlineLineTwoPrefix: "find you in",
    subhead:
      "Notra is a ChatGPT app. Ask ChatGPT where your brand appears in AI answers, who shows up instead and what to publish next, all from the chat you already use.",
    cta: "Start for free",
    secondaryLabel: "Add to ChatGPT",
    secondaryHref: HERO_CHATGPT_APP_HREF,
  },
  "chatgpt-expert": {
    headlineLineOne: {
      before: "Turn",
      icon: Openai,
      iconClassName: "dark:fill-white",
      name: "ChatGPT",
      after: "into an",
    },
    headlineLineTwo: "SEO & GEO expert",
    subhead:
      "Connect Notra to ChatGPT and ask how your brand shows up in ChatGPT, Claude and Gemini. ChatGPT finds the prompts you lose and drafts the pages that win them back.",
    cta: "Start for free",
    secondaryLabel: "Add to ChatGPT",
    secondaryHref: HERO_CHATGPT_APP_HREF,
  },
};

export const HERO_SIGNUP_SOURCE = "hero";

export const HERO_PREVIEW_VARIANT_PARAM = "hero_variant";

export const HERO_PREVIEW_ENABLED = import.meta.env.DEV;
