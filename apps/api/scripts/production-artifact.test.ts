import { expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("standalone API artifact loads native dependencies before validating configuration", () => {
  const directory = mkdtempSync(join(tmpdir(), "notra-api-production-"));
  try {
    cpSync(new URL("../dist", import.meta.url), join(directory, "dist"), {
      recursive: true,
    });
    const native = spawnSync(
      process.execPath,
      [
        "--eval",
        `
          const { createRequire } = require("node:module");
          const assert = require("node:assert/strict");
          const requireArtifact = createRequire(process.cwd() + "/dist/index.mjs");
          const { Resvg } = requireArtifact("@resvg/resvg-js");
          const sharp = requireArtifact("sharp");
          const { decompress } = requireArtifact("wawoff2");
          const png = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>').render().asPng();
          const { info } = await sharp(png).resize(4, 4).png().toBuffer({ resolveWithObject: true });
          assert.equal(info.width, 4);
          assert.equal(info.height, 4);
          await assert.rejects(() => decompress(Buffer.alloc(0)), /ConvertWOFF2ToTTF failed/);
        `,
      ],
      {
        cwd: directory,
        env: { NODE_ENV: "production" },
        encoding: "utf8",
        timeout: 30_000,
      }
    );
    expect(native.error).toBeUndefined();
    expect(native.stderr).toBe("");
    expect(native.status).toBe(0);
    const result = spawnSync(
      process.execPath,
      [join(directory, "dist/index.mjs")],
      {
        cwd: directory,
        env: { NODE_ENV: "production" },
        encoding: "utf8",
        timeout: 30_000,
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing required environment variables:");
    expect(result.stderr).not.toContain("Cannot find");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 65_000);

test("standalone API serves its production healthcheck without external services", async () => {
  const directory = mkdtempSync(join(tmpdir(), "notra-api-health-"));
  cpSync(new URL("../dist", import.meta.url), join(directory, "dist"), {
    recursive: true,
  });
  const child = spawn(
    process.execPath,
    [
      "--eval",
      `
    const { default: config } = await import(${JSON.stringify(join(directory, "dist/index.mjs"))});
    const server = Bun.serve({ ...config, hostname: "127.0.0.1", port: 0 });
    console.log(server.url.href);
  `,
    ],
    {
      cwd: directory,
      env: {
        NODE_ENV: "production",
        PORT: "0",
        UNKEY_ROOT_KEY: "test-only",
        DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
        UPSTASH_REDIS_REST_URL: "http://127.0.0.1:1",
        UPSTASH_REDIS_REST_TOKEN: "test-only",
        QSTASH_TOKEN: "test-only",
        WORKFLOW_BASE_URL: "http://127.0.0.1:1",
        INTEGRATION_ENCRYPTION_KEY: "0".repeat(64),
        AUTUMN_SECRET_KEY: "test-only",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let logs = "";
  child.stdout.on("data", (data) => {
    logs += data;
  });
  child.stderr.on("data", (data) => {
    logs += data;
  });
  try {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 600; attempt++) {
      const address = logs.match(
        /http:\/\/(?:localhost|0\.0\.0\.0|127\.0\.0\.1):(\d+)/
      );
      if (address) {
        response = await fetch(`http://127.0.0.1:${address[1]}/ping`);
        break;
      }
      if (child.exitCode !== null) {
        throw new Error(logs);
      }
      await Bun.sleep(50);
    }
    expect(response, logs).toBeDefined();
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("pong");
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  }
}, 35_000);
