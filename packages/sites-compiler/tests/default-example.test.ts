import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createDefaultSiteConfig } from "@notra/sites-core/utils/default-config";

import { validateSite } from "../src/validate";

test("the default example validates and preserves the platform theme defaults", async () => {
  const root = new URL("fixtures/default-site/", import.meta.url);
  const paths = await readdir(root, { recursive: true, withFileTypes: true });
  const files = new Map<string, string>();
  for (const entry of paths) {
    if (!entry.isFile()) {
      continue;
    }
    const path = `${entry.parentPath}/${entry.name}`;
    files.set(
      path.slice(fileURLToPath(root).length),
      await readFile(path, "utf8")
    );
  }

  const result = validateSite({ files });
  expect(result.ok).toBe(true);
  expect(result.diagnostics).toEqual([]);
  expect(result.entries.filter((entry) => entry.area === "blog")).toHaveLength(
    3
  );
  expect(
    result.entries.filter((entry) => entry.area === "changelog")
  ).toHaveLength(1);

  const defaults = createDefaultSiteConfig("Notra");
  const input = JSON.parse(files.get("blog.json") ?? "{}");
  expect(result.config).toEqual({
    ...defaults,
    $schema: input.$schema,
    description: input.description,
    authors: input.authors,
    blog: { ...defaults.blog, ...input.blog },
    changelog: { ...defaults.changelog, ...input.changelog },
  });
});
