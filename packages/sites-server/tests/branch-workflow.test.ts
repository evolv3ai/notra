import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { Site } from "../src/types/sites";
import { canMergeBranch } from "../src/utils/branch-pull-request";
import { clearSourceBlobCache } from "../src/utils/source-blob-cache";
import { deferred } from "./utils/deferred";
import { startFakeGitHub } from "./utils/fake-github";
import { seedSiteProject } from "./utils/site-project";
import { waitForPgBlocker } from "./utils/wait-for-pg-blocker";

const databaseUrl =
  process.env.SITES_BRANCH_TEST_DATABASE_URL ??
  process.env.SITES_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  expect(url.search).toBe("");
  expect(
    url.pathname.startsWith("/notra_sites_branches_") ||
      url.pathname === "/notra_server_audit" ||
      url.pathname === "/notra_migrations"
  ).toBe(true);
}
if (!databaseUrl) {
  test.skip("branch workflow integration requires a throwaway local SITES_BRANCH_TEST_DATABASE_URL", () => {});
} else if (process.env.NOTRA_BRANCH_WORKER !== "1") {
  test("branch workflow with local HTTP GitHub and real PostgreSQL", () => {
    const url = new URL(databaseUrl);
    expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
    expect(
      url.pathname.startsWith("/notra_sites_branches_") ||
        url.pathname === "/notra_server_audit" ||
        url.pathname === "/notra_migrations"
    ).toBe(true);
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NOTRA_BRANCH_WORKER: "1",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
        },
        timeout: 90_000,
      }
    );
    expect(
      result.status,
      result.stdout.toString() + result.stderr.toString()
    ).toBe(0);
  }, 95_000);
} else {
  const fake = await startFakeGitHub();
  const octokit = await import("@notra/ai/utils/octokit");
  const originalOctokit = octokit.createOctokit;
  mock.module("@notra/ai/utils/octokit", () => ({
    ...octokit,
    createOctokit: (
      token?: string,
      options?: Parameters<typeof originalOctokit>[1]
    ) => originalOctokit(token, { ...options, baseUrl: fake.url }),
  }));
  const github = await import("../src/github");
  mock.module("../src/github", () => ({
    ...github,
    siteRepositoryAccess: async () => ({
      repository: { owner: "synthetic", repo: "blog" },
      token: "local-fake-token",
    }),
  }));
  const { db } = await import("@notra/db/drizzle");
  const { organizations, sites, siteDrafts, siteBranchDrafts, users } =
    await import("@notra/db/schema");
  const { eq, sql } = await import("drizzle-orm");
  const editor = await import("../src/editor");
  const branches = await import("../src/branches");
  const { requiresPullRequest } =
    await import("../src/utils/branch-protection");
  const { withSiteBranchLock } = await import("../src/utils/site-branch-lock");
  const organizationId = `branches-${crypto.randomUUID()}`;
  const userId = `${organizationId}-user`;
  await db.insert(users).values({
    id: userId,
    name: "Synthetic tester",
    email: `${userId}@example.test`,
  });
  let site: Site;
  await db.insert(organizations).values({
    id: organizationId,
    name: "Synthetic branch tests",
    slug: organizationId,
    createdAt: new Date(),
  });
  const projectId = await seedSiteProject(organizationId);
  beforeEach(async () => {
    clearSourceBlobCache();
    await db.delete(sites).where(eq(sites.organizationId, organizationId));
    const [created] = await db
      .insert(sites)
      .values({
        id: `site_${crypto.randomUUID()}`,
        organizationId,
        projectId,
        name: "Synthetic",
        slug: crypto.randomUUID().slice(0, 8),
        publicOrigin: "https://synthetic.example.test",
        mounts: { blog: "/blog" },
        productionBranch: "main",
      })
      .returning();
    if (!created) {
      throw new Error("Site seed failed");
    }
    site = created;
    fake.state.branches = new Map([["main", "initial"]]);
    fake.state.prs = [];
    fake.state.commitDelayMs = 0;
    fake.state.commitMetadataError = false;
    fake.state.beforeCommitMetadata = async () => {};
    fake.state.loseRenameResponse = false;
    fake.state.hideClassicProtection = false;
    fake.state.protectionRules = null;
    fake.state.protectionError = false;
    fake.state.omitProtected = false;
    fake.state.rejectedMergeMethods = [];
    fake.state.prErrorMessage = "";
    fake.state.beforeTree = async () => {};
    fake.state.classicPR = false;
    fake.state.rulesPR = false;
    fake.state.otherProtection = false;
    fake.state.protectedFeatures = false;
    fake.state.rejectDraft = false;
    fake.state.failPR = false;
    fake.state.staleCommit = false;
    fake.state.commitCount = 0;
    fake.state.calls = [];
    fake.state.beforeRead = async () => {};
    fake.state.beforeCommit = async () => {};
  });
  afterAll(async () => {
    fake.stop();
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, userId));
    await db.$client.end();
  });
  const input = (branch = "main", content = '{"name":"Changed"}') => ({
    branch,
    path: "blog.json",
    content,
    baseBlobSha: fake.blob('{"name":"Synthetic blog"}'),
    baseCommitSha: "initial",
    draftId: null,
    draftRevision: null,
    userId,
    sourceContext: {
      repositoryId: "",
      productionBranch: "main",
      rootDirectory: "",
    },
  });
  const save = async (branch = "main", content?: string) =>
    editor.saveSiteDraft(site, {
      ...input(branch, content),
      userId,
    });
  const flush = (branch = "main") =>
    editor.flushSiteDrafts(site, {
      branch,
      message: "Synthetic changes",
      userId,
    });

  test("protection fails closed for status checks, restricted pushes, locked branches, rulesets and API errors", async () => {
    const access = await github.siteRepositoryAccess(site, {
      contents: "read",
    });
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(false);
    fake.state.otherProtection = true;
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(true);
    fake.state.otherProtection = false;
    for (const rule of [
      "update",
      "required_status_checks",
      "pull_request",
      "required_signatures",
      "lock_branch",
      "future_unknown_rule",
    ]) {
      fake.state.protectionRules = [rule];
      expect(
        await requiresPullRequest(access.repository, access.token, "main")
      ).toBe(true);
    }
    fake.state.protectionRules = ["non_fast_forward", "deletion"];
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(false);
    for (const status of [403, 404, 503]) {
      fake.state.protectionError = status;
      expect(
        await requiresPullRequest(access.repository, access.token, "main")
      ).toBe(true);
    }
    fake.state.protectionError = false;
    fake.state.protectionRules = null;
    fake.state.rulesetsUnavailable = true;
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(false);
    fake.state.otherProtection = true;
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(true);
    fake.state.otherProtection = false;
    fake.state.rulesetsUnavailable = false;
    fake.state.omitProtected = true;
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(true);
    fake.state.omitProtected = false;
    fake.state.classicPR = true;
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(true);
    fake.state.classicPR = false;
    fake.state.protectionRules = null;
    fake.state.rulesPR = true;
    await save();
    await expect(flush()).rejects.toThrow("Create a new branch");
    expect(fake.state.commitCount).toBe(0);
  });
  test("unexplained protected refs fail closed when classic rules are hidden", async () => {
    fake.state.classicPR = true;
    fake.state.hideClassicProtection = true;
    const access = await github.siteRepositoryAccess(site, {
      contents: "read",
    });
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(true);
  });
  test("deletion and force-push rules protect the ref without blocking ordinary publication", async () => {
    fake.state.protectionRules = ["non_fast_forward", "deletion"];
    const access = await github.siteRepositoryAccess(site, {
      contents: "read",
    });
    expect(
      await requiresPullRequest(access.repository, access.token, "main")
    ).toBe(false);
    expect((await branches.siteBranchStatus(site)).canPublishDirect).toBe(true);
    await save();
    await flush();
    expect(fake.state.commitCount).toBe(1);
    fake.state.classicPR = true;
    expect((await branches.siteBranchStatus(site)).canPublishDirect).toBe(
      false
    );
  });
  test("status-checks-only protection offers Create branch and no direct publication", async () => {
    fake.state.otherProtection = true;
    const status = await branches.siteBranchStatus(site);
    expect(status.canPublishDirect).toBe(false);
    expect(status.canEdit).toBe(true);
    expect(status.protected).toBe(true);
  });
  test("fresh REST protection overrides a cached unprotected status", async () => {
    expect((await branches.siteBranchStatus(site)).canPublishDirect).toBe(true);
    fake.state.otherProtection = true;
    expect((await branches.siteBranchStatus(site)).canPublishDirect).toBe(
      false
    );
  });
  test("restricted pushes and lock-branch REST protection fail closed without a PR rule", async () => {
    fake.state.classicPR = true;
    fake.state.protectionRules = [];
    expect((await branches.siteBranchStatus(site)).canPublishDirect).toBe(
      false
    );
  });
  test("validation reads an immutable commit without treating its SHA as an editable branch", async () => {
    expect((await editor.validateSiteDrafts(site)).ok).toBe(true);
  });
  test("production publication validates, commits, and consumes only its own drafts", async () => {
    fake.state.branches.set("notra/site-edit-other", "initial");
    await save();
    await save("notra/site-edit-other");
    await editor.publishSiteDrafts(site, { message: "Publish", userId });
    expect((await editor.listSiteDrafts(site.id, "main")).length).toBe(0);
    expect(
      (await editor.listSiteDrafts(site.id, "notra/site-edit-other")).length
    ).toBe(1);
    expect(fake.state.prs).toHaveLength(0);
    await db.delete(siteDrafts).where(eq(siteDrafts.siteId, site.id));
    await save("main", "{");
    await expect(flush()).rejects.toThrow("Fix the errors first");
  });
  test("bring moves drafts without a commit; the first flush commits and opens a draft PR", async () => {
    await save();
    const brought = await branches.createSiteBranch(site, {
      title: "Bring changes",
      bringChanges: true,
      userId,
    });
    expect(fake.state.commitCount).toBe(0);
    expect(fake.state.prs).toHaveLength(0);
    expect(await editor.listSiteDrafts(site.id, "main")).toHaveLength(0);
    expect(await editor.listSiteDrafts(site.id, brought.branch)).toHaveLength(
      1
    );
    await flush(brought.branch);
    expect(fake.state.prs).toHaveLength(1);
    expect(fake.state.prs[0]?.draft).toBe(true);
    expect(fake.state.prs[0]?.head.ref).toBe(brought.branch);
    expect(await editor.listSiteDrafts(site.id, brought.branch)).toHaveLength(
      0
    );
    await save();
    const left = await branches.createSiteBranch(site, {
      title: "Leave changes",
      bringChanges: false,
      userId,
    });
    expect(fake.state.branches.get(left.branch)).toBe("initial");
    expect(fake.state.prs).toHaveLength(1);
    expect(await editor.listSiteDrafts(site.id, "main")).toHaveLength(1);
  });
  test("a branch created from committed changes reports them and opens a ready PR on review", async () => {
    const { branch: source } = await branches.createSiteBranch(site, {
      title: "Source",
      bringChanges: false,
      userId,
    });
    await save(source);
    await flush(source);
    const { branch } = await branches.createSiteBranch(site, {
      branch: source,
      title: "Copy",
      bringChanges: true,
      userId,
    });
    expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(0);
    const status = await branches.siteBranchStatus(site, branch);
    expect(status.pullRequest).toBeNull();
    expect(status.changedFiles).toBe(1);
    await branches.requestSiteBranchReview(site, branch);
    const pr = fake.state.prs.find((entry) => entry.head.ref === branch);
    expect(pr?.draft).toBe(false);
    await expect(
      branches.requestSiteBranchReview(site, branch)
    ).rejects.toThrow("already ready");
  });
  test("a failed draft move rolls back every row and creates no branch", async () => {
    const original = await save();
    const post = await editor.saveSiteDraft(site, {
      ...input(),
      path: "blog/hello.md",
      content: "Updated post",
      baseBlobSha: fake.blob(
        "---\ntitle: Hello\ndate: 2026-10-19\ndescription: Synthetic\n---\nHello world."
      ),
    });
    const fn = `reject_cleanup_${crypto.randomUUID().replaceAll("-", "")}`;
    await db.execute(
      sql.raw(
        `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = '${post.id}' THEN RAISE EXCEPTION 'Synthetic cleanup failure'; END IF; RETURN OLD; END; $$; CREATE TRIGGER ${fn} BEFORE DELETE ON site_drafts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
      )
    );
    try {
      await expect(
        branches.createSiteBranch(site, {
          title: "Cleanup failure",
          bringChanges: true,
          userId,
        })
      ).rejects.toThrow();
      expect(
        (await editor.listSiteDrafts(site.id, "main"))
          .map((draft) => draft.id)
          .sort()
      ).toEqual([original.id, post.id].sort());
      expect(
        await db
          .select()
          .from(siteBranchDrafts)
          .where(eq(siteBranchDrafts.siteId, site.id))
      ).toHaveLength(0);
      expect(fake.state.calls).not.toContain(
        "POST /repos/synthetic/blog/git/refs"
      );
    } finally {
      await db.execute(
        sql.raw(`DROP TRIGGER ${fn} ON site_drafts; DROP FUNCTION ${fn}()`)
      );
    }
  });
  test("bringing a newer draft from a previously committed feature branch preserves pending content", async () => {
    const branch = "notra/site-edit-bring-newer";
    fake.state.branches.set(branch, "initial");
    const original = await save(branch);
    await flush(branch);
    await editor.saveSiteDraft(site, {
      ...input(branch, '{"name":"Newer branch content"}'),
      draftId: original.id,
      draftRevision: original.revision,
    });
    const created = await branches.createSiteBranch(site, {
      branch,
      title: "Moved newer",
      bringChanges: true,
      userId,
    });
    await flush(created.branch);
    expect(
      fake.state.commits
        .get(fake.state.branches.get(created.branch) ?? "")
        ?.get("blog.json")
    ).toBe('{"name":"Newer branch content"}');
    expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(0);
  });
  test("feature commits always flush and draft creation falls back after 422", async () => {
    const branch = "notra/site-edit-test";
    fake.state.branches.set(branch, "initial");
    fake.state.rejectDraft = true;
    await save(branch);
    await flush(branch);
    expect(fake.state.prs).toHaveLength(1);
    expect(fake.state.prs[0]?.draft).toBe(false);
    expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(0);
    expect(
      fake.state.calls.filter(
        (call) => call === "POST /repos/synthetic/blog/pulls"
      )
    ).toHaveLength(2);
  });
  test("feature commits drop committed image drafts but keep committed text drafts", async () => {
    const branch = "notra/site-edit-image";
    fake.state.branches.set(branch, "initial");
    await editor.saveSiteDraft(site, {
      ...input(branch),
      path: "public/images/logo.png",
      // 1×1 transparent PNG.
      content:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      baseBlobSha: null,
    });
    await save(branch);
    await flush(branch);
    const rows = await db
      .select({ path: siteBranchDrafts.path })
      .from(siteBranchDrafts)
      .where(eq(siteBranchDrafts.branch, branch));
    expect(rows.map((row) => row.path)).toEqual(["blog.json"]);
  });
  test("PR creation failure keeps drafts and retries without duplicating the commit", async () => {
    const branch = "notra/site-edit-retry";
    fake.state.branches.set(branch, "initial");
    await save(branch);
    fake.state.failPR = true;
    await expect(flush(branch)).rejects.toThrow();
    expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(1);
    fake.state.failPR = false;
    await flush(branch);
    expect(fake.state.commitCount).toBe(1);
    expect(fake.state.prs).toHaveLength(1);
  });
  test("revision CAS preserves newer edits during a flush and advances their base for the next flush", async () => {
    const branch = "notra/site-edit-cas";
    fake.state.branches.set(branch, "initial");
    const draft = await save(branch);
    fake.state.beforeCommit = async () => {
      await editor.saveSiteDraft(site, {
        ...input(branch, '{"name":"Newer"}'),
        draftId: draft.id,
        draftRevision: draft.revision,
        userId,
      });
    };
    await flush(branch);
    const [newer] = await editor.listSiteDrafts(site.id, branch);
    expect(newer?.content).toBe('{"name":"Newer"}');
    expect(newer?.revision).toBe(1);
    fake.state.beforeCommit = async () => {};
    await flush(branch);
    expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(0);
    expect(fake.state.prs).toHaveLength(1);
  });
  test("clean production publication removes rows from the legacy draft listing and accepts a new draft", async () => {
    await save();
    const published = await flush();
    expect(await editor.listSiteDrafts(site.id)).toEqual([]);
    expect(
      await db.select().from(siteDrafts).where(eq(siteDrafts.siteId, site.id))
    ).toEqual([]);
    const next = await editor.saveSiteDraft(site, {
      ...input("main", '{"name":"Next edit"}'),
      baseCommitSha: published.commitSha,
      baseBlobSha: fake.blob('{"name":"Changed"}'),
    });
    expect(next.content).toBe('{"name":"Next edit"}');
    await flush();
    expect(
      await db.select().from(siteDrafts).where(eq(siteDrafts.siteId, site.id))
    ).toEqual([]);
  });
  test.each(["commit", "final tree"])(
    "production saves during the %s survive cleanup with an updated base",
    async (phase) => {
      const draft = await save();
      const saveNewer = async () => {
        await editor.saveSiteDraft(site, {
          ...input("main", '{"name":"Newer production edit"}'),
          draftId: draft.id,
          draftRevision: draft.revision,
        });
      };
      if (phase === "commit") {
        fake.state.beforeCommit = saveNewer;
      } else {
        fake.state.beforeTree = async (ref) => {
          if (ref !== "initial") {
            fake.state.beforeTree = async () => {};
            await saveNewer();
          }
        };
      }
      const published = await flush();
      const [newer] = await editor.listSiteDrafts(site.id);
      expect(newer?.content).toBe('{"name":"Newer production edit"}');
      expect(newer?.id).toBe(draft.id);
      expect(newer?.revision).toBe(draft.revision + 1);
      expect(newer?.committedRevision).toBe(draft.revision);
      expect(newer?.baseCommitSha).toBe(published.commitSha);
      fake.state.beforeCommit = async () => {};
      await flush();
      expect(
        await db.select().from(siteDrafts).where(eq(siteDrafts.siteId, site.id))
      ).toEqual([]);
      expect(
        fake.state.commits
          .get(fake.state.branches.get("main") ?? "")
          ?.get("blog.json")
      ).toBe(newer?.content);
    }
  );
  test("outside pushes and stale expected heads report conflicts without removing drafts", async () => {
    await save();
    fake.push("main", "blog.json", '{"name":"Remote"}');
    await expect(flush()).rejects.toThrow("Changed on GitHub");
    fake.state.branches.set("main", "initial");
    fake.state.staleCommit = true;
    await expect(flush()).rejects.toThrow("moved while publishing");
    expect(await editor.listSiteDrafts(site.id, "main")).toHaveLength(1);
  });
  test("a production save queued behind flush cleanup recreates the consumed row with the published base", async () => {
    const draft = await save();
    const locked = deferred();
    const release = deferred();
    let holderPid = 0;
    const holding = db.transaction(async (tx) => {
      await tx
        .select()
        .from(siteDrafts)
        .where(eq(siteDrafts.id, draft.id))
        .for("update");
      const result = await tx.execute(sql`select pg_backend_pid() as pid`);
      holderPid = Number(result.rows[0]?.pid);
      locked.resolve();
      await release.promise;
    });
    await locked.promise;
    const flushing = flush();
    let saving: ReturnType<typeof save> | undefined;
    try {
      const flushPid = await waitForPgBlocker(db, holderPid);
      saving = editor.saveSiteDraft(site, {
        ...input("main", '{"name":"Typed during cleanup"}'),
        draftId: draft.id,
        draftRevision: draft.revision,
      });
      await waitForPgBlocker(db, flushPid);
    } finally {
      release.resolve();
      await holding;
    }
    const [published, saved] = await Promise.all([flushing, saving]);
    expect(saved?.content).toBe('{"name":"Typed during cleanup"}');
    expect(saved?.revision).toBe(draft.revision + 1);
    expect(saved?.baseCommitSha).toBe(published.commitSha);
    expect(saved?.baseBlobSha).toBe(fake.blob('{"name":"Changed"}'));
    await flush();
    expect(
      await db.select().from(siteDrafts).where(eq(siteDrafts.siteId, site.id))
    ).toEqual([]);
  });
  test("saving a discarded production revision cannot recreate an unpublished draft", async () => {
    const draft = await save();
    const stale = {
      ...input("main", '{"name":"Stale save"}'),
      draftId: draft.id,
      draftRevision: draft.revision,
    };
    await editor.discardSiteDraft(site, stale);
    await expect(editor.saveSiteDraft(site, stale)).rejects.toThrow(
      "another editor"
    );
    expect(await editor.listSiteDrafts(site.id)).toEqual([]);
  });
  test("a remote change during validation cannot publish files from an unvalidated head", async () => {
    await save();
    fake.state.beforeRead = async (path) => {
      if (path === "blog/hello.md") {
        fake.state.beforeRead = async () => {};
        fake.push("main", "blog/hello.md", "Missing required frontmatter");
      }
    };
    await expect(flush()).rejects.toThrow("moved while publishing");
    expect(fake.state.commitCount).toBe(1);
    expect(await editor.listSiteDrafts(site.id, "main")).toHaveLength(1);
  });
  test("review, merge gating and allowed squash method use GitHub status", async () => {
    const { branch } = await branches.createSiteBranch(site, {
      title: "Review",
      bringChanges: false,
      userId,
    });
    await save(branch);
    await flush(branch);
    await expect(branches.mergeSiteBranch(site, branch)).rejects.toThrow(
      "not allowed"
    );
    await branches.requestSiteBranchReview(site, branch);
    const pr = fake.state.prs[0];
    if (!pr) {
      throw new Error("Missing PR");
    }
    pr.reviewDecision = "REVIEW_REQUIRED";
    await expect(branches.mergeSiteBranch(site, branch)).rejects.toThrow(
      "not allowed"
    );
    pr.reviewDecision = "APPROVED";
    pr.mergeable = "UNKNOWN";
    expect(
      canMergeBranch({
        ...pr,
        isDraft: false,
        state: "OPEN",
        merged: false,
        headRefOid: "",
      })
    ).toBe(false);
    pr.mergeable = "MERGEABLE";
    pr.mergeStateStatus = "BLOCKED";
    await expect(branches.mergeSiteBranch(site, branch)).rejects.toThrow(
      "not allowed"
    );
    pr.mergeable = "CONFLICTING";
    pr.mergeStateStatus = "DIRTY";
    await expect(branches.mergeSiteBranch(site, branch)).rejects.toThrow(
      "Resolve this branch's merge conflicts"
    );
    expect(fake.state.calls.some((call) => call.endsWith("/merge"))).toBe(
      false
    );
    expect(fake.state.branches.has(branch)).toBe(true);
    pr.mergeable = "MERGEABLE";
    pr.mergeStateStatus = "CLEAN";
    expect((await branches.mergeSiteBranch(site, branch)).branch).toBe("main");
    expect(fake.state.mergeMethod).toBe("squash");
  });
  test("rename rejects open PRs, moves drafts after closure, and delete closes the new PR", async () => {
    const { branch } = await branches.createSiteBranch(site, {
      title: "Old",
      bringChanges: false,
      userId,
    });
    await save(branch);
    await flush(branch);
    const head = fake.state.branches.get(branch) ?? "";
    const draft = await editor.saveSiteDraft(site, {
      ...input(branch),
      baseBlobSha: fake.blob('{"name":"Changed"}'),
      baseCommitSha: head,
      userId,
    });
    const originalPR = fake.state.prs[0];
    if (!originalPR) {
      throw new Error("Missing PR");
    }
    // The open PR must remain discoverable behind a full page of closed PRs.
    for (let index = 0; index < 100; index++) {
      fake.state.prs.push({
        ...originalPR,
        id: `PR_closed_${index}`,
        node_id: `PR_closed_${index}`,
        number: index + 2,
        state: "closed",
        head: { ...originalPR.head },
        base: { ...originalPR.base },
      });
    }
    for (const base of ["main", "release"]) {
      for (const isDraft of [true, false]) {
        const pr = fake.state.prs[0];
        if (!pr) {
          throw new Error("Missing PR");
        }
        pr.draft = isDraft;
        pr.base.ref = base;
        await expect(
          branches.renameSiteBranch(site, branch, "Renamed")
        ).rejects.toThrow("open pull request");
        expect(fake.state.branches.has(branch)).toBe(true);
        expect((await editor.listSiteDrafts(site.id, branch))[0]?.id).toBe(
          draft.id
        );
        expect(fake.state.calls.some((call) => call.endsWith("/rename"))).toBe(
          false
        );
      }
    }
    originalPR.state = "closed";
    const renamed = await branches.renameSiteBranch(site, branch, "Renamed");
    expect((await editor.listSiteDrafts(site.id, renamed.branch))[0]?.id).toBe(
      draft.id
    );
    expect(fake.state.prs[0]?.head.ref).toBe(branch);
    await flush(renamed.branch);
    const renamedPR = fake.state.prs.find(
      (pr) => pr.head.ref === renamed.branch
    );
    expect(renamedPR?.state).toBe("open");
    await branches.deleteSiteBranch(site, renamed.branch);
    expect(renamedPR?.state).toBe("closed");
    expect(fake.state.branches.has(renamed.branch)).toBe(false);
    expect(await editor.listSiteDrafts(site.id, renamed.branch)).toHaveLength(
      0
    );
    await expect(branches.deleteSiteBranch(site, "main")).rejects.toThrow(
      "deployment branch"
    );
    await expect(branches.renameSiteBranch(site, "main", "no")).rejects.toThrow(
      "deployment branch"
    );
    expect(
      (await branches.listSiteBranches(site, "renamed")).find(
        (entry) => entry.name === renamed.branch
      )?.status
    ).toBe("closed");
  });
  test("rename repairs draft mapping when GitHub commits the rename but drops its response", async () => {
    const branch = "notra/site-edit-lost-response";
    const renamedBranch = "notra/site-edit-recovered";
    fake.state.branches.set(branch, "initial");
    const draft = await save(branch);
    fake.state.loseRenameResponse = true;
    expect(await branches.renameSiteBranch(site, branch, "recovered")).toEqual({
      branch: renamedBranch,
    });
    expect(fake.state.branches.has(branch)).toBe(false);
    expect(fake.state.branches.get(renamedBranch)).toBe("initial");
    expect(await editor.listSiteDrafts(site.id, branch)).toEqual([]);
    expect(await editor.listSiteDrafts(site.id, renamedBranch)).toMatchObject([
      {
        id: draft.id,
        branch: renamedBranch,
        content: draft.content,
        revision: draft.revision,
      },
    ]);
    expect(
      fake.state.calls.filter((call) => call.endsWith("/rename"))
    ).toHaveLength(1);
    expect(fake.state.calls).toContain(
      `GET /repos/synthetic/blog/git/ref/heads/${branch}`
    );
    expect(fake.state.calls).toContain(
      `GET /repos/synthetic/blog/git/ref/heads/${renamedBranch}`
    );
    fake.state.loseRenameResponse = false;
    await flush(renamedBranch);
    expect(await editor.listSiteDrafts(site.id, renamedBranch)).toEqual([]);
  });
  test("an ambiguous rename leaves drafts on the old ref when both refs still exist", async () => {
    const branch = "notra/site-edit-still-here";
    const target = "notra/site-edit-already-exists";
    fake.state.branches.set(branch, "initial");
    fake.state.branches.set(target, "initial");
    const draft = await save(branch);
    fake.state.loseRenameResponse = true;
    const outcome = await branches
      .renameSiteBranch(site, branch, "already exists")
      .catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(Error);
    expect(fake.state.branches.has(branch)).toBe(true);
    expect(fake.state.branches.has(target)).toBe(true);
    expect((await editor.listSiteDrafts(site.id, branch))[0]?.id).toBe(
      draft.id
    );
    expect(await editor.listSiteDrafts(site.id, target)).toEqual([]);
  });
  test.each(["main", "notra/site-edit-target"])(
    "production branch changes reject pending drafts on %s without stranding edits",
    async (draftBranch) => {
      const { updateSiteSettings } = await import("../src/sites");
      const target = "notra/site-edit-target";
      fake.state.branches.set(target, "initial");
      const draft = await save(draftBranch);
      await expect(
        updateSiteSettings(site, { productionBranch: target }, userId)
      ).rejects.toMatchObject({
        name: "SiteInputError",
        message:
          "Publish or discard this site's drafts before changing its repository, branch or root directory",
      });
      const [current] = await db
        .select()
        .from(sites)
        .where(eq(sites.id, site.id));
      expect(current?.productionBranch).toBe("main");
      expect((await editor.listSiteDrafts(site.id, draftBranch))[0]?.id).toBe(
        draft.id
      );
    }
  );
  test("production branch changes reject newer edits over an autosaved feature revision", async () => {
    const { updateSiteSettings } = await import("../src/sites");
    const target = "notra/site-edit-target";
    fake.state.branches.set(target, "initial");
    const draft = await save(target);
    await flush(target);
    const newer = await editor.saveSiteDraft(site, {
      ...input(target, '{"name":"Pending after autosave"}'),
      draftId: draft.id,
      draftRevision: draft.revision,
    });
    expect(newer.committedRevision).toBe(0);
    expect(newer.revision).toBe(1);
    await expect(
      updateSiteSettings(site, { productionBranch: target }, userId)
    ).rejects.toThrow("Publish or discard");
    expect((await editor.listSiteDrafts(site.id, target))[0]?.content).toBe(
      newer.content
    );
  });
  test("a clean target branch can become production while unrelated feature drafts remain editable", async () => {
    const { updateSiteSettings } = await import("../src/sites");
    const target = "notra/site-edit-target";
    const other = "notra/site-edit-other";
    fake.state.branches.set(target, "initial");
    fake.state.branches.set(other, "initial");
    await save(target);
    await flush(target);
    const unrelated = await save(other);
    const updated = await updateSiteSettings(
      site,
      { productionBranch: target },
      userId
    );
    expect(updated.site.productionBranch).toBe(target);
    expect(await editor.listSiteDrafts(site.id, target)).toEqual([]);
    expect((await editor.listSiteDrafts(site.id, other))[0]?.id).toBe(
      unrelated.id
    );
  });
  test("merge tries squash, merge then rebase on 405 even without repository metadata", async () => {
    const { branch } = await branches.createSiteBranch(site, {
      title: "Fallback",
      bringChanges: false,
      userId,
    });
    await save(branch);
    await flush(branch);
    await branches.requestSiteBranchReview(site, branch);
    fake.state.rejectedMergeMethods = ["squash", "merge"];
    const result = await branches.mergeSiteBranch(site, branch);
    expect(result.branch).toBe("main");
    expect(fake.state.mergeMethod).toBe("rebase");
    expect(
      fake.state.calls.filter((call) => call.endsWith("/merge"))
    ).toHaveLength(3);
    expect(fake.state.calls).not.toContain("GET /repos/synthetic/blog");
  });
  test("production deploy is idempotent across concurrent API and push requests", async () => {
    const { enqueueSiteDeployment } = await import("../src/deployments");
    const deployment = {
      siteId: site.id,
      kind: "production" as const,
      previewKey: null,
      branch: "main",
      commitSha: "synthetic-dedupe",
      deduplicateCommit: true,
    };
    const [manual, push] = await Promise.all([
      enqueueSiteDeployment({ ...deployment, trigger: "manual" }),
      enqueueSiteDeployment({ ...deployment, trigger: "push" }),
    ]);
    expect(manual.deployment.id).toBe(push.deployment.id);
    expect(manual.jobId).toBe(push.jobId);
  });
  test("a preview generation between editor publish and its push webhook does not duplicate production", async () => {
    process.env.SITES_HOSTING_DOMAIN = "sites.example.test";
    const { enqueueSiteDeployment } = await import("../src/deployments");
    const request = {
      siteId: site.id,
      kind: "production" as const,
      previewKey: null,
      branch: "main",
      commitSha: "published-sha",
      deduplicateCommit: true,
      trigger: "manual" as const,
    };
    const published = await enqueueSiteDeployment(request);
    await enqueueSiteDeployment({
      ...request,
      kind: "preview",
      previewKey: "pr-1",
      branch: "notra/site-edit-preview",
      commitSha: "preview-sha",
      trigger: "pull_request",
    });
    const webhook = await enqueueSiteDeployment({
      ...request,
      trigger: "push",
    });
    expect(webhook.jobId).toBe(published.jobId);
    expect(webhook.deployment.id).toBe(published.deployment.id);
  });
  test("completed deployments of an old SHA do not suppress a new production generation", async () => {
    const { enqueueSiteDeployment } = await import("../src/deployments");
    const { siteJobs, siteDeployments } = await import("@notra/db/schema");
    const request = {
      siteId: site.id,
      kind: "production" as const,
      previewKey: null,
      branch: "main",
      commitSha: "old-sha",
      deduplicateCommit: true,
      trigger: "push" as const,
    };
    const previous = await enqueueSiteDeployment(request);
    await db
      .update(siteDeployments)
      .set({ status: "ready" })
      .where(eq(siteDeployments.id, previous.deployment.id));
    await db
      .update(siteJobs)
      .set({ status: "done" })
      .where(eq(siteJobs.id, previous.jobId));
    await enqueueSiteDeployment({ ...request, commitSha: "new-sha" });
    const reverted = await enqueueSiteDeployment(request);
    expect(reverted.deployment.id).not.toBe(previous.deployment.id);
    expect(reverted.deployment.generation).toBeGreaterThan(
      previous.deployment.generation
    );
    expect(reverted.deployment.status).toBe("queued");
  });
  test("explicit-SHA deployment resolves metadata from the current commit", async () => {
    const { deployBranchHead } = await import("../src/deploy");
    const { siteDeployments } = await import("@notra/db/schema");
    const sha = fake.push("main", "blog.json", '{"name":"Selected commit"}');
    await deployBranchHead(site, { commitSha: sha, trigger: "manual", userId });
    const [deployment] = await db
      .select()
      .from(siteDeployments)
      .where(eq(siteDeployments.siteId, site.id));
    expect(deployment?.commitSha).toBe(sha);
    expect(deployment?.commitMessage).toBe("Synthetic commit");
    expect(deployment?.commitAuthor).toBe("Synthetic author");
  });
  test("a delayed older publication cannot enqueue after newer production content", async () => {
    const { deployBranchHead } = await import("../src/deploy");
    const { siteDeployments } = await import("@notra/db/schema");
    const olderSha = fake.push("main", "blog.json", '{"name":"Older"}');
    const metadataStarted = deferred();
    const releaseMetadata = deferred();
    fake.state.beforeCommitMetadata = async (sha) => {
      if (sha === olderSha) {
        metadataStarted.resolve();
        await releaseMetadata.promise;
      }
    };
    const older = deployBranchHead(site, {
      commitSha: olderSha,
      trigger: "manual",
      userId,
    }).catch((error: unknown) => error);
    let newerJobId = "";
    let newerSha = "";
    try {
      await metadataStarted.promise;
      newerSha = fake.push("main", "blog.json", '{"name":"Newer"}');
      newerJobId = await deployBranchHead(site, {
        commitSha: newerSha,
        trigger: "manual",
        userId,
      });
    } finally {
      releaseMetadata.resolve();
    }
    expect(await older).toMatchObject({
      name: "SiteInputError",
      message:
        "The branch moved while publishing. Publish its latest changes instead.",
    });
    const deployments = await db
      .select()
      .from(siteDeployments)
      .where(eq(siteDeployments.siteId, site.id));
    expect(deployments).toHaveLength(1);
    expect(deployments[0]?.commitSha).toBe(newerSha);
    expect(deployments[0]?.generation).toBe(1);
    const { siteJobs } = await import("@notra/db/schema");
    expect(
      (
        await db.select().from(siteJobs).where(eq(siteJobs.siteId, site.id))
      ).map((job) => job.id)
    ).toEqual([newerJobId]);
  });
  test("head verification holds generation order against a concurrent push admission", async () => {
    const { enqueueSiteDeployment } = await import("../src/deployments");
    const checking = deferred();
    const release = deferred();
    const request = {
      siteId: site.id,
      kind: "production" as const,
      previewKey: null,
      branch: "main",
      deduplicateCommit: true,
    };
    const older = enqueueSiteDeployment(
      { ...request, commitSha: "older", trigger: "manual" },
      async () => {
        checking.resolve();
        await release.promise;
      }
    );
    let newer: ReturnType<typeof enqueueSiteDeployment> | undefined;
    try {
      await checking.promise;
      const locks = await db.execute(
        sql`select distinct l.pid from pg_locks l join pg_stat_activity a using (pid) where l.relation = 'sites'::regclass and l.mode = 'RowShareLock' and a.datname = current_database() and a.state = 'idle in transaction'`
      );
      const pid = Number(locks.rows[0]?.pid);
      expect(pid).toBeGreaterThan(0);
      newer = enqueueSiteDeployment({
        ...request,
        commitSha: "newer",
        trigger: "push",
      });
      await waitForPgBlocker(db, pid);
    } finally {
      release.resolve();
      await older;
      await newer;
    }
    const [first, second] = await Promise.all([older, newer]);
    expect(first.deployment.generation).toBe(1);
    expect(second?.deployment.generation).toBe(2);
  });
  test("a stale higher-generation manual publish cannot supersede the current head", async () => {
    const { enqueueSiteDeployment, hasNewerDeployment } =
      await import("../src/deployments");
    const { siteDeployments } = await import("@notra/db/schema");
    const request = {
      siteId: site.id,
      kind: "production" as const,
      previewKey: null,
      branch: "main",
      trigger: "manual" as const,
    };
    const current = await enqueueSiteDeployment({
      ...request,
      commitSha: "newer",
    });
    const stale = await enqueueSiteDeployment({
      ...request,
      commitSha: "older",
    });
    expect(await hasNewerDeployment(current.deployment, "newer")).toBe(false);
    await db
      .update(siteDeployments)
      .set({ trigger: "redeploy" })
      .where(eq(siteDeployments.id, stale.deployment.id));
    expect(await hasNewerDeployment(current.deployment, "newer")).toBe(true);
  });
  test("metadata failure after a commit lands still queues the selected SHA", async () => {
    const { deployBranchHead } = await import("../src/deploy");
    const { siteDeployments } = await import("@notra/db/schema");
    const published = await save().then(() => flush());
    fake.state.commitMetadataError = true;
    const jobId = await deployBranchHead(site, {
      commitSha: published.commitSha,
      trigger: "manual",
      userId,
    });
    expect(jobId).toBeTruthy();
    const [deployment] = await db
      .select()
      .from(siteDeployments)
      .where(eq(siteDeployments.siteId, site.id));
    expect(deployment?.commitSha).toBe(published.commitSha);
    expect(deployment?.commitMessage).toBe("");
    expect(deployment?.commitAuthor).toBe("");
  });
  test.each(["main", "notra/site-edit-slow-discard"])(
    "discard on %s waits through a slow GitHub commit",
    async (branch) => {
      fake.state.branches.set(branch, "initial");
      const draft = await save(branch);
      const started = deferred();
      fake.state.beforeCommit = async () => {
        started.resolve();
      };
      fake.state.commitDelayMs = 2500;
      const flushing = flush(branch);
      await started.promise;
      const discard = editor.discardSiteDraft(site, {
        ...input(branch),
        draftId: draft.id,
        draftRevision: draft.revision,
      });
      await Promise.all([flushing, discard]);
      expect(fake.state.commitCount).toBe(1);
      expect(await editor.listSiteDrafts(site.id, branch)).toEqual([]);
    }
  );
  test("pagehide flush succeeds without a second commit while another slow flush owns the lock", async () => {
    const branch = "notra/site-edit-keepalive";
    fake.state.branches.set(branch, "initial");
    await save(branch);
    const started = deferred();
    fake.state.beforeCommit = async () => {
      started.resolve();
    };
    fake.state.commitDelayMs = 2500;
    const flushing = flush(branch);
    try {
      await started.promise;
      await editor.flushSiteDrafts(site, {
        branch,
        userId,
        message: "Pagehide",
        skipIfBusy: true,
      });
      expect(fake.state.commitCount).toBe(0);
    } finally {
      await flushing;
    }
    expect(fake.state.commitCount).toBe(1);
    expect(await editor.listSiteDrafts(site.id, branch)).toEqual([]);
  });
  test("discard waits until an active flush has completed before removing the draft", async () => {
    const branch = "notra/site-edit-discard-race";
    fake.state.branches.set(branch, "initial");
    const draft = await save(branch);
    const committing = deferred();
    const release = deferred();
    fake.state.beforeCommit = async () => {
      committing.resolve();
      await release.promise;
    };
    const flushing = flush(branch);
    let discarded: Promise<void> | undefined;
    try {
      await committing.promise;
      const locks = await db.execute(
        sql`select l.pid from pg_locks l join pg_stat_activity a using (pid) where l.locktype = 'advisory' and l.mode = 'ShareLock' and l.granted and a.datname = current_database()`
      );
      const pid = Number(locks.rows[0]?.pid);
      expect(pid).toBeGreaterThan(0);
      discarded = editor.discardSiteDraft(site, {
        ...input(branch),
        draftId: draft.id,
        draftRevision: draft.revision,
      });
      await waitForPgBlocker(db, pid);
      expect(fake.state.commitCount).toBe(0);
      expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(1);
    } finally {
      release.resolve();
      await flushing;
      await discarded;
    }
    expect(fake.state.commitCount).toBe(1);
    expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(0);
  });
  test("a reopened PR is found ahead of more than a page of newer closed PRs", async () => {
    const { branch } = await branches.createSiteBranch(site, {
      title: "Reopened",
      bringChanges: false,
      userId,
    });
    await save(branch);
    await flush(branch);
    const original = fake.state.prs[0];
    if (!original) {
      throw new Error("Missing PR");
    }
    for (let index = 0; index < 105; index += 1) {
      fake.state.prs.push({
        ...original,
        id: `closed-${index}`,
        node_id: `closed-${index}`,
        number: index + 2,
        state: "closed",
      });
    }
    const status = await branches.siteBranchStatus(site, branch);
    expect(status.pullRequest?.number).toBe(original.number);
    expect(status.pullRequest?.state).toBe("OPEN");
  });
  test("foreign branches cannot be listed, read, saved, flushed, renamed, deleted or used as a source", async () => {
    const branch = "feature/external";
    fake.state.branches.set(branch, "initial");
    expect(
      (await branches.listSiteBranches(site, "external")).map(
        (entry) => entry.name
      )
    ).toEqual([site.productionBranch]);
    const calls = fake.state.calls.length;
    for (const run of [
      () => branches.renameSiteBranch(site, branch, "Imported"),
      () => branches.deleteSiteBranch(site, branch),
      () => save(branch),
      () => flush(branch),
      () => editor.listSiteSourceFiles(site, branch),
      () => branches.siteBranchStatus(site, branch),
      () =>
        branches.createSiteBranch(site, {
          branch,
          title: "Imported",
          bringChanges: true,
          userId,
        }),
    ]) {
      await expect(run()).rejects.toThrow();
    }
    expect(fake.state.calls).toHaveLength(calls);
    expect(fake.state.branches.has(branch)).toBe(true);
  });
  test("a save during the final tree read and a save after flush retain the same draft identity", async () => {
    const branch = "notra/site-edit-late-save";
    fake.state.branches.set(branch, "initial");
    const draft = await save(branch);
    fake.state.beforeTree = async (ref) => {
      if (ref !== "initial") {
        fake.state.beforeTree = async () => {};
        await editor.saveSiteDraft(site, {
          ...input(branch, '{"name":"Latest typing"}'),
          draftId: draft.id,
          draftRevision: draft.revision,
        });
      }
    };
    await flush(branch);
    const [latest] = await editor.listSiteDrafts(site.id, branch);
    expect(latest?.id).toBe(draft.id);
    expect(latest?.content).toBe('{"name":"Latest typing"}');
    await flush(branch);
    const next = await editor.saveSiteDraft(site, {
      ...input(branch, '{"name":"Typed after flush"}'),
      draftId: latest?.id ?? null,
      draftRevision: latest?.revision ?? null,
    });
    expect(next.id).toBe(draft.id);
    expect(next.content).toBe('{"name":"Typed after flush"}');
    await flush(branch);
    expect(
      fake.state.commits
        .get(fake.state.branches.get(branch) ?? "")
        ?.get("blog.json")
    ).toBe(next.content);
  });
  test("a failed first flush keeps the moved drafts on the new branch, and retry creates no second branch", async () => {
    await save();
    const result = await branches.createSiteBranch(site, {
      title: "Recover bring",
      bringChanges: true,
      userId,
    });
    fake.state.staleCommit = true;
    await expect(flush(result.branch)).rejects.toThrow(
      "moved while publishing"
    );
    expect(await editor.listSiteDrafts(site.id, "main")).toHaveLength(0);
    expect(await editor.listSiteDrafts(site.id, result.branch)).toHaveLength(1);
    fake.state.staleCommit = false;
    await flush(result.branch);
    expect(fake.state.commitCount).toBe(1);
    expect(
      fake.state.calls.filter(
        (call) => call === "POST /repos/synthetic/blog/git/refs"
      )
    ).toHaveLength(1);
  });
  test("only the unsupported draft 422 retries PR creation; no-commits has its own error", async () => {
    const branch = "notra/site-edit-invalid-pr";
    fake.state.branches.set(branch, "initial");
    await save(branch);
    fake.state.prErrorMessage = "Invalid base ref";
    await expect(flush(branch)).rejects.toThrow("Invalid base ref");
    expect(
      fake.state.calls.filter(
        (call) => call === "POST /repos/synthetic/blog/pulls"
      )
    ).toHaveLength(1);
    fake.state.prErrorMessage = "No commits between main and branch";
    await expect(flush(branch)).rejects.toThrow(
      "No commits between this branch"
    );
  });
  test("rename checks target drafts and compensates a database failure after GitHub rename", async () => {
    const branch = "notra/site-edit-rename-failure";
    fake.state.branches.set(branch, "initial");
    const draft = await save(branch);
    const target = "notra/site-edit-Target";
    await db
      .insert(siteBranchDrafts)
      .values({ ...draft, id: `drf_${crypto.randomUUID()}`, branch: target });
    await expect(
      branches.renameSiteBranch(site, branch, "Target")
    ).rejects.toThrow("already has drafts");
    expect(fake.state.calls.some((call) => call.endsWith("/rename"))).toBe(
      false
    );
    await db
      .delete(siteBranchDrafts)
      .where(eq(siteBranchDrafts.branch, target));
    // A regular connection-local function cannot be referenced across pooled transactions; use a named trigger function scoped to this fixture.
    const fn = `branch_rename_${crypto.randomUUID().replaceAll("-", "")}`;
    await db.execute(
      sql.raw(
        `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.site_id = '${site.id}' AND NEW.branch = 'notra/site-edit-Target' THEN RAISE EXCEPTION 'Synthetic DB move failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER ${fn} BEFORE UPDATE ON site_branch_drafts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
      )
    );
    try {
      await expect(
        branches.renameSiteBranch(site, branch, "Target")
      ).rejects.toThrow();
      expect(fake.state.branches.has(branch)).toBe(true);
      expect(fake.state.branches.has(target)).toBe(false);
      expect((await editor.listSiteDrafts(site.id, branch))[0]?.id).toBe(
        draft.id
      );
    } finally {
      await db.execute(
        sql.raw(
          `DROP TRIGGER ${fn} ON site_branch_drafts; DROP FUNCTION ${fn}()`
        )
      );
    }
  });
  test("a lost compensation response keeps drafts on the branch GitHub restored", async () => {
    const branch = "notra/site-edit-compensation-lost";
    const target = "notra/site-edit-compensation-target";
    fake.state.branches.set(branch, "initial");
    const draft = await save(branch);
    const fn = `branch_rename_${crypto.randomUUID().replaceAll("-", "")}`;
    await db.execute(
      sql.raw(
        // Sequences survive the rollback, so only the first move fails and a later repair could succeed.
        `CREATE SEQUENCE ${fn}_seq; CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.site_id = '${site.id}' AND NEW.branch = '${target}' THEN IF nextval('${fn}_seq') = 1 THEN RAISE EXCEPTION 'Synthetic DB move failure'; END IF; END IF; RETURN NEW; END; $$; CREATE TRIGGER ${fn} BEFORE UPDATE ON site_branch_drafts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
      )
    );
    fake.state.loseRenameResponseAfter = 1;
    try {
      await expect(
        branches.renameSiteBranch(site, branch, "compensation target")
      ).rejects.toThrow();
      expect(fake.state.branches.has(branch)).toBe(true);
      expect(fake.state.branches.has(target)).toBe(false);
      expect(await editor.listSiteDrafts(site.id, target)).toEqual([]);
      expect((await editor.listSiteDrafts(site.id, branch))[0]?.id).toBe(
        draft.id
      );
    } finally {
      fake.state.loseRenameResponseAfter = null;
      await db.execute(
        sql.raw(
          `DROP TRIGGER ${fn} ON site_branch_drafts; DROP FUNCTION ${fn}(); DROP SEQUENCE ${fn}_seq`
        )
      );
    }
  });
  test("production branch changes ignore feature drafts but still reject production drafts", async () => {
    const { updateSiteSettings } = await import("../src/sites");
    fake.state.branches.set("notra/site-edit-kept", "initial");
    await save("notra/site-edit-kept");
    const updated = await updateSiteSettings(
      site,
      { productionBranch: "deploy" },
      userId
    );
    expect(updated.site.productionBranch).toBe("deploy");
    expect(
      await editor.listSiteDrafts(site.id, "notra/site-edit-kept")
    ).toHaveLength(1);
    await db
      .update(sites)
      .set({ productionBranch: "main" })
      .where(eq(sites.id, site.id));
    await save();
    await expect(
      updateSiteSettings(site, { productionBranch: "deploy" }, userId)
    ).rejects.toThrow("Publish or discard");
  });
  test("orphaned drafts can be purged only after GitHub confirms a missing branch", async () => {
    const branch = "notra/site-edit-orphan";
    fake.state.branches.set(branch, "initial");
    await save(branch);
    expect(
      (await branches.listSiteBranches(site)).find(
        (entry) => entry.name === branch
      )
    ).toMatchObject({ exists: true, hasDraft: true });
    await expect(
      branches.discardDeletedSiteBranchDrafts(site, branch)
    ).rejects.toThrow("still exists");
    fake.state.branches.delete(branch);
    expect(
      (await branches.listSiteBranches(site)).find(
        (entry) => entry.name === branch
      )
    ).toMatchObject({ exists: false, hasDraft: true });
    await branches.discardDeletedSiteBranchDrafts(site, branch);
    expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(0);
  });
  test("concurrent flushes queue without duplicating the commit or PR", async () => {
    const branch = "notra/site-edit-queued";
    fake.state.branches.set(branch, "initial");
    await save(branch);
    await Promise.all([flush(branch), flush(branch), flush(branch)]);
    expect(fake.state.commitCount).toBe(1);
    expect(fake.state.prs).toHaveLength(1);
  });
  test("saves cannot recreate drafts on a deleted or renamed feature branch", async () => {
    const branch = "notra/site-edit-removed";
    fake.state.branches.set(branch, "initial");
    await branches.deleteSiteBranch(site, branch);
    await expect(save(branch)).rejects.toThrow("Branch not found");
    expect(await editor.listSiteDrafts(site.id, branch)).toHaveLength(0);
  });
  test("protected feature branches require creating another branch", async () => {
    const branch = "notra/site-edit-protected";
    fake.state.branches.set(branch, "initial");
    fake.state.protectedFeatures = true;
    await expect(save(branch)).rejects.toThrow("exclude notra/**");
    expect((await branches.siteBranchStatus(site, branch)).canEdit).toBe(false);
    await expect(flush(branch)).rejects.toThrow("exclude notra/**");
  });
  test("repeated feature saves skip protection reads but still reject a branch deleted on GitHub", async () => {
    const branch = "notra/site-edit-cached";
    fake.state.branches.set(branch, "initial");
    const rules = () =>
      fake.state.calls.filter((call) =>
        call.startsWith("GET /repos/synthetic/blog/rules/branches/")
      ).length;
    const first = await save(branch);
    await editor.saveSiteDraft(site, {
      ...input(branch, '{"name":"Second save"}'),
      draftId: first.id,
      draftRevision: first.revision,
    });
    await flush(branch);
    expect(rules()).toBe(1);
    fake.state.branches.delete(branch);
    await expect(save(branch, '{"name":"Third save"}')).rejects.toThrow(
      "Branch not found"
    );
  });
  test("branch lock wait is bounded with an actionable retry error", async () => {
    let release = () => {};
    let enter = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const first = withSiteBranchLock(site.id, "main", async () => {
      enter();
      await gate;
    });
    await ready;
    try {
      await expect(
        withSiteBranchLock(site.id, "main", async () => {})
      ).rejects.toThrow("Publish in progress");
    } finally {
      release();
      await first;
    }
  });
  test("Postgres advisory locks queue the same branch and release after failures", async () => {
    const order: string[] = [];
    let release = () => {};
    let entered = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = withSiteBranchLock(site.id, "main", async () => {
      order.push("first");
      entered();
      await gate;
      order.push("release");
    });
    await ready;
    const second = withSiteBranchLock(site.id, "main", async () => {
      order.push("second");
    });
    await db.execute(sql`select 1`);
    expect(order).toEqual(["first"]);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["first", "release", "second"]);
    await expect(
      withSiteBranchLock(site.id, "main", async () => {
        throw new Error("Synthetic");
      })
    ).rejects.toThrow("Synthetic");
    await withSiteBranchLock(site.id, "main", async () => {
      order.push("recovered");
    });
    expect(order.at(-1)).toBe("recovered");
  });
}
