import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { Site } from "../src/types/sites";
import { seedSiteProject } from "./utils/site-project";

// 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const OTHER_PNG = Buffer.concat([PNG, Buffer.from([0])]);

const databaseUrl = process.env.SITES_TEST_DATABASE_URL;
if (!databaseUrl) {
  test.skip("Image uploads require the approved SITES_TEST_DATABASE_URL", () => {});
} else if (process.env.NOTRA_IMAGE_UPLOAD_POSTGRES_TEST_WORKER !== "1") {
  test("image uploads round-trip through real drafts on PostgreSQL", () => {
    const url = new URL(databaseUrl);
    expect(url.hostname).toBe("127.0.0.1");
    expect(["55447", "55439", "5432"]).toContain(url.port);
    expect(url.pathname).toBe("/notra_server_audit");
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NOTRA_IMAGE_UPLOAD_POSTGRES_TEST_WORKER: "1",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
        },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  }, 35_000);
} else {
  const url = new URL(databaseUrl);
  expect(url.hostname).toBe("127.0.0.1");
  expect(url.pathname).toBe("/notra_server_audit");
  expect(process.env.DATABASE_URL).toBe(databaseUrl);
  const { db } = await import("@notra/db/drizzle");
  const { organizations, users, sites, siteDrafts } =
    await import("@notra/db/schema");
  const { eq } = await import("drizzle-orm");
  let site: Site;
  let userId = "";
  let organizationId = "";
  let publishedConfig = JSON.stringify({ name: "Published" });
  let publishedFiles: { path: string; contents: string }[] = [];
  const notFound = () => Object.assign(new Error("Not Found"), { status: 404 });
  const octokit = await import("@notra/ai/utils/octokit");
  mock.module("@notra/ai/utils/octokit", () => ({
    ...octokit,
    createOctokit: () => ({
      request: async (route: string, params: { path?: string }) => {
        if (route.includes("/git/trees/")) {
          return {
            data: {
              tree: [
                {
                  type: "blob",
                  path: "blog.json",
                  sha: "blob-config",
                  size: 10,
                },
              ],
            },
          };
        }
        if (route.includes("/contents/")) {
          if (params.path !== "blog.json") {
            throw notFound();
          }
          return {
            data: {
              type: "file",
              content: Buffer.from(publishedConfig).toString("base64"),
              sha: "blob-config",
            },
          };
        }
        if (route.includes("/branches/") && !route.includes("/rules/")) {
          return { data: { protected: false } };
        }
        if (route.includes("/rules/branches/")) {
          return { data: [] };
        }
        throw new Error(`Unexpected synthetic GitHub request: ${route}`);
      },
      graphql: async (
        query: string,
        variables: {
          input: {
            fileChanges: { additions: { path: string; contents: string }[] };
          };
        }
      ) => {
        if (query.includes("SiteBranchProtection")) {
          return { repository: { ref: { branchProtectionRule: null } } };
        }
        publishedFiles = variables.input.fileChanges.additions;
        return {
          createCommitOnBranch: { commit: { oid: "published-commit" } },
        };
      },
    }),
  }));
  const github = await import("../src/github");
  mock.module("../src/github", () => ({
    ...github,
    siteRepositoryAccess: async () => ({
      repository: { owner: "synthetic", repo: "synthetic" },
      token: "synthetic-token",
    }),
    getBranchHead: async () => ({
      sha: "head-current",
      protected: false,
      message: "Synthetic",
      author: "Synthetic",
    }),
  }));
  const editor = await import("../src/editor");
  const imageDrafts = await import("../src/image-drafts");
  const upload = (bytes: Uint8Array, fileName = "Hero Background.png") =>
    imageDrafts.saveSiteImageDraft(site, {
      fileName,
      bytes,
      baseCommitSha: "head-current",
      userId,
      sourceContext: {
        repositoryId: site.githubRepositoryId ?? "",
        productionBranch: site.productionBranch,
        rootDirectory: site.rootDirectory,
      },
    });
  const saveConfig = (config: object) =>
    editor.saveSiteDraft(site, {
      path: "blog.json",
      content: JSON.stringify(config),
      baseBlobSha: "blob-config",
      baseCommitSha: "head-current",
      userId,
      draftId: null,
      draftRevision: null,
      sourceContext: {
        repositoryId: site.githubRepositoryId ?? "",
        productionBranch: site.productionBranch,
        rootDirectory: site.rootDirectory,
      },
    });
  beforeEach(async () => {
    publishedConfig = JSON.stringify({ name: "Published" });
    publishedFiles = [];
    organizationId = `image-upload-${crypto.randomUUID()}`;
    userId = `${organizationId}-user`;
    await db.insert(users).values({
      id: userId,
      name: "Synthetic upload admin",
      email: `${userId}@example.test`,
    });
    await db.insert(organizations).values({
      id: organizationId,
      name: "Synthetic image upload",
      slug: organizationId,
      createdAt: new Date(),
    });
    const [created] = await db
      .insert(sites)
      .values({
        id: `${organizationId}-site`,
        organizationId,
        projectId: await seedSiteProject(organizationId),
        name: "Synthetic",
        slug: crypto.randomUUID().slice(0, 8),
        publicOrigin: "https://synthetic.example.test",
        mounts: { blog: "/blog" },
      })
      .returning();
    if (!created) {
      throw new Error("Expected synthetic site");
    }
    site = created;
  });
  afterEach(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, userId));
  });
  afterAll(async () => {
    await Reflect.get(db, "$client").end();
  });

  test("an upload becomes a content-addressed base64 draft and is idempotent", async () => {
    const first = await upload(PNG);
    expect(first.path).toMatch(/^\/images\/hero-background-[0-9a-f]{10}\.png$/);
    expect(first.draft?.path).toBe(`public${first.path}`);
    expect(first.draft?.content).toBe(PNG.toString("base64"));
    expect(first.draft?.baseBlobSha).toBeNull();
    const again = await upload(PNG, "renamed.png");
    expect(again.path).not.toBe(first.path);
    const same = await upload(PNG);
    expect(same.path).toBe(first.path);
    expect(same.draft?.id).toBe(first.draft?.id);
    expect(same.draft?.revision).toBe((first.draft?.revision ?? 0) + 1);
    const summaries = await editor.listSiteDraftSummaries(site.id);
    expect(summaries).toHaveLength(2);
    expect(summaries.some((draft) => "content" in draft)).toBe(false);
  });

  test("uploads must be real images within the size limit", async () => {
    await expect(
      upload(Buffer.from("not an image"), "fake.png")
    ).rejects.toThrow("Upload a PNG");
    await expect(
      upload(Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]))
    ).rejects.toThrow("at most 3 MB");
    const saveRaw = (path: string, content: string) =>
      editor.saveSiteDraft(site, {
        path,
        content,
        baseBlobSha: null,
        baseCommitSha: "head-current",
        userId,
        draftId: null,
        draftRevision: null,
        sourceContext: {
          repositoryId: site.githubRepositoryId ?? "",
          productionBranch: site.productionBranch,
          rootDirectory: site.rootDirectory,
        },
      });
    await expect(
      saveRaw("public/images/raw.png", "not base64!")
    ).rejects.toThrow("base64");
    // Drafts can't smuggle other bytes in under an image extension.
    await expect(
      saveRaw(
        "public/x.svg",
        Buffer.from("<html><script>alert(1)</script></html>").toString("base64")
      )
    ).rejects.toThrow("not a valid svg image");
    await expect(
      saveRaw("public/x.svg", PNG.toString("base64"))
    ).rejects.toThrow("not a valid svg image");
  });

  test("the same image uploaded twice at once resolves to one draft", async () => {
    const [left, right] = await Promise.all([upload(PNG), upload(PNG)]);
    expect(left.path).toBe(right.path);
    expect(await editor.listSiteDraftSummaries(site.id)).toHaveLength(1);
  });

  test("re-uploading an old draft renews its grace period before the config save", async () => {
    const first = await upload(PNG);
    const stale = new Date(Date.now() - 11 * 60 * 1000);
    await db
      .update(siteDrafts)
      .set({ updatedAt: stale })
      .where(eq(siteDrafts.siteId, site.id));
    await saveConfig({ name: "Published" });

    const reused = await upload(PNG);
    expect(reused.path).toBe(first.path);
    expect(reused.draft?.updatedAt.getTime()).toBeGreaterThan(stale.getTime());
    await editor.publishSiteDrafts(site, { message: "Flush", userId });
    expect(publishedFiles.map((file) => file.path)).toContain(
      `public${reused.path}`
    );
  });

  test("publishing commits the referenced image bytes and drops replaced uploads", async () => {
    const replaced = await upload(OTHER_PNG, "first-try.png");
    const kept = await upload(PNG, "background.png");
    await saveConfig({
      name: "Published",
      background: { image: kept.path },
    });
    expect(await imageDrafts.listPendingSiteDraftSummaries(site)).toHaveLength(
      2
    );
    expect(await editor.validateSiteDrafts(site)).toMatchObject({ ok: true });
    await editor.publishSiteDrafts(site, { message: "Add background", userId });
    const paths = publishedFiles.map((file) => file.path).sort();
    expect(paths).toEqual(["blog.json", `public${kept.path}`]);
    const image = publishedFiles.find((file) => file.path !== "blog.json");
    expect(Buffer.from(image?.contents ?? "", "base64").equals(PNG)).toBe(true);
    expect(paths).not.toContain(`public${replaced.path}`);
    // Another tab may still be waiting on that upload, so it's kept for now.
    const left = await editor.listSiteDrafts(site.id);
    expect(left.map((draft) => draft.path)).toEqual([`public${replaced.path}`]);
    await db
      .update(siteDrafts)
      .set({ updatedAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(eq(siteDrafts.siteId, site.id));
    await editor.publishSiteDrafts(site, { message: "Flush", userId });
    expect(await editor.listSiteDrafts(site.id)).toEqual([]);
  });

  test("an upload replaced through a config update is dropped", async () => {
    const config = await saveConfig({ name: "Published" });
    const replaced = await upload(OTHER_PNG, "first-try.png");
    const kept = await upload(PNG, "background.png");
    await editor.saveSiteDraft(site, {
      path: "blog.json",
      content: JSON.stringify({ name: "Published", background: kept.path }),
      baseBlobSha: "blob-config",
      baseCommitSha: "head-current",
      userId,
      draftId: config.id,
      draftRevision: config.revision,
      sourceContext: {
        repositoryId: site.githubRepositoryId ?? "",
        productionBranch: site.productionBranch,
        rootDirectory: site.rootDirectory,
      },
    });
    const pending = await imageDrafts.listPendingSiteDraftSummaries(site);
    expect(pending.map((draft) => draft.path).sort()).toEqual([
      "blog.json",
      `public${kept.path}`,
    ]);
    expect(
      pending.some((draft) => draft.path === `public${replaced.path}`)
    ).toBe(false);
  });

  test("an upload whose config save is still in flight survives a publish", async () => {
    await saveConfig({ name: "Published" });
    const pending = await upload(PNG);
    await editor.publishSiteDrafts(site, { message: "Flush", userId });
    expect(publishedFiles.map((file) => file.path).sort()).toEqual([
      "blog.json",
      `public${pending.path}`,
    ]);
  });

  test("an upload referenced by the published config is kept without a config draft", async () => {
    const kept = await upload(PNG);
    publishedConfig = JSON.stringify({
      name: "Published",
      background: { image: kept.path },
    });
    await editor.publishSiteDrafts(site, { message: "Add image", userId });
    expect(publishedFiles.map((file) => file.path)).toEqual([
      `public${kept.path}`,
    ]);
  });
}
