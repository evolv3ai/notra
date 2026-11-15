import type { IconSvgElement } from "@hugeicons/react";

export type McpUseCaseCategoryId =
  | "strategy-research"
  | "content-creation"
  | "reporting-automation"
  | "analytics-monitoring";

export interface McpUseCaseCategory {
  id: McpUseCaseCategoryId;
  label: string;
  icon: IconSvgElement;
}

export interface McpUseCaseCategoryFilter {
  id: McpUseCaseCategoryId | "all";
  label: string;
  icon?: IconSvgElement;
}

export type McpUseCaseToolId =
  | "notra"
  | "claude"
  | "chatgpt"
  | "gemini"
  | "perplexity"
  | "google-search-console"
  | "slack"
  | "github"
  | "linear"
  | "linkedin"
  | "x";

interface McpUseCaseAuthor {
  name: string;
  url?: string;
}

export interface McpUseCase {
  slug: string;
  title: string;
  tagline: string;
  category: McpUseCaseCategoryId;
  stack: McpUseCaseToolId[];
  prompt: string;
  tools: string[];
  body: string[];
  author?: McpUseCaseAuthor;
}

export interface McpUseCaseCardProps {
  entry: McpUseCase;
}

export interface McpUseCaseStackProps {
  stack: McpUseCaseToolId[];
  size?: "sm" | "md";
  className?: string;
}

export interface McpUseCaseToolIconProps {
  toolId: McpUseCaseToolId;
  className?: string;
}

export interface McpUseCaseCategoryPillProps {
  icon: IconSvgElement;
  label: string;
  className?: string;
}

export interface McpUseCaseToolBadgeProps {
  toolId: McpUseCaseToolId;
  label?: string;
  className?: string;
}

export interface McpUseCasesBrowserProps {
  useCases: McpUseCase[];
  categories: McpUseCaseCategoryFilter[];
}

export interface McpUseCasePromptBlockProps {
  entry: McpUseCase;
}

export interface McpUseCaseDetailViewProps {
  entry: McpUseCase;
  related: McpUseCase[];
}

export interface McpUseCaseMarkdownEntry {
  slug: string;
  title: string;
  description: string;
}
