import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { Client } from "pg";

const databaseUrl = process.env.SITES_BRANCH_TEST_DATABASE_URL;
const migration = readFileSync(
  new URL("../migrations/0129_content_git_publishing.sql", import.meta.url),
  "utf8"
);
for (const populated of [false, true]) {
  test.skipIf(!databaseUrl)(
    `content publishing migration preserves old writers (${populated ? "populated" : "empty"})`,
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
        const schema = `content_migration_${crypto.randomUUID().replaceAll("-", "")}`;
        await client.query(
          `CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}"; CREATE TABLE repository_outputs(id text PRIMARY KEY, config jsonb); CREATE TABLE content_publications(pull_request_number integer NOT NULL, pull_request_url text NOT NULL);`
        );
        if (populated) {
          await client.query(
            "INSERT INTO repository_outputs VALUES ('existing', '{\"directory\":\"articles\"}')"
          );
        }
        await client.query(migration);
        await client.query(migration);
        await client.query(
          "INSERT INTO repository_outputs(id) VALUES ('old-writer')"
        );
        expect(
          (
            await client.query(
              "SELECT review_process FROM repository_outputs WHERE id='old-writer'"
            )
          ).rows[0].review_process
        ).toBe("pull_request");
        if (populated) {
          expect(
            (
              await client.query(
                "SELECT config FROM repository_outputs WHERE id='existing'"
              )
            ).rows[0].config
          ).toEqual({ directory: "articles" });
        }
        await client.query(
          "UPDATE repository_outputs SET review_process='direct' WHERE id='old-writer'"
        );
        await expect(
          client.query("UPDATE repository_outputs SET review_process='unsafe'")
        ).rejects.toThrow("repositoryOutputs_reviewProcess_check");
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
    }
  );
}
