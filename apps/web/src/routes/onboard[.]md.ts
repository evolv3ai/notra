import { createFileRoute } from "@tanstack/react-router";

import { markdownResponse } from "@/utils/http";
import { APP_URL, DOCS_URL, MCP_URL, SITE_URL } from "@/utils/urls";

// Commands an agent can run without prompts. The /mcp page keeps its own,
// shorter commands for people.
const addMcp = (agent: string) =>
  `npx -y add-mcp ${MCP_URL} --agent ${agent} --name notra --global --yes`;

const ONBOARD_MD = `# Connect an AI agent to Notra

You are an AI agent setting up Notra for your user. Notra shows how ChatGPT, Claude, Gemini and other AI engines answer the questions buyers ask, and writes content in the user's brand voice. Go through the steps in order, say what you are doing and stop whenever you need the user.

If you can already call Notra tools such as \`whoami\`, skip to step 3.

## 1. Add the MCP server

The server is \`${MCP_URL}\` (streamable HTTP). Run the command for your client:

- Claude Code: \`claude mcp add --transport http --scope user notra ${MCP_URL}\`
- Codex: \`codex mcp add notra --url ${MCP_URL}\`
- Cursor: \`${addMcp("cursor")}\`
- OpenCode: \`${addMcp("opencode")}\`
- Other agents: find your agent's name with \`npx -y add-mcp list-agents\`, then run \`${addMcp("<name>")}\`

In ChatGPT, Claude.ai or Claude Desktop you can't run commands. Ask the user to add a custom connector with the URL \`${MCP_URL}\` in their settings.

## 2. Sign in

Notra signs in with OAuth in the browser. Ask the user to pick the organization named in their prompt and Full access, so you can create projects. If they don't have an account yet, they can sign up at ${APP_URL} first.

- Claude Code: ask the user to restart Claude Code, run \`/mcp\`, select notra and choose Authenticate.
- Codex: run \`codex mcp login notra\`.
- Cursor: ask the user to open Cursor Settings, find notra under MCP and sign in.
- OpenCode: run \`opencode mcp auth notra\`.
- Other clients open the sign-in page the first time a Notra tool is used.

New MCP servers usually only load in a new session. If you can't call \`whoami\` yet, ask the user to restart their client and paste the same prompt again. You will pick up at step 3.

Without a browser, for example in CI or on a remote machine, use an API key: the user creates one under API Keys in the Notra dashboard and stores it in \`NOTRA_API_KEY\`. Never ask them to paste it into the chat. Send it as \`Authorization: Bearer <key>\`. Config examples per client: ${DOCS_URL}/devtools/mcp. Full auth details: ${SITE_URL}/auth.md.

## 3. Check the connection

Call \`whoami\`. If the prompt named an organization, the workspace must match it: compare the slug in parentheses after the name, or the name if there is no slug. If it doesn't match, stop and ask the user to sign in again with that organization, because everything you create goes into the connected workspace. On a 401, go back to step 2.

Then call \`list_projects\`. If it says the plan doesn't include GEO, tell the user and offer to draft content in their brand voice instead, with \`list_brand_identities\` and \`generate_post\`.

## 4. Show something useful

- A project exists: summarize \`get_geo_visibility_overview\`: how often the brand shows up in AI answers, where it's missing and which competitors show up instead. Then suggest what to write next from \`list_geo_content_gaps\`.
- No project yet: ask for the user's website and find its brand identity with \`list_brand_identities\`. If none matches, create one with \`generate_brand_identity\` and wait for \`get_brand_identity_generation_status\`. Create the project with \`create_project\`, passing that identity's ID as \`brandSettingsId\`. Then propose competitors with \`suggest_geo_competitors\` and add the ones the user picks with \`upsert_geo_competitor\`. A new project has no visibility data until its first scan.

\`create_geo_scan\`, \`run_geo_sequence\` and \`plan_geo_content_brief\` use AI credits and can take minutes. Always ask before running them.

## 5. Wrap up

In a few lines, tell the user that Notra is connected, what you found and two or three things you can do next, such as checking every week how AI engines answer questions about them and their competitors, or drafting a post for their biggest content gap.

If any step didn't work, report it with the \`submit_feedback\` tool. It needs no credentials.
`;

function GET() {
  return markdownResponse(ONBOARD_MD);
}

export const Route = createFileRoute("/onboard.md")({
  server: { handlers: { GET } },
});
