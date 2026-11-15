import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const started = performance.now();
if (process.env.SITES_TEST_ENABLED !== "true") {
  throw new Error("SITES_TEST_ENABLED=true is required.");
}
const command = process.argv[2];
if (command === "down") {
  const container = process.argv[3] ?? "";
  if (!/^notra-dashboard-e2e-[a-f0-9-]+$/.test(container)) {
    throw new Error("Only containers created by this test CLI can be removed.");
  }
  const label = spawnSync(
    "docker",
    [
      "inspect",
      "--format",
      '{{index .Config.Labels "notra.dashboard-e2e"}}',
      container,
    ],
    { encoding: "utf8" }
  );
  if (label.status !== 0 || label.stdout.trim() !== "isolated-test") {
    throw new Error("Container is missing the isolated test ownership label.");
  }
  const removed = spawnSync("docker", ["rm", "-fv", container], {
    encoding: "utf8",
  });
  if (removed.status !== 0) {
    throw new Error("Docker container removal failed.");
  }
  console.log(
    JSON.stringify({
      command,
      container,
      durationMs: +(performance.now() - started).toFixed(2),
    })
  );
} else if (command === "up") {
  const requestedPort = process.argv[3];
  if (
    requestedPort &&
    (!/^\d+$/.test(requestedPort) ||
      Number(requestedPort) < 1 ||
      Number(requestedPort) > 65_535)
  ) {
    throw new Error("Requested loopback port must be between 1 and 65535.");
  }
  // Docker Desktop/OrbStack can publish a port a host process already
  // listens on, and the suite would then talk to that foreign database.
  if (requestedPort) {
    const free = await new Promise<boolean>((resolveProbe) => {
      const probe = createServer();
      probe.once("error", () => resolveProbe(false));
      probe.listen(Number(requestedPort), "127.0.0.1", () =>
        probe.close(() => resolveProbe(true))
      );
    });
    if (!free) {
      throw new Error(
        `Port ${requestedPort} is already in use on 127.0.0.1; stop the other PostgreSQL first.`
      );
    }
  }
  const container = `notra-dashboard-e2e-${crypto.randomUUID()}`;
  const created = spawnSync(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      container,
      "--label",
      "notra.dashboard-e2e=isolated-test",
      "--publish",
      `127.0.0.1:${requestedPort ?? ""}:5432`,
      "--env",
      "POSTGRES_DB=notra_server_audit",
      "--env",
      "POSTGRES_PASSWORD=synthetic-e2e-only",
      "postgres:16-alpine",
    ],
    { encoding: "utf8" }
  );
  if (created.status !== 0) {
    const owned = spawnSync(
      "docker",
      [
        "inspect",
        "--format",
        '{{index .Config.Labels "notra.dashboard-e2e"}}',
        container,
      ],
      { encoding: "utf8", timeout: 10_000 }
    );
    if (owned.status === 0) {
      if (owned.stdout.trim() !== "isolated-test") {
        throw new Error("Failed container allocation has an unexpected owner.");
      }
      const removed = spawnSync("docker", ["rm", "-fv", container], {
        encoding: "utf8",
        timeout: 10_000,
      });
      if (removed.status !== 0) {
        throw new Error(
          `Failed to remove the incomplete test container ${container}.`
        );
      }
    }
    throw new Error(
      `Docker PostgreSQL creation failed: ${created.stderr.trim()}`
    );
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const probe = spawnSync(
        "docker",
        [
          "exec",
          container,
          "pg_isready",
          "-U",
          "postgres",
          "-d",
          "notra_server_audit",
          "-h",
          "127.0.0.1",
        ],
        { stdio: "ignore" }
      );
      if (probe.status === 0) {
        ready = true;
        break;
      }
      await delay(500);
    }
    if (!ready) {
      throw new Error("PostgreSQL did not become ready within 30 seconds.");
    }
    const mapped = spawnSync("docker", ["port", container, "5432/tcp"], {
      encoding: "utf8",
    });
    const port = /^127\.0\.0\.1:(\d+)$/.exec(mapped.stdout.trim())?.[1];
    if (mapped.status !== 0 || !port) {
      throw new Error("PostgreSQL is not published exclusively on loopback.");
    }
    console.log(
      JSON.stringify({
        command,
        container,
        databaseUrl: `postgresql://postgres:synthetic-e2e-only@127.0.0.1:${port}/notra_server_audit`,
        durationMs: +(performance.now() - started).toFixed(2),
      })
    );
  } catch (error) {
    spawnSync("docker", ["rm", "-fv", container], { stdio: "ignore" });
    throw error;
  }
} else {
  throw new Error(
    "Usage: bun --no-env-file scripts/testing/dashboard/postgres.ts up [port]|down <container>"
  );
}
