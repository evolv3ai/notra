import { describe, expect, test } from "bun:test";

import { withRouterDefaults } from "@notra/ai/provider-options";
import { createOpenRouterAdapter } from "@notra/ai/router/adapters/openrouter";
import { createVercelAdapter } from "@notra/ai/router/adapters/vercel";
import { createModelRouter } from "@notra/ai/router/create-router";
import {
  createCaptureLogger,
  createPolicy,
} from "@notra/ai/router/test-helpers";
import { promptCacheTelemetry } from "@notra/ai/utils/prompt-cache-telemetry";
import { generateText, streamText } from "ai";

import { getContentEditorChatPrompt } from "./content-editor";
import { getStandaloneChatPrompt } from "./standalone-chat";

describe("cacheable chat instructions", () => {
  test("standalone rules stay identical across workspaces, skills, timezones and integrations", () => {
    const plain = getStandaloneChatPrompt({
      hasGitHubEnabled: false,
      hasLinearEnabled: false,
      hasMcpEnabled: false,
      timezone: "UTC",
    });
    const contextual = getStandaloneChatPrompt({
      hasGitHubEnabled: true,
      hasCodeResearch: true,
      hasLinearEnabled: true,
      hasMcpEnabled: true,
      timezone: "Europe/Berlin",
      workspace: {
        organization: {
          id: "org_fixture",
          name: "Fixture workspace",
          slug: "fixture",
        },
        project: { id: "project_fixture", name: "Fixture project" },
      },
      skillSummaries: [
        { name: "fixture-voice", description: "Fixture voice guidance" },
      ],
      repoContext: [
        { integrationId: "github_fixture", owner: "fixture", repo: "site" },
      ],
      linearContext: [
        { integrationId: "linear_fixture", teamName: "Fixture team" },
      ],
      mcpContext: [{ integrationId: "mcp_fixture", name: "Fixture MCP" }],
      toolDescriptions: ["Fixture capabilities"],
    });

    expect(contextual[0]).toEqual(plain[0]);
    expect(contextual[0]?.content).not.toContain("## Current Date");
    expect(contextual[0]?.content).toContain("## Tool Workflow");
    for (const value of [
      "Europe/Berlin",
      "Fixture workspace",
      "project_fixture",
      "fixture-voice",
      "github_fixture",
      "linear_fixture",
      "mcp_fixture",
      "Fixture capabilities",
    ]) {
      expect(contextual[1]?.content).toContain(value);
      expect(contextual[0]?.content).not.toContain(value);
    }
    expect(contextual[1]?.providerOptions).toBeUndefined();
  });

  test("editor context changes do not invalidate rules and content-specific constraints remain", () => {
    const plain = getContentEditorChatPrompt({ contentType: "twitter_post" });
    const contextual = getContentEditorChatPrompt({
      contentType: "twitter_post",
      timezone: "Asia/Tokyo",
      selection: {
        startLine: 1,
        startChar: 0,
        endLine: 2,
        endChar: 10,
        text: "Fixture selection",
      },
      hasGitHubEnabled: true,
      repoContext: [{ integrationId: "github_fixture" }],
      toolDescriptions: ["Fixture capabilities"],
    });
    expect(contextual[0]).toEqual(plain[0]);
    expect(contextual[0]?.content).toContain("## Twitter Post Constraints");
    expect(contextual[0]?.content).toContain("ALWAYS call getMarkdown first");
    for (const value of [
      "Asia/Tokyo",
      "Fixture selection",
      "github_fixture",
      "Fixture capabilities",
    ]) {
      expect(contextual[1]?.content).toContain(value);
      expect(contextual[0]?.content).not.toContain(value);
    }
    expect(
      getContentEditorChatPrompt({ documentMode: "plan" })[0]?.content
    ).toContain("Do NOT write the article body");
  });

  for (const gateway of ["vercel", "openrouter"] as const) {
    for (const operation of ["generate", "stream"] as const) {
      test(`${gateway} ${operation} preserves the cache boundary through the SDK and router`, async () => {
        const instructions = getStandaloneChatPrompt({
          hasGitHubEnabled: false,
          hasLinearEnabled: false,
          hasMcpEnabled: false,
        });
        const bodies: Record<string, unknown>[] = [];
        const config = {
          apiKey: "fixture",
          fetch: async (_url: unknown, init?: RequestInit) => {
            bodies.push(JSON.parse(String(init?.body)));
            if (gateway === "vercel") {
              const result = {
                content: [{ type: "text", text: "Fixture answer" }],
                finishReason: { unified: "stop", raw: "stop" },
                usage: {
                  inputTokens: {
                    total: 2000,
                    noCache: 100,
                    cacheRead: 1900,
                    cacheWrite: 0,
                  },
                  outputTokens: { total: 2, text: 2, reasoning: 0 },
                },
                warnings: [],
              };
              return operation === "generate"
                ? Response.json(result)
                : new Response(
                    `data: ${JSON.stringify({ type: "finish", finishReason: result.finishReason, usage: result.usage })}\n\n`,
                    { headers: { "Content-Type": "text/event-stream" } }
                  );
            }
            const result = {
              id: "gen_fixture",
              model: "anthropic/claude-sonnet-5",
              choices: [
                {
                  index: 0,
                  finish_reason: "stop",
                  ...(operation === "generate"
                    ? {
                        message: {
                          role: "assistant",
                          content: "Fixture answer",
                        },
                      }
                    : { delta: { content: "Fixture answer" } }),
                },
              ],
              usage: {
                prompt_tokens: 2000,
                completion_tokens: 2,
                total_tokens: 2002,
                prompt_tokens_details: { cached_tokens: 1900 },
              },
            };
            return operation === "generate"
              ? Response.json(result)
              : new Response(
                  `data: ${JSON.stringify(result)}\n\ndata: [DONE]\n\n`,
                  { headers: { "Content-Type": "text/event-stream" } }
                );
          },
        };
        const logger = createCaptureLogger();
        const adapter =
          gateway === "vercel"
            ? createVercelAdapter(config)
            : createOpenRouterAdapter(config);
        const router = createModelRouter({
          adapters: { [gateway]: adapter },
          policy: createPolicy(),
          resolvePlan: async () => "paid",
          logger,
        });
        const options = {
          model: router.model("anthropic/claude-sonnet-5", { gateway }),
          instructions,
          prompt: "Fixture user request",
          providerOptions: withRouterDefaults(undefined, {
            fallbackModels: [],
          }),
          maxRetries: 0,
        };
        if (operation === "generate") {
          await generateText(options);
        } else {
          await streamText(options).consumeStream();
        }
        expect(bodies).toHaveLength(1);
        if (gateway === "vercel") {
          expect(bodies[0]?.providerOptions).toMatchObject({
            gateway: {
              caching: "auto",
              zeroDataRetention: true,
              disallowPromptTraining: true,
            },
          });
          expect(bodies[0]?.prompt).toEqual([
            ...instructions,
            {
              role: "user",
              content: [{ type: "text", text: "Fixture user request" }],
            },
          ]);
        } else {
          expect(bodies[0]?.provider).toMatchObject({
            zdr: true,
            data_collection: "deny",
          });
          expect(bodies[0]?.messages).toEqual([
            {
              role: "system",
              content: [
                {
                  type: "text",
                  text: instructions[0]?.content,
                  cache_control: { type: "ephemeral" },
                },
              ],
            },
            {
              role: "system",
              content: [{ type: "text", text: instructions[1]?.content }],
            },
            { role: "user", content: "Fixture user request" },
          ]);
        }
        const started = logger.entries.find(
          ({ event }) => event === "ai.call.started"
        );
        expect(started?.fields?.firstSystemMessageHash).toMatch(
          /^[a-f0-9]{64}$/
        );
        expect(started?.fields?.toolDefinitionsHash).toMatch(/^[a-f0-9]{64}$/);
        expect(started?.fields?.promptMessageCount).toBe(3);
        expect(started?.fields?.assistantMessageCount).toBe(0);
        expect(JSON.stringify(logger.entries)).not.toContain(
          "Fixture user request"
        );
        expect(
          logger.entries.some(({ event }) => event === "ai.call.completed")
        ).toBe(true);
      });
    }
  }

  test("diagnostic hashes detect changes to shared rules and tools, not later context", () => {
    const options = {
      prompt: [
        { role: "system" as const, content: "Shared rules" },
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "Private request" }],
        },
      ],
      tools: [
        {
          type: "function" as const,
          name: "fixture",
          inputSchema: { type: "object" as const },
        },
      ],
    };
    const baseline = promptCacheTelemetry(options);
    expect(
      promptCacheTelemetry({
        ...options,
        prompt: [
          { role: "system", content: "Shared rules" },
          { role: "user", content: [{ type: "text", text: "Other request" }] },
        ],
      })
    ).toEqual(baseline);
    expect(
      promptCacheTelemetry({
        ...options,
        prompt: [{ role: "system", content: "New rules" }],
      }).firstSystemMessageHash
    ).not.toBe(baseline.firstSystemMessageHash);
    expect(
      promptCacheTelemetry({ ...options, tools: [] }).toolDefinitionsHash
    ).not.toBe(baseline.toolDefinitionsHash);
    expect(
      promptCacheTelemetry({ prompt: [] }).firstSystemMessageHash
    ).toBeUndefined();
  });
});
