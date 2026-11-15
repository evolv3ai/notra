import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { WORKFLOW_EXTERNAL_PACKAGES } from "../src/constants/framework.ts";

test("standalone workflow function loads its bundle, CommonJS externals and native bindings", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "notra-workflow-production-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(
    join(
      import.meta.dirname,
      "../.vercel/output/functions/.well-known/workflow/v1/step.func"
    ),
    directory,
    { recursive: true, dereference: true }
  );

  const result = spawnSync(
    process.execPath,
    [
      "--input-type=commonjs",
      "--eval",
      `
        for (const name of ${JSON.stringify(WORKFLOW_EXTERNAL_PACKAGES)}) {
          require(name);
        }
        require("./index.js");
        const sharp = require("sharp");
        sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } })
          .png().toBuffer()
          .then((png) => require("node:assert/strict").ok(png.length > 0));
      `,
    ],
    {
      cwd: directory,
      env: { NODE_ENV: "production" },
      encoding: "utf8",
      timeout: 30_000,
    }
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
