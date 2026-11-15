import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { requireTestDatabaseUrl } from "../../../scripts/testing/dashboard/utils/database";
import type { AuthSessionData } from "../src/types/auth/session";

if (!process.env.SITES_TEST_DATABASE_URL) {
  test.skip("Sites test status tenant checks require seeded SITES_TEST_DATABASE_URL", () => {});
} else if (process.env.NOTRA_SITES_STATUS_TEST_WORKER !== "1") {
  test("Sites test status retains authentication and real PostgreSQL tenant boundaries", () => {
    const databaseUrl = requireTestDatabaseUrl();
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NODE_ENV: "development",
          NOTRA_SITES_STATUS_TEST_WORKER: "1",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
          NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID: "",
        },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr.toString()).toBe(0);
  });
} else {
  let auth: AuthSessionData | null = null;
  mock.module("../src/lib/auth/server", () => ({
    getAuthSession: async () => auth,
  }));
  const { db } = await import("@notra/db/drizzle");
  const { users } = await import("@notra/db/schema");
  const { eq } = await import("drizzle-orm");
  const { GET } = await import("../src/app/__tests/sites/route");
  test("status cannot cross tenant membership or reveal another tenant's site", async () => {
    const request = new Request("http://127.0.0.1:3000/__tests/sites", {
      headers: { host: "127.0.0.1:3000" },
    });
    try {
      expect((await GET(request)).status).toBe(401);
      const owner = await db.query.users.findFirst({
        where: eq(users.id, "sites-e2e-owner"),
      });
      const outsider = await db.query.users.findFirst({
        where: eq(users.id, "sites-e2e-outsider"),
      });
      if (!(owner && outsider)) {
        throw new Error(
          "Run scripts/testing/dashboard/fixtures.ts seed first."
        );
      }
      auth = {
        user: owner,
        session: {
          userId: owner.id,
          activeOrganizationId: "sites-e2e-acme",
          impersonatedBy: null,
        },
      };
      const acme = await GET(request);
      expect(acme.status).toBe(200);
      const acmeStatus = await acme.json();
      expect(acmeStatus.sites).toHaveLength(1);
      expect(acmeStatus.sites[0].id).toBe("sites-e2e-acme-site");
      auth = {
        user: outsider,
        session: {
          userId: outsider.id,
          activeOrganizationId: "sites-e2e-acme",
          impersonatedBy: null,
        },
      };
      expect((await GET(request)).status).toBe(403);
      auth.session.activeOrganizationId = "sites-e2e-other";
      expect((await (await GET(request)).json()).sites).toEqual([]);
      auth.session.activeOrganizationId = null;
      expect((await GET(request)).status).toBe(403);
    } finally {
      await db.$client.end();
    }
  });
}
