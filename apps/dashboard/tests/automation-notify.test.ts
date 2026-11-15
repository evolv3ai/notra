import { expect, test } from "bun:test";

import { formatContentCreatedSlackText } from "../src/utils/automation-notify";

test("Slack announcement links every created post and escapes titles", () => {
  expect(
    formatContentCreatedSlackText({
      automationName: "Weekly <changelog>",
      contentLink: "https://app.example.com/acme/content",
      posts: [
        { postId: "p1", title: "Faster builds & caching" },
        { postId: "p2", title: "Dark mode" },
      ],
    })
  ).toBe(
    [
      "*New content from Weekly &lt;changelog&gt;*",
      "• <https://app.example.com/acme/content/p1|Faster builds &amp; caching>",
      "• <https://app.example.com/acme/content/p2|Dark mode>",
      "<https://app.example.com/acme/content|Open in Notra>",
    ].join("\n")
  );
});
