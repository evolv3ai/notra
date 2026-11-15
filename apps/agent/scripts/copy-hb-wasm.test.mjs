import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("ships HarfBuzz WASM to every function, including hidden workflow output", (t) => {
  const root = mkdtempSync(join(tmpdir(), "notra-hb-wasm-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const script = join(root, "copy-hb-wasm.mjs");
  copyFileSync(new URL("copy-hb-wasm.mjs", import.meta.url), script);

  mkdirSync(join(root, "node_modules/satori"), { recursive: true });
  writeFileSync(join(root, "node_modules/satori/index.js"), "");
  mkdirSync(join(root, "node_modules/harfbuzzjs"), { recursive: true });
  const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
  writeFileSync(join(root, "node_modules/harfbuzzjs/hb.wasm"), wasm);

  const directories = [
    ".output/server/node_modules/harfbuzzjs",
    ".vercel/output/functions/eve/__server.func/node_modules/harfbuzzjs",
    ".vercel/output/functions/.well-known/workflow/v1/flow.func/node_modules/harfbuzzjs",
    ".vercel/output/functions/.well-known/workflow/v1/step.func/node_modules/harfbuzzjs",
  ];
  for (const directory of directories) {
    mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(join(root, directory, "hb.js"), "");
  }
  const unrelated = join(root, ".output/server/other");
  mkdirSync(unrelated, { recursive: true });
  writeFileSync(join(unrelated, "hb.js"), "");

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    for (const directory of directories) {
      assert.deepEqual(readFileSync(join(root, directory, "hb.wasm")), wasm);
    }
  }
  assert.equal(existsSync(join(unrelated, "hb.wasm")), false);

  const empty = join(root, "empty");
  mkdirSync(empty);
  const result = spawnSync(process.execPath, [script], {
    cwd: empty,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No built HarfBuzz modules found/);
});
