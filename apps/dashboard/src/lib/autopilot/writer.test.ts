import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { MockLanguageModelV4 } from "ai/test";

if (process.env.NOTRA_AUTOPILOT_WRITER_TEST !== "1") {
  test("Autopilot writer rejects incomplete output and retries only once", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: { PATH: process.env.PATH, NOTRA_AUTOPILOT_WRITER_TEST: "1" },
        timeout: 30_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  });
} else {
  const contents: string[] = [];
  let limited = false;
  let brokenJson = false;
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: brokenJson
            ? '{"content":"Cut off'
            : JSON.stringify({
                slug: "csv",
                extension: "md",
                title: "CSV",
                content: contents.shift() ?? "Still unfinished and",
                pullRequestBody: "Explains CSV exports.",
              }),
        },
      ],
      finishReason: { unified: limited ? "length" : "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
  mock.module("@notra/ai/gateway", () => ({ gateway: () => model }));
  mock.module("@notra/ai/utils/tcc", () => ({
    buildTelemetryOptions: () => ({}),
  }));
  mock.module("@notra/ai/tools/sitemap", () => ({
    createGetSitemapPagesTool: () => undefined,
    createFetchSitemapPageTool: () => undefined,
  }));
  mock.module("@/lib/autopilot/github", () => ({
    readRepositoryFile: async () => null,
  }));
  const { createOctokit } = await import("@notra/ai/utils/octokit");
  const { writeBlogPost } = await import("./writer");
  const noop = async () => undefined;
  const usage = mock(noop);
  const rejected = mock(noop);
  const repository = { owner: "sandbox", name: "website", branch: "main" };
  const params = {
    decisionMemory: { sha: null, rules: [], feedback: [] },
    ctx: {
      organizationId: "sandbox",
      organizationSlug: "sandbox",
      runId: "run",
      projectId: null,
      repository,
      contentPath: "content/blog",
      jobs: {
        readiness: true,
        keywords: true,
        commits: true,
        prompts: true,
        competitors: true,
      },
      maxOpenPullRequests: 3,
      stalePullRequestDays: null,
      commitFilters: { excludedAuthors: [], paths: {} },
      brand: null,
    },
    log: {
      info: noop,
      skip: noop,
      decision: noop,
      action: noop,
      error: rejected,
      trace: noop,
    },
    octokit: createOctokit("fixture"),
    repository,
    baseSha: "base",
    paths: [],
    directory: "content/blog",
    postPaths: [],
    sample: null,
    brief: {
      topic: "CSV exports",
      angle: "Explain the workflow",
      evidence: "Exports use current filters.",
    },
    onUsage: usage,
  };
  beforeEach(() => {
    contents.length = 0;
    model.doGenerateCalls.length = 0;
    limited = false;
    brokenJson = false;
    usage.mockClear();
    rejected.mockClear();
  });
  test("returns complete output without another call", async () => {
    contents.push("A complete article.");
    expect((await writeBlogPost(params)).content).toBe("A complete article.");
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(usage).toHaveBeenCalledTimes(1);
  });
  test("rewrites a syntactically valid but unfinished article once and records both usages", async () => {
    contents.push("Two people exporting the ", "A complete rewrite.");
    expect((await writeBlogPost(params)).content).toBe("A complete rewrite.");
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain(
      "Rewrite the entire file"
    );
    expect(usage).toHaveBeenCalledTimes(2);
    expect(rejected).toHaveBeenCalledTimes(1);
  });
  test("fails closed when both attempts are incomplete", async () => {
    contents.push("Two people exporting the ", "Still unfinished and");
    await expect(writeBlogPost(params)).rejects.toThrow(
      "Incomplete blog draft"
    );
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(usage).toHaveBeenCalledTimes(2);
  });
  test("does not accept token-limited output just because it ends in a full stop", async () => {
    limited = true;
    contents.push("A complete sentence.", "Another complete sentence.");
    await expect(writeBlogPost(params)).rejects.toThrow(
      "finish reason: length"
    );
    expect(model.doGenerateCalls).toHaveLength(2);
  });
  test("retries token-truncated JSON once and still records its usage", async () => {
    limited = true;
    brokenJson = true;
    await expect(writeBlogPost(params)).rejects.toThrow(
      "finish reason: length"
    );
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(usage).toHaveBeenCalledTimes(2);
  });
}
