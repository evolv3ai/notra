import assert from "node:assert/strict";

import { requireTestDatabaseUrl } from "./utils/database";

requireTestDatabaseUrl();
const base = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
if (
  base.protocol !== "http:" ||
  base.hostname !== "127.0.0.1" ||
  !base.port ||
  base.username ||
  base.password
) {
  throw new Error(
    "Verification requires an explicit-port loopback HTTP origin."
  );
}
const started = performance.now();
const response = await fetch(new URL("/__tests/sites", base));
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-store");
const status = await response.json();
assert.equal(status.organization.id, "sites-e2e-acme");
assert.equal(status.sites.length, 1);
assert.equal(status.sites[0].id, "sites-e2e-acme-site");
for (const headers of [
  new Headers({ "x-forwarded-for": "203.0.113.1" }),
  new Headers({ "x-forwarded-host": "staging.example.test" }),
]) {
  const blocked = await fetch(new URL("/__tests/sites", base), { headers });
  assert.equal(blocked.status, 404);
}
assert.equal(
  (await fetch(new URL("/__tests/sites", base), { method: "POST" })).status,
  405
);
const session = await fetch(new URL("/api/session", base));
assert.equal(session.status, 200);
assert.equal((await session.json()).user.id, "sites-e2e-owner");
console.log(
  JSON.stringify({
    command: "verify",
    durationMs: +(performance.now() - started).toFixed(2),
    status,
    sitesRuntimeReady: status.sitesRuntimeConfigured,
  })
);
