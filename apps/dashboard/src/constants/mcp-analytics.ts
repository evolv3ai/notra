import type { ChartColorPair } from "@/types/charts";
import type {
  McpOutcomeBadgeVariant,
  McpRpcErrorKey,
  McpServerRequestKey,
} from "@/types/mcp-analytics";

export const MCP_ANALYTICS_NAV_LINK = "/geo/traffic/mcp";

export const JSON_RPC_ERROR_KEYS: Partial<Record<number, McpRpcErrorKey>> = {
  [-32_700]: "parse",
  [-32_600]: "invalidRequest",
  [-32_601]: "methodNotFound",
  [-32_602]: "invalidParams",
  [-32_603]: "internal",
  [-32_002]: "resourceNotFound",
};

export const MCP_ELICITATION_OUTCOME_VARIANTS = {
  accept: "success",
  decline: "warning",
  cancel: "secondary",
} as const satisfies Record<string, McpOutcomeBadgeVariant>;

export const MCP_SERVER_REQUEST_KEYS: Partial<
  Record<string, McpServerRequestKey>
> = {
  "elicitation/create": "elicitation",
  "sampling/createMessage": "sampling",
};

export const MCP_DAILY_SERIES = [
  { key: "toolsCall", label: "tools/call" },
  { key: "resourcesRead", label: "resources/read" },
  { key: "promptsGet", label: "prompts/get" },
  { key: "other", label: "" },
] as const;

export const MCP_SERIES_COLORS: Record<
  (typeof MCP_DAILY_SERIES)[number]["key"],
  ChartColorPair
> = {
  toolsCall: { light: "#8B5CF6", dark: "#9C87E3" },
  resourcesRead: { light: "#18929F", dark: "#20ABBA" },
  promptsGet: { light: "#E89A1C", dark: "#FFB547" },
  other: { light: "#8A8A94", dark: "#9A9AA4" },
};

export const MCP_SERIES_DOT_CLASS: Record<
  (typeof MCP_DAILY_SERIES)[number]["key"],
  string
> = {
  toolsCall: "bg-[#8B5CF6] dark:bg-[#9C87E3]",
  resourcesRead: "bg-[#18929F] dark:bg-[#20ABBA]",
  promptsGet: "bg-[#E89A1C] dark:bg-[#FFB547]",
  other: "bg-[#8A8A94] dark:bg-[#9A9AA4]",
};

export const MCP_LOG_FILTERS = ["all", "success", "errors"] as const;

export const MCP_SETUP_SNIPPET = `import { trackMcpTransport } from "@usenotra/geo/mcp";

await server.connect(
  trackMcpTransport(transport, { token: process.env.NOTRA_GEO_TOKEN ?? "" })
);`;
