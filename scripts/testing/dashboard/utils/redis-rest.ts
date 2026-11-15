import { spawnSync } from "node:child_process";
import { timingSafeEqual } from "node:crypto";

import { RedisClient } from "bun";

import {
  REDIS_TEST_CONTAINER,
  REDIS_TEST_LABEL,
  REDIS_TEST_LABEL_VALUE,
  REDIS_TRANSACTION_CONTROL_COMMANDS,
} from "../constants/redis-rest";
import type {
  RedisRestCommand,
  RedisRestReply,
  RedisRestResult,
} from "../types/redis-rest";

export function requireRedisRestConfig(environment = process.env) {
  if (environment.SITES_TEST_ENABLED !== "true") {
    throw new Error("SITES_TEST_ENABLED=true is required.");
  }
  const container = environment.SITES_TEST_REDIS_CONTAINER ?? "";
  if (!REDIS_TEST_CONTAINER.test(container)) {
    throw new Error(
      "SITES_TEST_REDIS_CONTAINER must name an isolated test container."
    );
  }
  const token = environment.SITES_TEST_REDIS_REST_TOKEN ?? "";
  if (token.length < 32) {
    throw new Error(
      "SITES_TEST_REDIS_REST_TOKEN must contain at least 32 characters."
    );
  }
  const requestedPort = environment.SITES_TEST_REDIS_REST_PORT ?? "0";
  if (!/^\d+$/.test(requestedPort) || Number(requestedPort) > 65_535) {
    throw new Error("SITES_TEST_REDIS_REST_PORT must be between 0 and 65535.");
  }
  const inspected = spawnSync(
    "docker",
    [
      "inspect",
      "--format",
      `{"name":{{json .Name}},"running":{{json .State.Running}},"label":{{json (index .Config.Labels "${REDIS_TEST_LABEL}")}},"ports":{{json (index .NetworkSettings.Ports "6379/tcp")}}}`,
      container,
    ],
    { encoding: "utf8", timeout: 10_000 }
  );
  if (inspected.status !== 0) {
    throw new Error("Cannot inspect the isolated Redis test container.");
  }
  return {
    redisUrl: redisUrlFromContainerInspection(container, inspected.stdout),
    port: Number(requestedPort),
    token,
  };
}

export function redisUrlFromContainerInspection(
  container: string,
  output: string
) {
  const inspected = JSON.parse(output);
  if (
    !REDIS_TEST_CONTAINER.test(container) ||
    inspected?.name !== `/${container}` ||
    inspected?.running !== true ||
    inspected?.label !== REDIS_TEST_LABEL_VALUE
  ) {
    throw new Error(
      "Redis requires a running container with the exact isolated test label."
    );
  }
  const mappings = inspected.ports;
  if (
    !Array.isArray(mappings) ||
    mappings.length !== 1 ||
    mappings[0]?.HostIp !== "127.0.0.1" ||
    typeof mappings[0]?.HostPort !== "string" ||
    !/^\d+$/.test(mappings[0].HostPort) ||
    Number(mappings[0].HostPort) < 1 ||
    Number(mappings[0].HostPort) > 65_535
  ) {
    throw new Error(
      "Redis port 6379 must be published exclusively on 127.0.0.1."
    );
  }
  return `redis://127.0.0.1:${mappings[0].HostPort}`;
}

export function createRedisConnection(url: string) {
  return new RedisClient(url, {
    autoReconnect: false,
    enableOfflineQueue: false,
    enableAutoPipelining: false,
    connectionTimeout: 5000,
    idleTimeout: 5000,
  });
}

export function isLocalRedisRequest(request: Request, port: number) {
  const host = request.headers.get("host");
  return (
    (host === `127.0.0.1:${port}` || host === `localhost:${port}`) &&
    ["127.0.0.1", "localhost"].includes(new URL(request.url).hostname) &&
    !Array.from(request.headers.keys()).some(
      (header) =>
        header === "forwarded" ||
        header.startsWith("x-forwarded-") ||
        header === "x-real-ip"
    )
  );
}

export function hasRedisAuthorization(request: Request, token: string) {
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export async function readRedisCommands(request: Request, batch: boolean) {
  const body: unknown = await request.json();
  const commands = batch ? body : [body];
  if (
    !Array.isArray(commands) ||
    commands.length === 0 ||
    !commands.every(
      (command) =>
        Array.isArray(command) &&
        typeof command[0] === "string" &&
        /^[a-z][a-z0-9._-]*$/i.test(command[0]) &&
        command
          .slice(1)
          .every(
            (argument) =>
              typeof argument === "string" ||
              (typeof argument === "number" && Number.isFinite(argument))
          )
    )
  ) {
    throw new Error(
      "Expected a Redis command array or a nonempty array of commands."
    );
  }
  return (commands as RedisRestCommand[]).map(([command, ...args]) => {
    if (/^eval(?:_ro)?$/i.test(command) && typeof args[0] === "string") {
      args[0] = args[0].replace(/^#!lua flags=allow-key-locking\r?\n/, "");
    }
    return [command, ...args] as RedisRestCommand;
  });
}

export function redisReply(
  value: RedisRestResult | Error,
  base64: boolean
): RedisRestReply {
  if (value instanceof Error) {
    return { error: value.message };
  }
  if (Array.isArray(value)) {
    return {
      result: value.map((item) => {
        const reply = redisReply(item, base64);
        return "result" in reply ? reply.result : reply;
      }),
    };
  }
  return {
    result:
      base64 && typeof value === "string"
        ? Buffer.from(value).toString("base64")
        : value,
  };
}

export async function executeRedisCommands(
  redisUrl: string,
  commands: RedisRestCommand[],
  transaction: boolean,
  base64: boolean
) {
  if (
    transaction &&
    commands.some(([command]) =>
      REDIS_TRANSACTION_CONTROL_COMMANDS.has(command.toUpperCase())
    )
  ) {
    throw new Error(
      "Transaction control commands are not allowed inside multi-exec."
    );
  }
  const client = createRedisConnection(redisUrl);
  try {
    await client.connect();
    if (transaction) {
      await client.send("MULTI", []);
      for (const [command, ...args] of commands) {
        await client.send(command, args.map(String));
      }
      const results: RedisRestResult[] = await client.send("EXEC", []);
      return results.map((result) => redisReply(result, base64));
    }
    const replies: RedisRestReply[] = [];
    for (const [command, ...args] of commands) {
      try {
        replies.push(
          redisReply(await client.send(command, args.map(String)), base64)
        );
      } catch (error) {
        replies.push({
          error:
            error instanceof Error ? error.message : "Redis command failed.",
        });
      }
    }
    return replies;
  } finally {
    client.close();
  }
}
