import { cn } from "cn";

import type {
  WorkflowLogoConfig,
  WorkflowLogoName,
  WorkflowLogoProps,
} from "../types/workflow";
import {
  AhrefsLogo,
  AnthropicLogo,
  BrowserbaseLogo,
  ClaudeLogo,
  ContextDevLogo,
  DeepSeekLogo,
  FirecrawlLogo,
  GeminiLogo,
  GitHubLogo,
  GmailLogo,
  GoogleLogo,
  GoogleSheetsLogo,
  GrokLogo,
  LinearLogo,
  MistralLogo,
  NotionLogo,
  OpenAILogo,
  PerplexityLogo,
  PostHogLogo,
  ResendLogo,
  SlackLogo,
  WebflowLogo,
  WordPressLogo,
} from "./workflow-logos";

export const WORKFLOW_LOGOS: Record<WorkflowLogoName, WorkflowLogoConfig> = {
  ahrefs: { label: "Ahrefs", logo: AhrefsLogo },
  anthropic: { label: "Anthropic", logo: AnthropicLogo },
  browserbase: { label: "Browserbase", logo: BrowserbaseLogo, tile: true },
  claude: { label: "Claude", logo: ClaudeLogo },
  deepseek: { label: "DeepSeek", logo: DeepSeekLogo },
  "context-dev": { label: "context.dev", logo: ContextDevLogo, tile: true },
  firecrawl: { label: "Firecrawl", logo: FirecrawlLogo },
  gemini: { label: "Gemini", logo: GeminiLogo },
  github: { label: "GitHub", logo: GitHubLogo },
  gmail: { label: "Gmail", logo: GmailLogo },
  google: { label: "Google", logo: GoogleLogo },
  "google-sheets": { label: "Google Sheets", logo: GoogleSheetsLogo },
  grok: { label: "Grok", logo: GrokLogo },
  linear: { label: "Linear", logo: LinearLogo },
  mistral: { label: "Mistral", logo: MistralLogo },
  notion: { label: "Notion", logo: NotionLogo },
  openai: { label: "OpenAI", logo: OpenAILogo },
  perplexity: { label: "Perplexity", logo: PerplexityLogo },
  posthog: { label: "PostHog", logo: PostHogLogo },
  resend: { label: "Resend", logo: ResendLogo },
  slack: { label: "Slack", logo: SlackLogo },
  webflow: { label: "Webflow", logo: WebflowLogo },
  wordpress: { label: "WordPress", logo: WordPressLogo },
};

export const WorkflowLogo = ({
  className,
  name,
  ...props
}: WorkflowLogoProps) => {
  const Logo = WORKFLOW_LOGOS[name].logo;
  return (
    <Logo
      className={cn("size-4 shrink-0 overflow-visible", className)}
      data-slot="workflow-logo"
      {...props}
    />
  );
};
