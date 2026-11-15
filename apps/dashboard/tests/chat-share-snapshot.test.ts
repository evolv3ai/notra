import { expect, test } from "bun:test";

import type { ChatUIMessage } from "@notra/ai/types/chat";

import { buildChatShareSnapshot } from "../src/utils/chat-share-snapshot";

const messages = [
  {
    id: "u1",
    role: "user",
    metadata: { authorUserId: "user_secret" },
    parts: [
      {
        type: "text",
        text: "Write about @integration/github/int_123/acme/api please",
      },
      {
        type: "file",
        url: "https://files.example.com/private/key.pdf?sig=abc",
        mediaType: "application/pdf",
        filename: "roadmap.pdf",
      },
    ],
  },
  {
    id: "a1",
    role: "assistant",
    metadata: { model: "anthropic/claude", inputTokens: 1200 },
    parts: [
      { type: "reasoning", text: "internal reasoning" },
      {
        type: "tool-webSearch",
        toolCallId: "t1",
        state: "output-available",
        input: { query: "acme internal" },
        output: { results: [{ url: "https://internal.acme.dev" }] },
      },
      {
        type: "tool-getGithubCommits",
        toolCallId: "t2",
        state: "output-available",
        input: {},
        output: { commits: ["secret commit"] },
      },
      {
        type: "tool-createBlogPost",
        toolCallId: "t3",
        state: "output-available",
        input: { title: "Launch", markdown: "# Launch\n\nWe shipped." },
        output: { postId: "post_1" },
      },
      { type: "text", text: "Done, see @post/post_1." },
    ],
  },
] as unknown as ChatUIMessage[];

test("keeps text, posts, file names and tool names only", () => {
  expect(buildChatShareSnapshot(messages)).toEqual([
    {
      id: "m0",
      role: "user",
      parts: [
        { id: "m0:0", type: "text", text: "Write about @acme/api please" },
        {
          id: "m0:1",
          type: "file",
          filename: "roadmap.pdf",
          mediaType: "application/pdf",
        },
      ],
    },
    {
      id: "m1",
      role: "assistant",
      parts: [
        { id: "m1:0", type: "tools", names: ["webSearch", "getGithubCommits"] },
        {
          id: "m1:1",
          type: "post",
          contentType: "blog_post",
          title: "Launch",
          markdown: "# Launch\n\nWe shipped.",
        },
        { id: "m1:2", type: "text", text: "Done, see @Launch." },
      ],
    },
  ]);
});

test("never copies tool payloads, reasoning, metadata or file URLs", () => {
  const serialized = JSON.stringify(buildChatShareSnapshot(messages));
  for (const secret of [
    "acme internal",
    "internal.acme.dev",
    "secret commit",
    "internal reasoning",
    "user_secret",
    "anthropic/claude",
    "sig=abc",
    "int_123",
    "post_1",
    "u1",
    "a1",
  ]) {
    expect(serialized).not.toContain(secret);
  }
});

test("drops posts the user discarded", () => {
  const snapshot = buildChatShareSnapshot([
    {
      id: "a2",
      role: "assistant",
      parts: [
        {
          type: "tool-createLinkedInPost",
          toolCallId: "t9",
          state: "output-denied",
          input: { title: "Draft", markdown: "Nope" },
        },
      ],
    },
  ] as unknown as ChatUIMessage[]);
  expect(snapshot).toEqual([]);
});

test("labels tokens inside annotation passages and notes", () => {
  const [message] = buildChatShareSnapshot([
    {
      id: "u2",
      role: "user",
      parts: [
        {
          type: "text",
          text: '<annotations>\n<annotation n="1" post="@post/post_1" title="Launch">\n<passage>See @integration/github/int_9/acme/web</passage>\n<note>Compare with @post/post_1</note>\n</annotation>\n</annotations>\n\nShorter please',
        },
      ],
    },
  ] as unknown as ChatUIMessage[]);
  const serialized = JSON.stringify(message);
  expect(serialized).toContain("> See @acme/web");
  expect(serialized).not.toContain("int_9");
  expect(serialized).not.toContain("post_1");
});

test("names the known tools a code-mode script called, never the script", () => {
  const snapshot = buildChatShareSnapshot([
    {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-code_mode",
          toolCallId: "t1",
          state: "output-available",
          input: {
            js: 'await tools.webSearch({ query: "acme internal" }); await tools.secretHelper();',
          },
          output: {},
        },
      ],
    },
  ] as unknown as ChatUIMessage[]);
  expect(snapshot[0]?.parts).toEqual([
    { id: "m0:0", type: "tools", names: ["webSearch"] },
  ]);
});
