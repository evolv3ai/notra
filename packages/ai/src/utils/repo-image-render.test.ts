import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { spawnAsync } from "@notra/ai/utils/spawn-async";

test("importing shared renderers does not initialize image dependencies", async () => {
  const moduleUrls = [
    "repo-image-render.ts",
    "og-render.ts",
    "excalidraw-render.ts",
  ].map((path) => new URL(path, import.meta.url).href);
  const result = await spawnAsync(
    process.execPath,
    [
      "--no-env-file",
      "--eval",
      `
        import { mock } from "bun:test";
        for (const dependency of ["satori", "@resvg/resvg-js", "satori-html"]) {
          mock.module(dependency, () => { throw new Error("Eager image dependency: " + dependency); });
        }
        for (const moduleUrl of ${JSON.stringify(moduleUrls)}) {
          await import(moduleUrl);
        }
      `,
    ],
    { timeoutMs: 15_000 }
  );
  expect(result.status, result.stderr).toBe(0);
}, 20_000);

test("deferred dependencies still render element trees and HTML to PNG", async () => {
  const bundle = await spawnAsync(
    process.execPath,
    [
      "build",
      fileURLToPath(new URL("repo-image-render.ts", import.meta.url)),
      "--target=node",
      ...["satori", "@resvg/resvg-js", "satori-html", "react", "evlog"].map(
        (dependency) => `--external=${dependency}`
      ),
    ],
    { timeoutMs: 15_000 }
  );
  expect(bundle.status, bundle.stderr).toBe(0);
  // The deployed renderer runs on Node; satori-html's selector parser fails on Bun.
  const result = await spawnAsync("node", ["--input-type=module"], {
    cwd: new URL("../..", import.meta.url),
    timeoutMs: 15_000,
    input: `${bundle.stdout}
      const { default: assert } = await import("node:assert/strict");
      const { createElement: element } = await import("react");
      for (const result of [
        await renderElementToImages(element("div", { style: { display: "flex" } }, "Synthetic render")),
        await renderHtmlToImages("<div>Synthetic render</div>"),
      ]) {
        assert.ok(result.svg.includes("<svg"));
        assert.deepEqual([...Buffer.from(result.pngBase64, "base64").subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      }
    `,
  });
  expect(result.status, result.stderr).toBe(0);
}, 35_000);
