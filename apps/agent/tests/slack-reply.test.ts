import { describe, expect, test } from "bun:test";

import {
  SLACK_MARKDOWN_TEXT_MAX_LENGTH,
  SLACK_PERMISSION_ERROR_PATTERN,
} from "../agent/lib/constants/slack";
import {
  getErrorId,
  postSlackReply,
  withErrorId,
} from "../agent/lib/utils/slack-reply";

function fakeChannel(threadTs: string, options: { failUpload?: boolean } = {}) {
  const posts: string[] = [];
  const uploads: { filename: string; data: Blob; initialComment?: string }[] =
    [];
  return {
    posts,
    uploads,
    channel: {
      thread: { post: async (text: string) => posts.push(text) },
      slack: {
        threadTs,
        uploadFiles: async (
          files: { filename: string; data: Blob }[],
          uploadOptions?: { initialComment?: string }
        ) => {
          if (options.failUpload) {
            throw new Error("missing_scope");
          }
          for (const file of files) {
            uploads.push({
              filename: file.filename,
              data: file.data,
              initialComment: uploadOptions?.initialComment,
            });
          }
        },
      },
    } as unknown as Parameters<typeof postSlackReply>[0],
  };
}

describe("Slack replies", () => {
  test("short replies are posted as messages", async () => {
    const { channel, posts, uploads } = fakeChannel("1.0");
    await postSlackReply(channel, "Hello");
    expect(posts).toEqual(["Hello"]);
    expect(uploads).toHaveLength(0);
  });

  test("replies over Slack's limit are uploaded as a snippet in the thread", async () => {
    const { channel, posts, uploads } = fakeChannel("1.0");
    const text = "x".repeat(SLACK_MARKDOWN_TEXT_MAX_LENGTH + 1);
    await postSlackReply(channel, text);
    expect(posts).toHaveLength(0);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.filename).toBe("notra-response.md");
    expect(await uploads[0]?.data.text()).toBe(text);
    expect(uploads[0]?.initialComment).toBeDefined();
  });

  test("a failed upload still delivers the whole reply without splitting characters", async () => {
    const { channel, posts } = fakeChannel("1.0", { failUpload: true });
    const text = `${"x".repeat(SLACK_MARKDOWN_TEXT_MAX_LENGTH - 1)}😀${"y".repeat(10)}`;
    await postSlackReply(channel, text);
    expect(posts.join("")).toBe(text);
    expect(posts.length).toBeGreaterThan(1);
    for (const post of posts) {
      expect(post.length).toBeLessThanOrEqual(SLACK_MARKDOWN_TEXT_MAX_LENGTH);
      expect(post.isWellFormed()).toBe(true);
    }
  });

  test("failure messages include eve's error id without raw error text", () => {
    const errorId = getErrorId({ errorId: "err_1", message: "db down" });
    expect(errorId).toBe("err_1");
    expect(withErrorId("Oops.", errorId)).toBe("Oops.\n\n_Error id: `err_1`_");
    expect(withErrorId("Oops.", getErrorId(undefined))).toBe("Oops.");
  });

  test("only whole Slack permission error codes count as permission errors", () => {
    expect(SLACK_PERMISSION_ERROR_PATTERN.test("Error: missing_scope")).toBe(
      true
    );
    expect(SLACK_PERMISSION_ERROR_PATTERN.test("Error: not_allowed")).toBe(
      true
    );
    expect(
      SLACK_PERMISSION_ERROR_PATTERN.test("Error: not_allowed_token_type")
    ).toBe(false);
  });
});
