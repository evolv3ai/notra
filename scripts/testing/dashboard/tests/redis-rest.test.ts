import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

import { REDIS_REST_MAX_BODY_BYTES } from "../constants/redis-rest";
import {
  isLocalRedisRequest,
  redisUrlFromContainerInspection,
  requireRedisRestConfig,
} from "../utils/redis-rest";

const dashboardRequire = createRequire(
  new URL("../../../../apps/dashboard/package.json", import.meta.url)
);
const { Redis } = dashboardRequire("@upstash/redis");
const { Ratelimit } = dashboardRequire("@upstash/ratelimit");
const environment = {
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  SITES_TEST_ENABLED: "true",
};

test("Redis REST refuses missing opt-in, unsafe container names, short tokens and invalid ports", () => {
  expect(() => requireRedisRestConfig({})).toThrow("SITES_TEST_ENABLED=true");
  expect(() => requireRedisRestConfig(environment)).toThrow(
    "SITES_TEST_REDIS_CONTAINER"
  );
  const valid = {
    ...environment,
    SITES_TEST_REDIS_CONTAINER: `notra-dashboard-redis-e2e-${crypto.randomUUID()}`,
    SITES_TEST_REDIS_REST_TOKEN:
      "synthetic-test-token-with-at-least-32-characters",
  };
  for (const container of [
    "redis",
    "notra-dashboard-redis-e2e-live",
    "--help",
  ]) {
    expect(() =>
      requireRedisRestConfig({
        ...valid,
        SITES_TEST_REDIS_CONTAINER: container,
      })
    ).toThrow();
  }
  expect(() =>
    requireRedisRestConfig({ ...valid, SITES_TEST_REDIS_REST_TOKEN: "short" })
  ).toThrow();
  for (const port of ["-1", "65536", "3.5", "", "NaN"]) {
    expect(() =>
      requireRedisRestConfig({ ...valid, SITES_TEST_REDIS_REST_PORT: port })
    ).toThrow();
  }
});

test("Docker ownership and exclusive loopback mappings are mandatory", () => {
  const container = "notra-dashboard-redis-e2e-abcd-1234";
  const inspected = {
    name: `/${container}`,
    running: true,
    label: "isolated-test",
    ports: [{ HostIp: "127.0.0.1", HostPort: "12345" }],
  };
  expect(
    redisUrlFromContainerInspection(container, JSON.stringify(inspected))
  ).toBe("redis://127.0.0.1:12345");
  for (const override of [
    { name: "/another-container" },
    { running: false },
    { label: "isolated-test-other" },
    { label: null },
    { ports: null },
    { ports: [] },
    { ports: [{ HostIp: "0.0.0.0", HostPort: "12345" }] },
    { ports: [{ HostIp: "::1", HostPort: "12345" }] },
    { ports: [{ HostIp: "127.0.0.1", HostPort: "0" }] },
    { ports: [{ HostIp: "127.0.0.1", HostPort: "65536" }] },
    {
      ports: [
        { HostIp: "127.0.0.1", HostPort: "12345" },
        { HostIp: "::", HostPort: "12345" },
      ],
    },
  ]) {
    expect(() =>
      redisUrlFromContainerInspection(
        container,
        JSON.stringify({ ...inspected, ...override })
      )
    ).toThrow();
  }
  expect(
    isLocalRedisRequest(new Request("http://127.0.0.1:12345"), 12345)
  ).toBe(false);
});

test.skipIf(process.env.SITES_TEST_ENABLED !== "true")(
  "Dashboard Upstash transport runs against isolated real Redis and shuts down cleanly",
  async () => {
    const container = `notra-dashboard-redis-e2e-${crypto.randomUUID()}`;
    const token = `synthetic-${crypto.randomUUID()}`;
    const docker = (args: string[]) =>
      spawnSync("docker", args, {
        env: environment,
        encoding: "utf8",
        timeout: 90_000,
      });
    const created = docker([
      "create",
      "--name",
      container,
      "--label",
      "notra.dashboard-redis-e2e=isolated-test",
      "--publish",
      "127.0.0.1::6379",
      "redis:7-alpine",
      "redis-server",
      "--save",
      "",
      "--appendonly",
      "no",
    ]);
    let service: ReturnType<typeof Bun.spawn> | undefined;
    const createdId = created.stdout.trim();
    try {
      expect(created.status, created.stderr).toBe(0);
      expect(createdId).toMatch(/^[a-f0-9]{64}$/);
      const started = docker(["start", createdId]);
      expect(started.status, started.stderr).toBe(0);
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        if (
          docker(["exec", container, "redis-cli", "PING"]).stdout.trim() ===
          "PONG"
        ) {
          ready = true;
          break;
        }
        await delay(100);
      }
      expect(ready).toBe(true);
      const config = requireRedisRestConfig({
        ...environment,
        SITES_TEST_REDIS_CONTAINER: container,
        SITES_TEST_REDIS_REST_TOKEN: token,
      });
      expect(config.port).toBe(0);
      expect(config.redisUrl).toMatch(/^redis:\/\/127\.0\.0\.1:\d+$/);
      service = Bun.spawn(
        [
          process.execPath,
          "--no-env-file",
          "scripts/testing/dashboard/redis-rest.ts",
        ],
        {
          cwd: new URL("../../../..", import.meta.url).pathname,
          env: {
            ...environment,
            SITES_TEST_REDIS_CONTAINER: container,
            SITES_TEST_REDIS_REST_TOKEN: token,
          },
          stdout: "pipe",
          stderr: "pipe",
          timeout: 60_000,
        }
      );
      const reader = (service.stdout as ReadableStream<Uint8Array>).getReader();
      let output = "";
      try {
        while (!output.includes("\n")) {
          const read = await reader.read();
          if (read.done) {
            throw new Error("Redis REST exited before readiness.");
          }
          output += new TextDecoder().decode(read.value);
        }
      } finally {
        reader.releaseLock();
      }
      expect(output).not.toContain(token);
      const { origin, port } = JSON.parse(output.trim());
      expect(origin).toBe(`http://127.0.0.1:${port}`);
      expect(port).toBeGreaterThan(0);
      const redis = new Redis({
        url: origin,
        token,
        enableAutoPipelining: false,
        retry: false,
      });
      const value = {
        title: "Sites 日本語",
        nested: { enabled: true },
        items: [1, "two"],
      };
      expect(await redis.set("json", value, { ex: 60 })).toBe("OK");
      expect(await redis.get("json")).toEqual(value);
      expect(await redis.ttl("json")).toBeGreaterThan(0);
      expect(await redis.get("missing")).toBeNull();
      expect(await redis.ttl("missing")).toBe(-2);
      await redis.set("expires", "gone", { px: 30 });
      await delay(60);
      expect(await redis.get("expires")).toBeNull();
      expect(
        await redis
          .pipeline()
          .set("counter", 1)
          .incr("counter")
          .get("counter")
          .exec()
      ).toEqual(["OK", 2, 2]);
      expect(
        await redis.multi().set("atomic", 0).incr("atomic").get("atomic").exec()
      ).toEqual(["OK", 1, 1]);
      const transactions = await Promise.all(
        Array.from({ length: 8 }, () =>
          redis.multi().incr("atomic").get("atomic").exec()
        )
      );
      for (const [incremented, read] of transactions) {
        expect(read).toBe(incremented);
      }
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, "1 m"),
        prefix: "sites-rest-test",
        ephemeralCache: false,
        analytics: false,
        timeout: 0,
      });
      const accepted = await limiter.limit("user");
      const denied = await limiter.limit("user");
      expect(accepted.success).toBe(true);
      expect(denied.success).toBe(false);
      expect(denied.reason).not.toBe("timeout");
      await Promise.all([accepted.pending, denied.pending]);
      const request = (
        path: string,
        body: unknown,
        headers: Record<string, string> = {}
      ) =>
        fetch(`${origin}${path}`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, ...headers },
          body: JSON.stringify(body),
        });
      const encoded = await request(
        "/",
        ["EVAL", 'return {"hello", {"world", 3}}', 0],
        {
          "Upstash-Encoding": "base64",
        }
      );
      expect(await encoded.json()).toEqual({
        result: ["aGVsbG8=", ["d29ybGQ=", 3]],
      });
      const nestedError = await request(
        "/",
        ["EVAL", 'return {"hello", redis.error_reply("ERR bad")}', 0],
        {
          "Upstash-Encoding": "base64",
        }
      );
      expect(await nestedError.json()).toEqual({
        result: ["aGVsbG8=", { error: "ERR bad" }],
      });
      const pipeline = await request("/pipeline", [["NOTACOMMAND"], ["PING"]], {
        "Upstash-Encoding": "base64",
      });
      const pipelineReplies = await pipeline.json();
      expect(pipelineReplies[0].error).toContain("unknown command");
      expect(pipelineReplies[1]).toEqual({ result: "UE9ORw==" });
      const aborted = await request("/multi-exec", [
        ["SET", "aborted", "bad"],
        ["NOTACOMMAND"],
      ]);
      expect((await aborted.json()).error).toContain("unknown command");
      expect(await redis.get("aborted")).toBeNull();
      const escaped = await request("/multi-exec", [
        ["SET", "escaped", "bad"],
        ["EXEC"],
      ]);
      expect((await escaped.json()).error).toContain("Transaction control");
      expect(await redis.get("escaped")).toBeNull();
      const runtimeError = await request("/multi-exec", [
        ["SET", "wrongtype", "value"],
        ["LPUSH", "wrongtype", "item"],
        ["GET", "wrongtype"],
      ]);
      const transactionReplies = await runtimeError.json();
      expect(transactionReplies).toHaveLength(3);
      expect(transactionReplies[0]).toEqual({ result: "OK" });
      expect(transactionReplies[1].error).toContain("WRONGTYPE");
      expect(transactionReplies[2]).toEqual({ result: "value" });
      expect((await request("/", ["PING"], { authorization: "" })).status).toBe(
        401
      );
      expect(
        (await request("/", ["PING"], { authorization: "Bearer wrong" })).status
      ).toBe(401);
      expect(
        (await request("/", ["PING"], { host: "public.example.test" })).status
      ).toBe(403);
      for (const header of [
        "Forwarded",
        "X-Forwarded-Host",
        "X-Forwarded-For",
        "X-Real-IP",
      ]) {
        expect(
          (await request("/", ["PING"], { [header]: "127.0.0.1" })).status
        ).toBe(403);
      }
      expect((await request("/unsupported", ["PING"])).status).toBe(404);
      expect((await request("/?command=PING", ["PING"])).status).toBe(404);
      expect(
        (await fetch(origin, { headers: { authorization: `Bearer ${token}` } }))
          .status
      ).toBe(405);
      for (const body of [[], {}, ["SET", "key", {}], [["PING"]], [null]]) {
        expect((await request("/", body)).status).toBe(400);
      }
      const oversized = await request("/", [
        "ECHO",
        "x".repeat(REDIS_REST_MAX_BODY_BYTES),
      ]);
      expect([400, 413]).toContain(oversized.status);
      const chunked = await fetch(origin, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: new Blob([
          JSON.stringify([
            "SET",
            "oversized",
            "x".repeat(REDIS_REST_MAX_BODY_BYTES),
          ]),
        ]).stream(),
      });
      expect([400, 413]).toContain(chunked.status);
      expect(await redis.get("oversized")).toBeNull();
      const clients = docker([
        "exec",
        container,
        "redis-cli",
        "CLIENT",
        "LIST",
      ]);
      expect(clients.status).toBe(0);
      expect(clients.stdout.trim().split("\n")).toHaveLength(1);
      const inFlight = request("/", ["BLPOP", "empty", 0.2]);
      await delay(50);
      service.kill("SIGTERM");
      expect(await (await inFlight).json()).toEqual({ result: null });
      expect(await service.exited).toBe(0);
      expect(await new Response(service.stderr as ReadableStream).text()).toBe(
        ""
      );
      const remaining = (
        service.stdout as ReadableStream<Uint8Array>
      ).getReader();
      try {
        while (true) {
          const read = await remaining.read();
          if (read.done) {
            break;
          }
          output += new TextDecoder().decode(read.value);
        }
      } finally {
        remaining.releaseLock();
      }
      expect(output).not.toContain(token);
      await expect(fetch(origin)).rejects.toThrow();
    } finally {
      if (service && service.exitCode === null) {
        service.kill("SIGKILL");
        await service.exited;
      }
      if (created.status === 0 && /^[a-f0-9]{64}$/.test(createdId)) {
        const mounts = docker([
          "inspect",
          "--format",
          '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}',
          createdId,
        ]);
        expect(mounts.status).toBe(0);
        const removed = docker(["rm", "-fv", createdId]);
        expect(removed.status, removed.stderr).toBe(0);
        expect(
          docker(["inspect", "--format", "{{.Id}}", createdId]).status
        ).not.toBe(0);
        for (const volume of mounts.stdout.split("\n").filter(Boolean)) {
          expect(
            docker(["volume", "inspect", "--format", "{{.Name}}", volume])
              .status
          ).not.toBe(0);
        }
      }
    }
  },
  120_000
);
