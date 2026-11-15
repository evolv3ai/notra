import { expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
  postContentHash,
  matchesPostContentHash,
} from "./scheduled-post-content-hash";

const post = { title: "Synthetic", slug: "synthetic", markdown: "Article" };
for (const [field, value] of Object.entries({
  coverImage: { url: "https://example.test/cover.png", alt: "New alt" },
  tags: ["New tag"],
  excerpt: "New description",
  authorIds: ["author"],
  featured: true,
  hidden: true,
  noindex: true,
  displayDate: new Date("2026-10-20"),
})) {
  test(`scheduled publication becomes stale after changing ${field}`, () => {
    expect(postContentHash({ ...post, [field]: value })).not.toBe(
      postContentHash(post)
    );
  });
}

test("pre-rollout schedule hashes match unchanged content", () => {
  const old = createHash("sha256")
    .update(JSON.stringify([post.slug, post.title, post.markdown]))
    .digest("hex");
  expect(matchesPostContentHash(old, post)).toBe(true);
  expect(matchesPostContentHash(old, { ...post, markdown: "Edited" })).toBe(
    false
  );
  expect(
    matchesPostContentHash(postContentHash(post), { ...post, hidden: true })
  ).toBe(false);
});
