import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { Client } from "pg";

const databaseUrl =
  process.env.SITES_BRANCH_TEST_DATABASE_URL ??
  process.env.SITES_TEST_DATABASE_URL;
const migration = readFileSync(
  new URL("../migrations/0128_sites_branch_workflow.sql", import.meta.url),
  "utf8"
);

for (const populated of [false, true]) {
  test.skipIf(!databaseUrl)(
    `branch migration preserves old and new writes (${populated ? "populated" : "empty"})`,
    async () => {
      const url = new URL(databaseUrl ?? "");
      expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
      expect(
        url.pathname.startsWith("/notra_sites_branches_") ||
          url.pathname === "/notra_migrations"
      ).toBe(true);
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        await client.query("BEGIN");
        const schema = `branch_migration_${crypto.randomUUID().replaceAll("-", "")}`;
        await client.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";
        CREATE TABLE users(id text PRIMARY KEY);
        CREATE TABLE sites (id text PRIMARY KEY, production_branch text NOT NULL, publish_mode text DEFAULT 'pull_request', CONSTRAINT "sites_publishMode_check" CHECK (publish_mode IN ('pull_request','direct')));
        CREATE TABLE site_drafts (id text PRIMARY KEY, site_id text NOT NULL, path text NOT NULL, content text NOT NULL);
        CREATE UNIQUE INDEX "siteDrafts_site_path_uidx" ON site_drafts(site_id,path);
        INSERT INTO sites (id, production_branch) VALUES ('synthetic','deploy');`);
        if (populated) {
          await client.query(
            "INSERT INTO site_drafts VALUES ('original','synthetic','blog.json','old')"
          );
        }
        await client.query(migration);
        // An existing dev database can already contain the branch workflow objects from an earlier development migration.
        await client.query(migration);
        if (populated) {
          expect(
            (await client.query("SELECT branch FROM site_drafts")).rows
          ).toEqual([{ branch: "deploy" }]);
        }
        // The old deployment still omits branch and uses this exact conflict target.
        await client.query(
          `INSERT INTO site_drafts(id,site_id,path,content) VALUES ('legacy','synthetic','blog.json','new') ON CONFLICT (site_id,path) DO UPDATE SET content=excluded.content`
        );
        expect(
          (await client.query("SELECT branch, content FROM site_drafts")).rows
        ).toEqual([{ branch: "deploy", content: "new" }]);
        await client.query(
          `INSERT INTO site_branch_drafts(id,site_id,branch,path,content) VALUES ('feature','synthetic','notra/site-edit-test','blog.json','feature') ON CONFLICT (site_id,branch,path) DO UPDATE SET content=excluded.content`
        );
        expect(
          (
            await client.query(
              "SELECT count(*)::int AS count FROM site_branch_drafts"
            )
          ).rows[0].count
        ).toBe(1);
        expect(
          (await client.query("SELECT publish_mode FROM sites")).rows[0]
            .publish_mode
        ).toBe("pull_request");
        await expect(
          client.query(
            `INSERT INTO site_branch_drafts(id,site_id,branch,path,content) VALUES ('duplicate','synthetic','notra/site-edit-test','blog.json','x')`
          )
        ).rejects.toThrow("duplicate key");
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
    }
  );
}
