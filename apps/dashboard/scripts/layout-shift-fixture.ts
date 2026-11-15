import { createHmac } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";

import { isDemoMode } from "@notra/utils/demo-mode";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  databaseUrl.protocol !== "postgresql:" ||
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.port !== "55432" ||
  databaseUrl.pathname !== "/notra_cls" ||
  !isDemoMode()
) {
  throw new Error(
    "Fixture requires demo mode and the disposable local notra_cls database"
  );
}

const password = process.env.WORKOS_COOKIE_PASSWORD;
if (!password || password.length < 32) {
  throw new Error(
    "A synthetic WORKOS_COOKIE_PASSWORD of at least 32 characters is required"
  );
}

const { db } = await import("@notra/db/drizzle");
try {
  const { createDemoSandbox, loadDemoSandbox } =
    await import("../src/lib/demo/sandbox");
  const { DEMO_SESSION_COOKIE, DEMO_SESSION_COOKIE_MAX_AGE_SECONDS } =
    await import("../src/constants/demo");
  const sandbox = await createDemoSandbox({
    timeZone: "Europe/Berlin",
    ipHash: "local-cls-fixture",
  });
  if (!sandbox) {
    throw new Error("Demo fixture creation did not return a sandbox");
  }

  const persistedSandbox = await loadDemoSandbox(sandbox.anonymousId);
  const expires = Math.min(
    Math.floor(Date.now() / 1000) + DEMO_SESSION_COOKIE_MAX_AGE_SECONDS,
    Math.floor((persistedSandbox?.expiresAt.getTime() ?? 0) / 1000)
  );
  if (expires <= Math.floor(Date.now() / 1000)) {
    throw new Error("Synthetic sandbox has expired; rerun fixture setup");
  }

  const payload = Buffer.from(
    JSON.stringify({ anonymousId: sandbox.anonymousId })
  ).toString("base64url");
  const key = createHmac("sha256", password)
    .update("notra-signed-cookie")
    .digest();
  const signature = createHmac("sha256", key)
    .update(payload)
    .digest("base64url");
  const artifact = new URL(
    "../../../.hoplite/artifacts/layout-shift/dashboard-fixture.json",
    import.meta.url
  );
  await mkdir(new URL(".", artifact), { recursive: true });
  const temporaryArtifact = new URL(
    `${artifact.href}.${crypto.randomUUID()}.tmp`
  );
  try {
    await writeFile(
      temporaryArtifact,
      `${JSON.stringify(
        {
          databaseUrl: databaseUrl.toString(),
          organizationId: sandbox.organizationId,
          slug: sandbox.slug,
          url: `http://127.0.0.1:3000/${sandbox.slug}`,
          cookies: [
            {
              name: DEMO_SESSION_COOKIE,
              value: `${payload}.${signature}`,
              domain: "127.0.0.1",
              path: "/",
              httpOnly: true,
              secure: false,
              sameSite: "Lax",
              expires,
            },
          ],
        },
        null,
        2
      )}\n`,
      { mode: 0o600, flag: "wx" }
    );
    await rename(temporaryArtifact, artifact);
  } finally {
    await rm(temporaryArtifact, { force: true });
  }
  console.log(`Created synthetic dashboard fixture: ${sandbox.slug}`);
  console.log(`Fixture expires: ${new Date(expires * 1000).toISOString()}`);
  console.log(`Private browser fixture: ${artifact.pathname}`);
} finally {
  await db.$client.end();
}
