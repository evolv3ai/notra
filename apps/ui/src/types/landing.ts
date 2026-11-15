export type LandingPreview =
  | "ai-overview"
  | "button"
  | "chat-minimap"
  | "chatgpt"
  | "claude"
  | "claude-code"
  | "codex"
  | "composer"
  | "data-table"
  | "duotone-tooltip"
  | "gemini"
  | "icon-tabs"
  | "listicle-outreach"
  | "marketing-button"
  | "opencode"
  | "perplexity"
  | "shimmer"
  | "sonner"
  | "step-slider"
  | "tooltip"
  | "workflow-builder"
  | "workflow-node";

export interface LandingComponentLink {
  description: string;
  href: string;
  preview?: LandingPreview;
  title: string;
}

export interface LandingSection {
  description: string;
  items: LandingComponentLink[];
  title: string;
}

export interface LandingInstallCommand {
  items: string[];
  prefix: string;
}

export interface LandingHero {
  description: string;
  install: LandingInstallCommand;
}
