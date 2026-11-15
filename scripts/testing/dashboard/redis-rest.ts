import { REDIS_REST_MAX_BODY_BYTES } from "./constants/redis-rest";
import {
  createRedisConnection,
  executeRedisCommands,
  hasRedisAuthorization,
  isLocalRedisRequest,
  readRedisCommands,
  requireRedisRestConfig,
} from "./utils/redis-rest";

const config = requireRedisRestConfig();
// The container's port is published before redis-server accepts connections.
for (let attempt = 1; ; attempt += 1) {
  const probe = createRedisConnection(config.redisUrl);
  try {
    await probe.connect();
    await probe.send("PING", []);
    break;
  } catch (error) {
    if (attempt === 30) {
      throw error;
    }
    await Bun.sleep(500);
  } finally {
    probe.close();
  }
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: config.port,
  maxRequestBodySize: REDIS_REST_MAX_BODY_BYTES,
  async fetch(request, currentServer) {
    if (
      currentServer.port === undefined ||
      !isLocalRedisRequest(request, currentServer.port)
    ) {
      return Response.json(
        { error: "Only direct loopback requests are allowed." },
        { status: 403 }
      );
    }
    if (!hasRedisAuthorization(request, config.token)) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
    const url = new URL(request.url);
    if (
      !["/", "/pipeline", "/multi-exec"].includes(url.pathname) ||
      url.search
    ) {
      return Response.json({ error: "Unsupported route." }, { status: 404 });
    }
    if (request.method !== "POST") {
      return Response.json(
        { error: "Only POST is supported." },
        { status: 405 }
      );
    }
    const batch = url.pathname !== "/";
    let commands;
    try {
      commands = await readRedisCommands(request, batch);
    } catch {
      return Response.json(
        { error: "Invalid or oversized Redis command body." },
        { status: 400 }
      );
    }
    try {
      const replies = await executeRedisCommands(
        config.redisUrl,
        commands,
        url.pathname === "/multi-exec",
        request.headers.get("upstash-encoding") === "base64"
      );
      return Response.json(batch ? replies : replies[0]);
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : "Redis request failed.",
      });
    }
  },
  error() {
    return Response.json(
      { error: "Redis REST request failed." },
      { status: 500 }
    );
  },
});

console.log(
  JSON.stringify({
    origin: `http://127.0.0.1:${server.port}`,
    port: server.port,
  })
);

let stopping = false;
const shutdown = async () => {
  if (stopping) {
    return;
  }
  stopping = true;
  await server.stop();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
