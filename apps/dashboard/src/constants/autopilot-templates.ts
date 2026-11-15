import {
  GitBranchIcon,
  Robot01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import type {
  AutopilotTemplate,
  AutopilotTemplateCategory,
} from "@/types/autopilot-templates";

export const AUTOPILOT_TEMPLATE_CATEGORIES: Record<
  AutopilotTemplateCategory,
  string
> = {
  site: "Site fixes",
  content: "Self-updating content",
  releases: "Releases and docs",
};

export const AUTOPILOT_TEMPLATE_TONES: Record<
  string,
  "destructive" | "info" | "success" | "warning"
> = {
  readiness: "info",
  keywords: "warning",
  commits: "success",
};

export const AUTOPILOT_TEMPLATES: AutopilotTemplate[] = [
  {
    id: "readiness",
    kind: "readiness",
    name: "Fix agent readiness",
    description:
      "Rescans your site and opens a pull request for llms.txt, AI crawler rules and structured data.",
    instructions:
      "Run the Agent Readiness scan. For every failing check that can be fixed in the repository, open one pull request with the fix.",
    category: "site",
    icon: Robot01Icon,
    source: "Agent Readiness scan",
    output: "pull_request",
    trigger: "run",
  },
  {
    id: "keywords",
    kind: "keywords",
    name: "Write for content gaps",
    description:
      "Drafts a post for prompts and searches where competitors show up and you don't.",
    instructions:
      "Pick the prompt or search with the highest volume where competitors are mentioned and you aren't. Draft a post that answers it.",
    category: "content",
    icon: Search01Icon,
    source: "Prompts and searches you lose",
    output: "post",
    trigger: "run",
  },
  {
    id: "commits",
    kind: "commits",
    name: "Write about releases",
    description:
      "Drafts a post when you ship something worth telling users about.",
    instructions:
      "Read the pull requests merged since the last run. When one is something new users need explained, draft a post about it.",
    category: "releases",
    icon: GitBranchIcon,
    source: "Pull requests you ship",
    output: "post",
    trigger: "merge",
  },
];
