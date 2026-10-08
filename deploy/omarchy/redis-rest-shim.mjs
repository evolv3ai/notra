// Sits between Notra and serverless-redis-http (SRH) to cover two gaps between
// SRH and Upstash's hosted REST API:
//
// 1. @upstash/ratelimit marks its Lua scripts with
//    `#!lua flags=allow-key-locking`, which only Upstash's Redis understands;
//    open-source Redis rejects the script. The flag is stripped from request
//    bodies. EVALSHA with the original hash then misses and the client falls
//    back to EVAL, which works.
// 2. SRH has no SUBSCRIBE/PSUBSCRIBE. Upstash serves them as a server-sent
//    event stream (`data: message,<channel>,<payload>`), which @upstash/realtime
//    uses for live chat and dashboard updates. Those requests are answered here
//    from a direct Redis connection.
//
// Everything else is forwarded to SRH unchanged.
import http from "node:http";
import net from "node:net";

const target = new URL(process.env.SHIM_TARGET ?? "http://redis-http:80");
const redisUrl = new URL(process.env.SHIM_REDIS_URL ?? "redis://redis:6379");
const port = Number(process.env.SHIM_PORT ?? 8080);
const token = process.env.SRH_TOKEN;
// The flag line arrives JSON-encoded, so its newline is the two characters "\n".
const keyLockingShebang = /#!lua flags=allow-key-locking(?:\\n|\n)/g;
const subscribePath = /^\/(p?subscribe)\/(.+)$/;

if (!token) {
  throw new Error("SRH_TOKEN must be set");
}

function encodeCommand(args) {
  const parts = [`*${args.length}\r\n`];
  for (const arg of args) {
    parts.push(`$${Buffer.byteLength(arg)}\r\n${arg}\r\n`);
  }
  return parts.join("");
}

// Parses one RESP value at `offset`; returns null until enough bytes arrived.
function parseResp(buffer, offset) {
  const lineEnd = buffer.indexOf("\r\n", offset);
  if (lineEnd === -1) {
    return null;
  }
  const prefix = String.fromCharCode(buffer[offset]);
  const line = buffer.toString("utf8", offset + 1, lineEnd);
  const next = lineEnd + 2;
  if (prefix === "+" || prefix === "-" || prefix === ":") {
    return { next, value: line };
  }
  if (prefix === "$") {
    const length = Number(line);
    if (length < 0) {
      return { next, value: null };
    }
    if (buffer.length < next + length + 2) {
      return null;
    }
    return {
      next: next + length + 2,
      value: buffer.toString("utf8", next, next + length),
    };
  }
  if (prefix === "*") {
    const items = [];
    let cursor = next;
    for (let index = 0; index < Number(line); index += 1) {
      const item = parseResp(buffer, cursor);
      if (!item) {
        return null;
      }
      items.push(item.value);
      cursor = item.next;
    }
    return { next: cursor, value: items };
  }
  throw new Error(`Unexpected RESP prefix ${prefix}`);
}

function handleSubscribe(response, command, path) {
  const targets = path.split("/").filter(Boolean).map(decodeURIComponent);
  const redis = net.connect(Number(redisUrl.port || 6379), redisUrl.hostname);
  let pending = Buffer.alloc(0);

  response.writeHead(200, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream",
  });
  redis.write(encodeCommand([command.toUpperCase(), ...targets]));

  redis.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    let parsed = parseResp(pending, 0);
    while (parsed) {
      pending = pending.subarray(parsed.next);
      if (Array.isArray(parsed.value)) {
        response.write(`data: ${parsed.value.join(",")}\n\n`);
      }
      parsed = pending.length > 0 ? parseResp(pending, 0) : null;
    }
  });
  const close = () => {
    redis.destroy();
    response.end();
  };
  redis.on("error", close);
  redis.on("end", close);
  response.on("close", () => redis.destroy());
}

function forward(request, response, body) {
  const headers = { ...request.headers, host: target.host };
  delete headers["transfer-encoding"];
  headers["content-length"] = String(body.length);

  const upstream = http.request(
    {
      headers,
      hostname: target.hostname,
      method: request.method,
      path: request.url,
      port: target.port || 80,
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers
      );
      upstreamResponse.pipe(response);
    }
  );
  upstream.on("error", (error) => {
    response.writeHead(502, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ error: `redis-rest-shim: ${error.message}` })
    );
  });
  upstream.end(body);
}

const server = http.createServer((request, response) => {
  const subscribe = subscribePath.exec(request.url ?? "");
  if (subscribe) {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    handleSubscribe(response, subscribe[1], subscribe[2]);
    return;
  }

  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.from(
      Buffer.concat(chunks).toString("utf8").replace(keyLockingShebang, "")
    );
    forward(request, response, body);
  });
});

server.listen(port);
