import type { DemoConsolePreset } from "@/types/demo";

export const DEMO_CONSOLE_UNIQUE_TOKEN = "{unique}";
export const DEMO_CONSOLE_UNIQUE_LENGTH = 6;

export const DEMO_CONSOLE_PRESETS: readonly DemoConsolePreset[] = [
  {
    id: "listPosts",
    section: "content",
    method: "GET",
    path: "/v1/posts?limit=5",
  },
  {
    id: "createPost",
    section: "content",
    method: "POST",
    path: "/v1/posts",
    body: {
      title: "Hello from the Notra API",
      contentType: "blog_post",
      status: "draft",
      markdown:
        "Created with **one API call** from the demo console. Open Content to see it.",
    },
  },
  {
    id: "createPrompt",
    section: "geo",
    method: "POST",
    path: "/v1/projects/{projectId}/geo/prompts",
    body: {
      prompt: "Which meeting notes app has the best Slack integration?",
      tags: ["integrations"],
    },
  },
  {
    id: "startScan",
    section: "geo",
    method: "POST",
    path: "/v1/projects/{projectId}/geo/scans",
    body: {},
  },
  {
    id: "visibility",
    section: "geo",
    method: "GET",
    path: "/v1/projects/{projectId}/geo/visibility/overview?days=30",
  },
  {
    id: "traffic",
    section: "traffic",
    method: "GET",
    path: "/v1/projects/{projectId}/geo/traffic/overview?days=30",
  },
  {
    id: "listSchedules",
    section: "automation",
    method: "GET",
    path: "/v1/schedules",
  },
  {
    id: "createSkill",
    section: "skills",
    method: "POST",
    path: "/v1/skills",
    body: {
      name: "launch-checklist-{unique}",
      description:
        "Check every launch post covers who, what and how to try it.",
      content:
        "# Launch checklist\n\nSay who the feature is for, what changed and how to try it today.",
    },
  },
];

export const DEMO_CONSOLE_METHODS = ["GET", "POST", "PATCH", "DELETE"] as const;

export const DEMO_CONSOLE_SECTION_BY_SEGMENT: Readonly<Record<string, string>> =
  {
    geo: "geo",
    traffic: "traffic",
    content: "content",
    automation: "automation",
    skills: "skills",
  };
