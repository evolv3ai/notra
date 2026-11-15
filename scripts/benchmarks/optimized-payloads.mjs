import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { gunzipSync } from "node:zlib";

import { apiCompressionMiddleware } from "../../apps/api/src/middleware/compression.ts";
import { getContentListPreview } from "../../apps/dashboard/src/utils/content-list-preview.ts";

const require = createRequire(
  new URL("../../apps/api/package.json", import.meta.url)
);
const { Hono } = require("hono");
const markdown = `# Release notes\n${"A useful improvement to the product. ".repeat(100)}\nSecond line\nThird line`;
const originalCards = Array.from({ length: 20 }, (_, id) => ({
  id,
  title: `Post ${id}`,
  content: "",
  markdown: markdown.slice(0, 2000),
}));
const optimizedCards = originalCards.map(({ id, title }) => ({
  id,
  title,
  ...getContentListPreview(
    { content: "", contentType: "blog_post", markdown },
    "dashboard"
  ),
}));
const cards = {
  baselineBytes: Buffer.byteLength(JSON.stringify(originalCards)),
  candidateBytes: Buffer.byteLength(JSON.stringify(optimizedCards)),
};
const fixture = {
  posts: Array.from({ length: 80 }, (_, id) => ({
    id,
    title: `Post ${id}`,
    preview: "A useful product improvement. ".repeat(10),
  })),
};
const measurements = [];
for (const mode of ["baseline", "identity", "gzip"]) {
  const app = new Hono();
  if (mode !== "baseline") {
    app.use(apiCompressionMiddleware);
  }
  app.get("/", (c) => c.json(fixture));
  let bytes;
  for (let i = 0; i < 50; i++) {
    await (
      await app.request("/", {
        headers: { "Accept-Encoding": mode === "gzip" ? "gzip" : "identity" },
      })
    ).arrayBuffer();
  }
  const cpu = process.cpuUsage();
  const start = performance.now();
  for (let i = 0; i < 500; i++) {
    const response = await app.request("/", {
      headers: { "Accept-Encoding": mode === "gzip" ? "gzip" : "identity" },
    });
    const body = Buffer.from(await response.arrayBuffer());
    bytes = body.length;
    if (i === 0) {
      assert.deepEqual(
        JSON.parse(
          mode === "gzip" ? gunzipSync(body).toString() : body.toString()
        ),
        fixture
      );
    }
  }
  const elapsed = performance.now() - start;
  const usage = process.cpuUsage(cpu);
  measurements.push({
    mode,
    bytes,
    wallMsPerRequest: elapsed / 500,
    cpuMsPerRequest: (usage.user + usage.system) / 500000,
  });
}
const images = [];
for (const name of [
  "grok-bot-submit-dark",
  "grok-bot-submit-light",
  "grok-bot-marketplace-dark",
  "grok-bot-marketplace-light",
  "grok-bot-gtm-result-dark",
  "grok-bot-gtm-result-light",
  "upstash-content-workflow",
]) {
  const baseline = await readFile(
    new URL(`../../apps/web/public/blog/${name}.png`, import.meta.url)
  );
  const candidate = await readFile(
    new URL(`../../apps/web/public/blog/${name}.webp`, import.meta.url)
  );
  images.push({
    name,
    baselineBytes: baseline.length,
    candidateBytes: candidate.length,
  });
}
console.log(
  JSON.stringify(
    {
      runtime: process.versions,
      warmups: 50,
      iterations: 500,
      cards,
      api: measurements,
      images,
    },
    null,
    2
  )
);
