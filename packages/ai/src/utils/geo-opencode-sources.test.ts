import { describe, expect, test } from "bun:test";

import { extractHttpUrls } from "./geo-opencode-sources";

describe("GEO coding-provider source extraction", () => {
  test("extracts and deduplicates HTTP URLs from nested tool payloads", () => {
    expect(
      extractHttpUrls({
        input: [
          "https://EXAMPLE.com",
          { nested: "https://example.com/ https://other.example/path?q=1&x=2" },
        ],
        output: null,
      })
    ).toEqual(["https://example.com/", "https://other.example/path?q=1&x=2"]);
  });

  test("tolerates cycles and non-string scalar values", () => {
    const payload: unknown[] = [
      null,
      undefined,
      false,
      3,
      "https://source.example",
    ];
    payload.push(payload);
    expect(extractHttpUrls(payload)).toEqual(["https://source.example/"]);
  });

  test("does not return non-HTTP schemes or malformed URLs", () => {
    expect(
      extractHttpUrls(
        "file:///etc/passwd javascript:alert(1) data:text/plain,abc ftp://source.example https://[broken"
      )
    ).toEqual([]);
  });

  test("removes sentence and markdown link punctuation", () => {
    expect(
      extractHttpUrls(
        "See [source](https://source.example/docs), then https://other.example/path."
      )
    ).toEqual(["https://source.example/docs", "https://other.example/path"]);
  });

  test("removes combined wrapper punctuation and emphasis without leaving punctuation in the path", () => {
    expect(
      extractHttpUrls(
        "(**https://source.example/docs.**) **https://other.example/docs.**"
      )
    ).toEqual(["https://source.example/docs", "https://other.example/docs"]);
  });

  test.each([
    ["https://example.com/files/part**", "https://example.com/files/part**"],
    [
      "[search](https://example.com/search?q=foo*)",
      "https://example.com/search?q=foo*",
    ],
    [
      "**[search](https://example.com/search?q=foo*)**.",
      "https://example.com/search?q=foo*",
    ],
    [
      "[article](https://example.com/Function_(mathematics)*)",
      "https://example.com/Function_(mathematics)*",
    ],
    [
      "**https://example.com/search?q=foo***",
      "https://example.com/search?q=foo*",
    ],
    [
      "**https://example.com/files/part****",
      "https://example.com/files/part**",
    ],
    [
      "(**https://example.com/search?q=foo*.**)",
      "https://example.com/search?q=foo*",
    ],
  ])("preserves literal destination stars in %s", (text, url) => {
    expect(extractHttpUrls(text)).toEqual([url]);
  });

  test("keeps adjacent balanced Markdown destinations without parsing embedded redirect URLs twice", () => {
    expect(
      extractHttpUrls(
        "[one](https://one.example/Function_(math)*)[two](https://two.example/path_(part)*) https://example.com/redirect?to=https://target.example/"
      )
    ).toEqual([
      "https://one.example/Function_(math)*",
      "https://two.example/path_(part)*",
      "https://example.com/redirect?to=https://target.example/",
    ]);
  });
});
