import { MCP_OAUTH_FETCH_TIMEOUT_MS } from "../constants/mcp-auth";
import { McpOAuthAuthorizationError } from "../integrations/mcp-oauth-errors";
import { fetchPublicMcpUrl } from "./public-fetch";

export async function publicMcpOAuthFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const url = input instanceof Request ? input.url : input.toString();
  if (URL.parse(url)?.protocol !== "https:") {
    throw new McpOAuthAuthorizationError({
      message: "OAuth endpoints must use HTTPS.",
    });
  }
  return fetchPublicMcpUrl(input, init, MCP_OAUTH_FETCH_TIMEOUT_MS);
}
