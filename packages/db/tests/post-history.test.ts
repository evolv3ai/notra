import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { Client } from "pg";

import { expectConstraint } from "./utils/expect-constraint";

// Runs only against a disposable loopback database that already has every
// migration applied (CI replays them into notra_migrations). Everything happens
// inside a transaction that is rolled back.
const allowedHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const allowedDatabases = new Set([
  "/notra_migrations",
  "/notra_history_test",
  "/notra_sites_branches_fix_20261019",
]);
const candidateUrl = process.env.DATABASE_URL;
const databaseUrl =
  candidateUrl &&
  URL.canParse(candidateUrl) &&
  new URL(candidateUrl).search === "" &&
  allowedHosts.has(new URL(candidateUrl).hostname) &&
  allowedDatabases.has(new URL(candidateUrl).pathname)
    ? candidateUrl
    : undefined;

describe.skipIf(!databaseUrl)("post history triggers on PostgreSQL", () => {
  let client: Client;

  const versions = async () =>
    (
      await client.query(
        "SELECT revision, source, retained, title FROM post_versions WHERE post_id = 'post' ORDER BY revision"
      )
    ).rows;
  const save = async (source: string, set: string, expected?: number) => {
    await client.query("SELECT set_config('notra.history_source', $1, true)", [
      source,
    ]);
    const { rows } = await client.query(
      `UPDATE posts SET ${set} WHERE id = 'post' AND ($1::int IS NULL OR revision = $1) RETURNING revision`,
      [expected ?? null]
    );
    return rows[0]?.revision as number | undefined;
  };

  beforeEach(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO organizations (id, name, slug, created_at) VALUES ('org', 'Org', 'post-history-org', now());
      INSERT INTO post_collections (id, organization_id, source, name) VALUES ('collection', 'org', 'manual', 'Posts');
      INSERT INTO posts (id, organization_id, collection_id, title, content, markdown, content_type, status, hidden, revision)
      VALUES ('post', 'org', 'collection', 'v0', '<p>v0</p>', 'v0', 'blog_post', 'published', true, 42);
    `);
  });

  afterEach(async () => {
    await client.query("ROLLBACK");
    await client.end();
  });

  test("insert starts at revision 0 with a baseline version", async () => {
    expect(await versions()).toEqual([
      { revision: 0, source: "baseline", retained: false, title: "v0" },
    ]);
  });

  test("revision-checked writes reject stale revisions; status-only writes keep the revision", async () => {
    expect(await save("editor_save", "title = 'v1'", 0)).toBe(1);
    expect(await save("editor_save", "title = 'stale'", 0)).toBeUndefined();
    expect(
      await save(
        "system",
        "status = 'draft', hidden = false, updated_at = now()"
      )
    ).toBe(1);
    expect(await save("editor_save", "title = 'v2'", 1)).toBe(2);
    expect((await versions()).map((row) => row.title)).toEqual([
      "v0",
      "v1",
      "v2",
    ]);
  });

  test("throttled autosaves are checkpointed by the next manual save", async () => {
    expect(await save("editor_autosave", "title = 'auto 1'", 0)).toBe(1);
    expect(await save("editor_autosave", "title = 'auto 2'", 1)).toBe(2);
    expect(await save("editor_save", "title = 'saved'", 2)).toBe(3);
    expect(await versions()).toEqual([
      { revision: 0, source: "baseline", retained: false, title: "v0" },
      { revision: 2, source: "checkpoint", retained: false, title: "auto 2" },
      { revision: 3, source: "editor_save", retained: true, title: "saved" },
    ]);
  });

  test("capturing a manual save retains an existing autosave version", async () => {
    await client.query(
      "UPDATE post_versions SET created_at = now() - interval '2 minutes' WHERE post_id = 'post'"
    );
    expect(await save("editor_autosave", "title = 'auto'", 0)).toBe(1);
    await client.query(
      "SELECT notra_capture_post_version(posts, 'editor_save', NULL) FROM posts WHERE id = 'post'"
    );
    expect((await versions()).at(-1)).toEqual({
      revision: 1,
      source: "editor_autosave",
      retained: true,
      title: "auto",
    });
  });

  test("pruning drops old unretained versions but keeps retained and latest", async () => {
    await save("editor_save", "title = 'v1'");
    await save("ai", "title = 'v2'");
    await save("api", "title = 'v3'");
    await client.query(
      "UPDATE post_versions SET created_at = now() - interval '91 days' WHERE post_id = 'post'"
    );
    const { rows } = await client.query(
      "SELECT notra_prune_post_history('org', 'post') AS deleted"
    );
    expect(rows[0].deleted).toBe(2);
    expect(await versions()).toEqual([
      { revision: 1, source: "editor_save", retained: true, title: "v1" },
      { revision: 3, source: "api", retained: false, title: "v3" },
    ]);
  });

  test("restoring identical content still bumps the revision and keeps status and visibility", async () => {
    expect(await save("restore", "title = 'v0'", 0)).toBe(1);
    const { rows } = await client.query(
      "SELECT status, hidden, revision FROM posts WHERE id = 'post'"
    );
    expect(rows[0]).toEqual({ status: "published", hidden: true, revision: 1 });
    expect((await versions()).map((row) => row.source)).toEqual([
      "baseline",
      "restore",
    ]);
  });

  test("short-form posts get revisions but no history", async () => {
    await client.query(
      "UPDATE posts SET content_type = 'linkedin_post', markdown = NULL WHERE id = 'post'"
    );
    await client.query("DELETE FROM post_versions WHERE post_id = 'post'");
    expect(await save("editor_save", "content = '<p>new</p>'")).toBe(2);
    expect(await versions()).toEqual([]);
  });

  test("anchors are limited to top-level content comments and cascade with the post", async () => {
    await expectConstraint(
      client,
      `INSERT INTO discussion_comments (id, organization_id, content_id, parent_id, depth, body, anchor)
       VALUES ('reply', 'org', 'post', 'missing', 1, 'Reply', '{"quote":"v0"}')`,
      "discussionComments_anchor_check",
      "23514"
    );
    await client.query(
      `INSERT INTO discussion_comments (id, organization_id, content_id, body, anchor)
       VALUES ('comment', 'org', 'post', 'Note', '{"quote":"v0"}')`
    );
    await client.query("DELETE FROM posts WHERE id = 'post'");
    const { rows } = await client.query(
      "SELECT (SELECT count(*) FROM post_versions WHERE post_id = 'post')::int AS versions, (SELECT count(*) FROM discussion_comments WHERE id = 'comment')::int AS comments"
    );
    expect(rows[0]).toEqual({ versions: 0, comments: 0 });
  });
});
