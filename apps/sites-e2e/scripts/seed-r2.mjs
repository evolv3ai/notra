// Fills the local R2 bucket that `wrangler dev --persist-to` reads, using
// Wrangler's own platform proxy (Miniflare's options validation fails under
// Bun, so this runs on Node). Usage: node seed-r2.mjs <wrangler-module>
// <wrangler.jsonc> <persist dir> <objects dir>
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const [wranglerModule, configPath, persistPath, objectsPath] =
  process.argv.slice(2);
const { getPlatformProxy } = await import(pathToFileURL(wranglerModule).href);
const proxy = await getPlatformProxy({
  configPath,
  persist: { path: persistPath },
});
try {
  let count = 0;
  for (const entry of await readdir(objectsPath, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) {
      continue;
    }
    const path = join(entry.parentPath, entry.name);
    await proxy.env.SITES_BUCKET.put(
      relative(objectsPath, path),
      await readFile(path)
    );
    count += 1;
  }
  console.log(JSON.stringify({ seeded: count }));
} finally {
  await proxy.dispose();
}
