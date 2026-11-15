import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { HOSTING_DOMAIN } from "../constants/fixtures";
import type { IngestRequest } from "../types/harness";

export async function freePort() {
  const listener = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    listener.once("error", rejectListen);
    listener.listen(0, "127.0.0.1", resolveListen);
  });
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolveClose) =>
    listener.close(() => resolveClose())
  );
  return address.port;
}

// Runs the production Sites Worker entry point in workerd through
// `wrangler dev --local`: real R2 binding (seeded with the build output), real
// Cache API, HTMLRewriter and password rate limiter. Only the hosting domain,
// secret and ingest URL differ from production.
export async function startSitesWorker(options: {
  root: string;
  temp: string;
  port: number;
  objects: Map<string, Uint8Array>;
  previewSecret: string;
}) {
  const { root, temp } = options;
  const ingest: IngestRequest[] = [];
  const ingestServer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      ingest.push({
        url: new URL(request.url).pathname,
        authorization: request.headers.get("authorization"),
        body: (await request.json()) as Record<string, unknown>,
      });
      return new Response(null, { status: 202 });
    },
  });
  // A failed start must not leave the ingest server or wrangler running.
  const stopOnFailure: (() => unknown)[] = [() => ingestServer.stop(true)];
  try {
    const directory = join(temp, "workerd");
    const objectsDirectory = join(directory, "objects");
    for (const [key, body] of options.objects) {
      const path = join(objectsDirectory, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    }
    const configPath = join(directory, "wrangler.jsonc");
    await writeFile(
      configPath,
      JSON.stringify({
        name: "notra-sites-e2e",
        main: join(root, "apps/sites/src/index.ts"),
        compatibility_date: "2026-09-01",
        compatibility_flags: ["nodejs_compat"],
        r2_buckets: [
          { binding: "SITES_BUCKET", bucket_name: "notra-sites-e2e" },
        ],
        ratelimits: [
          {
            name: "PREVIEW_PASSWORD_LIMITER",
            namespace_id: "9001",
            simple: { limit: 10, period: 60 },
          },
          {
            name: "PREVIEW_PASSWORD_SITE_LIMITER",
            namespace_id: "9002",
            simple: { limit: 60, period: 60 },
          },
        ],
        vars: {
          HOSTING_DOMAIN,
          DASHBOARD_URL: "https://dashboard.example.invalid",
          PREVIEW_SECRET: options.previewSecret,
          TRAFFIC_INGEST_URL: `http://127.0.0.1:${ingestServer.port}/api/geo/ingest`,
        },
      })
    );
    const sitesRequire = createRequire(join(root, "apps/sites/package.json"));
    const wranglerModule = sitesRequire.resolve("wrangler");
    const wranglerBin = join(
      dirname(dirname(wranglerModule)),
      "bin/wrangler.js"
    );
    const persist = join(directory, "state");
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: directory,
      CI: "1",
      WRANGLER_SEND_METRICS: "false",
      NO_UPDATE_NOTIFIER: "1",
    };
    execFileSync(
      "node",
      [
        join(root, "apps/sites-e2e/scripts/seed-r2.mjs"),
        wranglerModule,
        configPath,
        // `wrangler dev --persist-to <dir>` reads `<dir>/v3`; the platform
        // proxy writes to exactly the path it is given.
        join(persist, "v3"),
        objectsDirectory,
      ],
      { cwd: directory, env, stdio: ["ignore", "ignore", "inherit"] }
    );
    const { port } = options;
    const log: string[] = [];
    // Not detached: wrangler and workerd stay in the harness process group, so
    // the supervisor's group cleanup also covers them after a crash.
    const child = spawn(
      "node",
      [
        wranglerBin,
        "dev",
        "--config",
        configPath,
        "--local",
        "--persist-to",
        persist,
        "--ip",
        "127.0.0.1",
        "--port",
        String(port),
        // Concurrent suites must not race for Wrangler's default inspector port.
        "--inspector-port",
        "0",
        "--show-interactive-dev-session=false",
      ],
      { cwd: directory, env, stdio: ["ignore", "pipe", "pipe"] }
    );
    stopOnFailure.push(() => child.kill("SIGKILL"));
    child.stdout.on("data", (chunk: Buffer) => log.push(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => log.push(chunk.toString()));
    const deadline = Date.now() + 60_000;
    for (;;) {
      if (child.exitCode !== null) {
        throw new Error(`wrangler dev exited early:\n${log.join("")}`);
      }
      try {
        await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(2000),
        });
        break;
      } catch {
        if (Date.now() > deadline) {
          throw new Error(`wrangler dev did not start:\n${log.join("")}`);
        }
        await delay(250);
      }
    }
    return {
      port,
      ingest,
      // Worker errors (uncaught exceptions, failed waitUntil work) reach the
      // wrangler log only; the suite fails on any of them.
      errors: () =>
        log
          .join("")
          .split("\n")
          .filter((line) => /✘|\[ERROR\]|Uncaught|Error:/.test(line)),
      // Ingest work runs in waitUntil after the response; wait until it settles.
      settle: async (quietMs = 750) => {
        let count = -1;
        while (count !== ingest.length) {
          count = ingest.length;
          await delay(quietMs);
        }
      },
      stop: async () => {
        ingestServer.stop(true);
        if (child.exitCode === null) {
          child.kill("SIGTERM");
          const exited = await Promise.race([
            new Promise((resolveExit) => child.once("exit", resolveExit)),
            delay(5000).then(() => false),
          ]);
          if (exited === false) {
            child.kill("SIGKILL");
          }
        }
      },
    };
  } catch (error) {
    for (const stop of stopOnFailure) {
      stop();
    }
    throw error;
  }
}
