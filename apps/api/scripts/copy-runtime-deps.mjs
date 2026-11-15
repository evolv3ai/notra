import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { traceNodeModules } from "nf3";

const require = createRequire(import.meta.url);
const outDir = fileURLToPath(new URL("../dist", import.meta.url));
// Sharp has separate ESM and CommonJS entries; the server and smoke check use both.
await traceNodeModules(
  [
    require.resolve("@resvg/resvg-js"),
    require.resolve("sharp"),
    fileURLToPath(import.meta.resolve("sharp")),
    require.resolve("wawoff2"),
  ],
  { outDir }
);

const satoriRequire = createRequire(
  createRequire(require.resolve("@notra/ai/gateway")).resolve("satori")
);
copyFileSync(satoriRequire.resolve("harfbuzzjs/hb.wasm"), `${outDir}/hb.wasm`);
