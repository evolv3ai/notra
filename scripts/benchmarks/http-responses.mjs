import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import http from "node:http";
import { performance } from "node:perf_hooks";

const origin = process.argv[2] ?? "http://127.0.0.1:4317";
const url = new URL(origin);
assert.equal(
  url.hostname,
  "127.0.0.1",
  "Benchmark must use isolated loopback server"
);
const files = await readdir(
  new URL("../../apps/web/.output/public/assets/", import.meta.url)
);
const paths = [
  "/",
  "/llms.txt",
  `/assets/${files.find((name) => name.startsWith("index-") && name.endsWith(".js"))}`,
  `/assets/${files.find((name) => name.endsWith(".css"))}`,
];
const agent = new http.Agent({ keepAlive: true });
const results = [];
try {
  for (const path of paths) {
    for (const encoding of ["identity", "gzip", "br"]) {
      const timings = [];
      const sizes = [];
      let headers;
      let hash;
      for (let i = 0; i < 33; i++) {
        const start = performance.now();
        const response = await new Promise((resolve, reject) => {
          const request = http.get(
            new URL(path, origin),
            { agent, headers: { "Accept-Encoding": encoding } },
            (response) => {
              const chunks = [];
              response.on("data", (chunk) => chunks.push(chunk));
              response.on("end", () =>
                resolve({
                  status: response.statusCode,
                  headers: response.headers,
                  data: Buffer.concat(chunks),
                })
              );
              response.on("error", reject);
            }
          );
          request.setTimeout(15000, () =>
            request.destroy(new Error("Timeout"))
          );
          request.on("error", reject);
        });
        assert.equal(response.status, 200, `${path} status`);
        if (i >= 3) {
          timings.push(performance.now() - start);
          sizes.push(response.data.length);
        }
        headers = response.headers;
        hash = createHash("sha256").update(response.data).digest("hex");
      }
      timings.sort((a, b) => a - b);
      results.push({
        path,
        acceptEncoding: encoding,
        contentEncoding: headers["content-encoding"] ?? null,
        cacheControl: headers["cache-control"] ?? null,
        vary: headers.vary ?? null,
        minBodyBytes: Math.min(...sizes),
        maxBodyBytes: Math.max(...sizes),
        lastBodySha256: hash,
        medianMs: +((timings[14] + timings[15]) / 2).toFixed(3),
        p95Ms: +timings[28].toFixed(3),
        runs: timings.length,
      });
    }
  }
} finally {
  agent.destroy();
}
console.log(
  JSON.stringify({ node: process.version, origin, results }, null, 2)
);
