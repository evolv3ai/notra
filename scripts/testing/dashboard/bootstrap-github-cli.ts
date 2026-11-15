import { spawnSync } from "node:child_process";

import { DASHBOARD_SITE_FIXTURES } from "./constants/fixtures";
import { requireTestDatabaseUrl } from "./utils/database";

const databaseUrl = requireTestDatabaseUrl();
const repository = process.argv[2] ?? "";
if (!/^[a-zA-Z0-9-]+\/notra-sites-e2e-[a-z0-9-]+$/.test(repository)) {
  throw new Error(
    "Only an explicitly named disposable Sites E2E repository is allowed"
  );
}
process.env.DATABASE_URL = databaseUrl;
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
const { createDb } = await import("../../../packages/db/src/drizzle");
const { users, socialConnections } =
  await import("../../../packages/db/src/schema");
const { decodeIntegrationEncryptionKey, encryptIntegrationSecret } =
  await import("../../../packages/db/src/utils/integration-encryption");
const { eq } = await import("drizzle-orm");
// The Dashboard under test decrypts the token, so it needs its key.
const encryptionKey = decodeIntegrationEncryptionKey(
  process.env.INTEGRATION_ENCRYPTION_KEY
);
const db = createDb(databaseUrl, 1);
let token = "";
try {
  const fixture = DASHBOARD_SITE_FIXTURES[0];
  const owner = await db.query.users.findFirst({
    where: eq(users.id, fixture.userId),
  });
  if (!owner || owner.email !== fixture.email) {
    throw new Error("Seed the pinned local fixture owner first");
  }
  const selected = spawnSync(
    "gh",
    ["auth", "token", "--hostname", "github.com"],
    {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        GH_TOKEN: process.env.GH_TOKEN,
      },
      encoding: "utf8",
      timeout: 15_000,
    }
  );
  if (selected.status !== 0 || !selected.stdout.trim()) {
    throw new Error("An authenticated GitHub CLI user is required");
  }
  token = selected.stdout.trim();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "notra-sites-e2e",
  };
  const [userResponse, repositoryResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers,
      signal: AbortSignal.timeout(15_000),
    }),
    fetch(`https://api.github.com/repos/${repository}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (!userResponse.ok || !repositoryResponse.ok) {
    throw new Error(
      `GitHub identity/repository verification failed (${userResponse.status}/${repositoryResponse.status})`
    );
  }
  const user = await userResponse.json();
  const repo = await repositoryResponse.json();
  if (
    repo.full_name !== repository ||
    repo.owner.id !== user.id ||
    !repo.private ||
    !repo.permissions?.admin
  ) {
    throw new Error(
      "The disposable private repository must belong to the authenticated CLI user"
    );
  }
  const encryptedAccessToken = encryptIntegrationSecret(token, encryptionKey);
  await db
    .insert(socialConnections)
    .values({
      id: "sites-e2e-github-cli-user",
      userId: fixture.userId,
      provider: "github",
      providerAccountId: String(user.id),
      encryptedAccessToken,
      scope: userResponse.headers.get("x-oauth-scopes"),
    })
    .onConflictDoUpdate({
      target: [socialConnections.userId, socialConnections.provider],
      set: {
        providerAccountId: String(user.id),
        encryptedAccessToken,
        scope: userResponse.headers.get("x-oauth-scopes"),
      },
    });
  console.log(
    JSON.stringify({
      fixtureUserId: fixture.userId,
      githubLogin: user.login,
      repository: repo.full_name,
      source: "authenticated-cli-fixture",
      oauthFlowTested: false,
      installationCreated: false,
    })
  );
} catch (error) {
  const message =
    error instanceof Error ? error.message : "GitHub fixture bootstrap failed";
  console.error(
    JSON.stringify({
      error: token ? message.replaceAll(token, "[redacted]") : message,
    })
  );
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
