import assert from "node:assert/strict";
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";

const require = createRequire(import.meta.url);
const wasm = createRequire(require.resolve("satori")).resolve(
  "harfbuzzjs/hb.wasm"
);

let modulesFound = 0;
for (const root of [".output", ".vercel/output"]) {
  if (!existsSync(root)) {
    continue;
  }
  // Glob's ** skips .well-known, which contains Eve's separate workflow function.
  for (const entry of readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (
      !entry.isFile() ||
      entry.name !== "hb.js" ||
      basename(entry.parentPath) !== "harfbuzzjs"
    ) {
      continue;
    }
    const target = join(entry.parentPath, "hb.wasm");
    if (!existsSync(target)) {
      copyFileSync(wasm, target);
    }
    modulesFound++;
  }
}

assert.ok(
  modulesFound > 0,
  "No built HarfBuzz modules found; check the build output layout"
);
