import { STATE_OF_AI_SEARCH_PATH } from "@/constants/state-of-ai-search";
import type {
  NavbarBentoLinkStyle,
  NavbarReportsEngine,
} from "@/types/navbar-bento";

export const NAVBAR_REPORTS_OVERVIEW_STYLE: Omit<
  NavbarBentoLinkStyle<string>,
  "mock"
> = {
  className: "grow",
  copyClassName: "w-96",
};

export const NAVBAR_REPORTS_OVERVIEW = {
  href: STATE_OF_AI_SEARCH_PATH,
  description: "Which brands AI recommends, category by category.",
} as const;

export const NAVBAR_REPORTS_ENGINES: readonly NavbarReportsEngine[] = [
  "chatgpt",
  "claude",
  "gemini",
  "perplexity",
  "google",
];
