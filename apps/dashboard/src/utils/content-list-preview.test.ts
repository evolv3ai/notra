import { describe, expect, test } from "bun:test";

import { getContentListPreview } from "@/utils/content-list-preview";
import {
  getDashboardPostPreview,
  getMarkdownPreview,
} from "@/utils/content-preview";

describe("content list preview projection", () => {
  test("preserves headings, formatting, links and distinct line limits", () => {
    const post = {
      contentType: "blog_post",
      content: "<p>Full HTML body</p>",
      markdown:
        "# Heading\n\n**First** [link](https://example.com)\n`Second` *line*\nThird line\nFourth line",
    };
    expect(getContentListPreview(post, "dashboard")).toEqual({
      preview: "First link Second line",
      content: "",
      markdown: null,
    });
    expect(getContentListPreview(post)).toEqual({
      preview: "First link Second line Third line",
      content: "",
      markdown: null,
    });
  });

  test("computes previews before truncating long headings and link destinations", () => {
    const markdown = `# ${"Heading ".repeat(400)}\n[Readable link](https://example.com/${"path".repeat(700)})\nNext line\nThird line`;
    const post = { contentType: "changelog", content: "", markdown };
    expect(getContentListPreview(post).preview).toBe(
      "Readable link Next line Third line"
    );
    expect(getContentListPreview(post, "dashboard").preview).toBe(
      "Readable link Next line"
    );
    expect(getMarkdownPreview(markdown.slice(0, 2000))).not.toBe(
      getContentListPreview(post).preview
    );
  });

  test("matches existing helpers and bounds serialized text payloads", () => {
    const markdown = `# Title\n${"**Useful** [text](https://example.com) ".repeat(1000)}\nSecond\nThird`;
    const post = {
      contentType: "blog_post",
      content: "<p>Large HTML</p>".repeat(1000),
      markdown,
    };
    const dashboard = getContentListPreview(post, "dashboard");
    const collection = getContentListPreview(post);
    const previousListPayload = {
      content: "",
      markdown: markdown.slice(0, 2000),
    };
    expect(dashboard.preview).toBe(getDashboardPostPreview(markdown));
    expect(collection.preview).toBe(getMarkdownPreview(markdown));
    expect(dashboard.preview).toHaveLength(160);
    expect(collection.preview).toHaveLength(200);
    expect(Buffer.byteLength(JSON.stringify(dashboard))).toBeLessThan(220);
    expect(Buffer.byteLength(JSON.stringify(collection))).toBeLessThan(260);
    expect(Buffer.byteLength(JSON.stringify(dashboard))).toBeLessThan(
      Buffer.byteLength(JSON.stringify(previousListPayload)) / 8
    );
    expect(Buffer.byteLength(JSON.stringify(collection))).toBeLessThan(
      Buffer.byteLength(JSON.stringify(post)) / 100
    );
  });

  test("preserves image source contracts including image markdown syntax", () => {
    const post = {
      contentType: "image",
      content: "https://example.com/image.png",
      markdown:
        "![Image caption](https://example.com/image.png)\nImage details",
    };
    expect(getContentListPreview(post)).toEqual({
      content: post.content,
      markdown: post.markdown,
      preview: getMarkdownPreview(post.markdown),
    });
    expect(getContentListPreview(post, "dashboard").preview).toBe(
      getDashboardPostPreview(post.markdown)
    );
    expect(getContentListPreview({ ...post, markdown: null })).toEqual({
      content: post.content,
      markdown: null,
      preview: "",
    });
  });

  test("keeps empty and null text documents empty", () => {
    for (const markdown of [null, "", "# Heading\n\n   "]) {
      expect(
        getContentListPreview({
          contentType: "blog_post",
          content: "",
          markdown,
        })
      ).toEqual({ content: "", markdown: null, preview: "" });
    }
  });
});
