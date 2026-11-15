import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { freePort } from "./sites-worker";

// HTTPS in front of the local Worker, so a site can be served the way
// production serves it: `__Host-` cookies need a Secure context with
// location.protocol "https:". Bodies pass through still encoded.
export async function startTlsProxy(temp: string, targetPort: number) {
  const key = join(temp, "tls-key.pem");
  const cert = join(temp, "tls-cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=sites-e2e.test",
      "-keyout",
      key,
      "-out",
      cert,
    ],
    { stdio: "ignore" }
  );
  const port = await freePort();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    tls: { key: Bun.file(key), cert: Bun.file(cert) },
    fetch: (request) => {
      const url = new URL(request.url);
      return fetch(
        `http://127.0.0.1:${targetPort}${url.pathname}${url.search}`,
        {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: "manual",
          decompress: false,
        }
      );
    },
  });
  return { port, stop: () => server.stop(true) };
}
