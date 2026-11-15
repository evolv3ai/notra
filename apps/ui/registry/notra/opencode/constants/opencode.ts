import type {
  OpencodeActivityKind,
  OpencodeMcpServer,
  OpencodeMcpStatus,
} from "../types/opencode";

export const OPENCODE_DEFAULT_AGENT = "Build";

export const OPENCODE_DEFAULT_MODEL = "Writer 0.1";

export const OPENCODE_DEFAULT_PROVIDER = "Notra";

export const OPENCODE_DEFAULT_EFFORT = "high";

export const OPENCODE_DEFAULT_PLACEHOLDER =
  'Ask anything... "Draft this week\'s changelog"';

export const OPENCODE_DEFAULT_VERSION = "1.18.33";

export const OPENCODE_DEFAULT_CWD = "~/acme/web";

export const OPENCODE_DEFAULT_SERVERS: OpencodeMcpServer[] = [
  { name: "notra", status: "Connected" },
  { name: "github", status: "Connected" },
  { name: "linear", status: "Connected" },
];

export const OPENCODE_MCP_STATUS_CLASS: Record<OpencodeMcpStatus, string> = {
  Connected: "text-opencode-green",
  Disconnected: "text-opencode-muted",
  Failed: "text-opencode-orange",
};

export const OPENCODE_ACTIVITY_GLYPH: Record<OpencodeActivityKind, string> = {
  read: "→",
  search: "◈",
  thought: "",
  tool: "⚙",
};

export const OPENCODE_ACTIVITY_LABEL: Record<OpencodeActivityKind, string> = {
  read: "Read",
  search: "Web Search",
  thought: "Thought",
  tool: "Tool",
};

export const OPENCODE_THINKING_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

export const OPENCODE_THINKING_FRAME_MS = 80;

export const OPENCODE_PROGRESS_CELLS = 8;

export const OPENCODE_PROGRESS_FRAME_MS = 90;

export const OPENCODE_PROGRESS_TRAIL = [1, 0.55, 0.32, 0.18] as const;

export const OPENCODE_SEARCH_HEADER_MS = 140;

export const OPENCODE_SEARCH_QUERY_MS = 280;

export const OPENCODE_SEARCH_STAGGER_MS = 56;

export const OPENCODE_SEARCH_SOURCES_MS = 160;

export const OPENCODE_CHAT_TIMING = {
  thinkMs: 1300,
  toolMs: 600,
  blockMs: 260,
  reducedMaxMs: 60,
} as const;

export const OPENCODE_REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const OPENCODE_LOGO_ROWS = [
  ".................................c.....",
  "oooo.oooo.oooo.ooo..cccc.cccc.cccc.cccc",
  "o++o.o++o.o++o.o..o.c....c++c.c++c.c++c",
  "o++o.o++o.oooo.o..o.c....c++c.c++c.cccc",
  "o++o.oooo.o....o..o.c....c++c.c++c.c...",
  "oooo.o....oooo.o..o.cccc.cccc.cccc.cccc",
  ".....o.................................",
] as const;

export const OPENCODE_LOGO_CELL = 6;
