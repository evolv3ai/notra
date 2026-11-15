import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import sharp from "sharp";

const articles = [
  "how-to-create-a-grok-bot-plugin",
  "how-notra-uses-upstash-to-run-an-ai-content-pipeline",
];

for (const article of articles) {
  test(`${article} uses smaller, full-resolution screenshots`, async () => {
    const source = await readFile(
      new URL(`../src/content/blog/${article}.mdx`, import.meta.url),
      "utf8"
    );
    const images = [
      ...source.matchAll(
        /<img[^>]*src="(\/blog\/(?:grok-bot-[^"/]+|upstash-content-workflow)\.[^"]+)"[^>]*\/>/g
      ),
    ];
    assert.equal(images.length, article.startsWith("how-to-create") ? 6 : 1);
    for (const [markup, src] of images) {
      assert.ok(src.endsWith(".webp"));
      const optimized = await readFile(
        new URL(`../public${src}`, import.meta.url)
      );
      const original = await readFile(
        new URL(`../public${src.replace(/\.webp$/, ".png")}`, import.meta.url)
      );
      const before = await sharp(original).metadata();
      const after = await sharp(optimized).metadata();
      assert.equal(after.format, "webp");
      assert.equal(after.width, before.width);
      assert.equal(after.height, before.height);
      assert.ok(optimized.length < original.length / 10);
      assert.ok(markup.includes(`width="${before.width}"`));
      assert.ok(markup.includes(`height="${before.height}"`));
      assert.ok(markup.includes('loading="lazy"'));
      assert.ok(markup.includes('decoding="async"'));
      await sharp(optimized).raw().toBuffer();
    }
  });
}
