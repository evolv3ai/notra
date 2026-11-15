import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("agent content PRs reuse dashboard publishing with organization-bound drafts and no approval", () => {
  const route = fileURLToPath(
    new URL(
      "../src/app/api/internal/content/draft-pull-request/route.ts",
      import.meta.url
    )
  );
  const result = spawnSync(
    process.execPath,
    [
      "--no-env-file",
      "--eval",
      `
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { ORPCError } from "@orpc/server";
import { PgDialect } from "drizzle-orm/pg-core";
let post = { contentType: "blog_post" };
let allowed = true;
let publishError;
const lookups = [], publishes = [], subscriptions = [], limits = [];
process.env.INTERNAL_WORKFLOW_SECRET = "fixture-secret";
process.env.UPSTASH_REDIS_REST_URL = "https://unused.invalid";
process.env.UPSTASH_REDIS_REST_TOKEN = "fixture-token";
mock.module("@notra/ai/qstash/triggers", () => ({ getBaseUrl: () => "https://dashboard.invalid" }));
mock.module("@notra/ai/utils/server-log", () => ({ logError: () => {} }));
mock.module("@notra/db/drizzle", () => ({ db: { query: { posts: { findFirst: async (query) => {
  lookups.push(new PgDialect().sqlToQuery(query.where).params);
  return post;
} } } } }));
mock.module("@/lib/workflows/internal-auth", () => ({ verifyInternalWorkflowRequest: async (request) => request.headers.get("authorization") === "Bearer fixture-secret" }));
mock.module("@/lib/billing/subscription", () => ({ assertActiveSubscription: async (id) => { subscriptions.push(id); } }));
mock.module("@/lib/integrations/github/publish-saved-content", () => ({ publishSavedContentToGitHub: async (input) => {
  if (publishError) throw publishError;
  publishes.push(input);
  return { branchName: "notra/blog-draft", headSha: "sha-1", path: "blog/draft.md", operation: publishes.length > 1 ? "updated" : "created", pullRequestNumber: 42, pullRequestUrl: "https://github.com/example/repo/pull/42" };
} }));
mock.module("@/utils/ratelimit", () => ({ ratelimit: { githubPublish: { limit: async (key) => { limits.push(key); return { success: allowed }; } } } }));
const { POST } = await import(${JSON.stringify(route)});
const { createCreateContentPullRequestTool } = await import(${JSON.stringify(fileURLToPath(new URL("../../../packages/tools/src/assistant/create-content-pull-request.ts", import.meta.url)))});
const tool = createCreateContentPullRequestTool();
assert.equal(tool.approval, undefined);
const outbound = [];
globalThis.fetch = async (url, init) => {
  outbound.push({ url, init });
  return POST(new Request(url, init));
};
const ctx = { session: { auth: { current: { attributes: { organizationId: "org-trusted" } } } } };
const input = { postId: "post-1", integrationId: "repo-1", organizationId: "org-forged", path: ".github/workflows/evil.yml" };
const first = await tool.execute(input, ctx);
const second = await tool.execute(input, ctx);
assert.equal(first.pullRequestUrl, "https://github.com/example/repo/pull/42");
assert.equal(first.operation, "created");
assert.equal(second.operation, "updated");
assert.equal(second.pullRequestUrl, first.pullRequestUrl);
assert.deepEqual(publishes[0], { organizationId: "org-trusted", contentId: "post-1", contentType: "blog_post", repositoryId: "repo-1" });
assert.deepEqual(lookups[0], ["post-1", "org-trusted"]);
assert.equal(subscriptions[0], "org-trusted");
assert.equal(limits[0], "agent:org-trusted");
assert.equal(outbound[0].url, "https://dashboard.invalid/api/internal/content/draft-pull-request");
post = { contentType: "changelog" };
await tool.execute(input, ctx);
assert.equal(publishes.at(-1).contentType, "changelog");
const count = publishes.length;
post = { contentType: "twitter_post" };
await assert.rejects(() => tool.execute(input, ctx), /Only blog posts and changelogs/);
post = null;
await assert.rejects(() => tool.execute(input, ctx), /Post not found/);
post = { contentType: "blog_post" };
allowed = false;
await assert.rejects(() => tool.execute(input, ctx), /Too many GitHub publish requests/);
allowed = true;
publishError = new ORPCError("FORBIDDEN", { message: "Publishing is paused for this repository" });
await assert.rejects(() => tool.execute(input, ctx), /Publishing is paused/);
assert.equal(publishes.length, count);
const body = JSON.stringify({ postId: "post-1", integrationId: "repo-1", organizationId: "org-trusted" });
assert.equal((await POST(new Request("https://dashboard.invalid", { method: "POST", body }))).status, 401);
assert.equal((await POST(new Request("https://dashboard.invalid", { method: "POST", headers: { authorization: "Bearer fixture-secret" }, body: "{}" }))).status, 400);
process.env.INTERNAL_WORKFLOW_SECRET = "";
await assert.rejects(() => tool.execute(input, ctx), /not configured/);
`,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      timeout: 30_000,
      encoding: "utf8",
    }
  );
  expect(result.status, result.stderr).toBe(0);
});
