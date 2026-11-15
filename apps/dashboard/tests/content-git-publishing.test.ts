import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseUrl =
  process.env.SITES_TEST_DATABASE_URL ??
  process.env.SITES_BRANCH_TEST_DATABASE_URL;
if (!databaseUrl) {
  test.skip("content Git publishing requires a throwaway local database", () => {});
} else if (process.env.NOTRA_CONTENT_WORKER !== "1") {
  test("content Git publishing with HTTP GitHub and PostgreSQL", () => {
    const url = new URL(databaseUrl);
    expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
    expect(
      url.pathname === "/notra_server_audit" ||
        url.pathname.startsWith("/notra_sites_branches_")
    ).toBe(true);
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NOTRA_CONTENT_WORKER: "1",
        },
        timeout: 120_000,
      }
    );
    expect(
      result.status,
      result.stdout.toString() + result.stderr.toString()
    ).toBe(0);
  }, 125_000);
} else {
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
    "base64"
  );
  const { startFakeGitHub } =
    await import("../../../packages/sites-server/tests/utils/fake-github");
  const fake = await startFakeGitHub();
  const secondFake = await startFakeGitHub(0, "other");
  const octokitModule = await import("@notra/ai/utils/octokit");
  const originalOctokit = octokitModule.createOctokit;
  mock.module("@notra/ai/utils/octokit", () => ({
    ...octokitModule,
    createOctokit: (
      token?: string,
      options?: Parameters<typeof originalOctokit>[1]
    ) =>
      originalOctokit(token, {
        ...options,
        baseUrl: token === "synthetic-other" ? secondFake.url : fake.url,
      }),
  }));
  const { Effect } = await import("effect");
  const auth = await import("@notra/ai/integrations/github-publish-auth");
  mock.module("@notra/ai/integrations/github-publish-auth", () => ({
    ...auth,
    getGitHubPublishToken: async () => "synthetic",
    getGitHubPublishTokenEffect: (id: string) =>
      Effect.succeed(
        id.endsWith("second-repository") ? "synthetic-other" : "synthetic"
      ),
  }));
  mock.module("@/lib/i18n/server", () => ({
    getTranslations: async () => (key: string) => key,
  }));
  const images = await import("@/lib/upload/content-image-store");
  mock.module("@/lib/upload/content-image-store", () => ({
    ...images,
    readContentImage: async () => ({
      bytes: Buffer.from("Original Notra image"),
      mimeType: "image/png",
    }),
  }));
  const workflows = await import("@/lib/workflows/start");
  mock.module("@/lib/workflows/start", () => ({
    ...workflows,
    startContentPublicationReconciliation: async () => {},
  }));
  const messages = await import("@notra/ai/utils/content-commit-message");
  mock.module("@notra/ai/utils/content-commit-message", () => ({
    ...messages,
    generateContentCommitHeadline: async ({ fallback }: { fallback: string }) =>
      fallback,
  }));
  const billing = await import("@/lib/billing/subscription");
  mock.module("@/lib/billing/subscription", () => ({
    ...billing,
    resolveAiProductAccess: async () => ({ hasAccess: true }),
    assertActiveSubscription: async () => {},
  }));
  const { db } = await import("@notra/db/drizzle");
  const {
    organizations,
    sites,
    posts,
    postCollections,
    githubIntegrations,
    repositoryOutputs,
    siteDrafts,
    siteBranchDrafts,
    contentPublications,
    contentAuthors,
    users,
  } = await import("@notra/db/schema");
  const { eq, and, inArray, sql } = await import("drizzle-orm");
  const { reconcileContentPublication, syncContentPublication } =
    await import("@notra/ai/utils/content-publication");
  const { seedSiteProject } =
    await import("../../../packages/sites-server/tests/utils/site-project");
  const { publishSavedContentToGitHub } =
    await import("@/lib/integrations/github/publish-saved-content");
  const { removePublishedContent } =
    await import("@/lib/integrations/github/remove-published-content");
  const { resolveContentReviewProcess } =
    await import("@/lib/integrations/github/content-review-process");
  const { listSiteBranches } = await import("@notra/sites-server/branches");
  const github = await import("@notra/sites-server/github");
  mock.module("@notra/sites-server/github", () => ({
    ...github,
    siteRepositoryAccess: async () => ({
      repository: { owner: "synthetic", repo: "blog" },
      token: "synthetic",
    }),
  }));
  const { os, call } = await import("@orpc/server");
  const limitPublish = mock(async (_key: string) => ({ success: true }));
  mock.module("@/utils/ratelimit", () => ({
    ratelimit: { githubPublish: { limit: limitPublish } },
  }));
  mock.module("@/lib/orpc/base", () => ({
    baseProcedure: os,
    withOrganizationAccess: os.middleware(({ next }) =>
      next({ context: { auth: { user: { id: `${org}-user` } } } })
    ),
  }));
  const { createORPCContext } = await import("@/lib/orpc/context");
  const routeContext = await createORPCContext({ headers: new Headers() });
  const { contentRouter } = await import("@/lib/orpc/routers/content");
  const { integrationsRouter } =
    await import("@/lib/orpc/routers/integrations");
  const org = `content-${crypto.randomUUID()}`;
  await db.insert(organizations).values({
    id: org,
    name: "Synthetic content publishing",
    slug: org,
    createdAt: new Date(),
  });
  const projectId = await seedSiteProject(org);
  const repositoryId = `${org}-repository`;
  await db.insert(users).values({
    id: `${org}-user`,
    email: `${org}@example.test`,
    name: "Synthetic tester",
  });
  await db.insert(githubIntegrations).values({
    id: repositoryId,
    organizationId: org,
    createdByUserId: `${org}-user`,
    displayName: "Synthetic blog",
    owner: "synthetic",
    repo: "blog",
    defaultBranch: "main",
    encryptedToken: "synthetic",
  });
  await db.insert(postCollections).values({
    id: `${org}-collection`,
    organizationId: org,
    projectId,
    source: "manual",
    name: "Synthetic stories",
  });
  const input = {
    organizationId: org,
    contentId: `${org}-post`,
    contentType: "blog_post" as const,
    repositoryId,
  };
  const createSite = async (
    id = `${org}-site`,
    rootDirectory = "",
    productionBranch = "release"
  ) => {
    fake.state.branches.set(productionBranch, "initial");
    const [site] = await db
      .insert(sites)
      .values({
        id,
        organizationId: org,
        projectId,
        name: "Synthetic journal",
        slug: crypto.randomUUID().slice(0, 8),
        repositoryId,
        productionBranch,
        rootDirectory,
        publicOrigin: "https://synthetic.example.test",
        mounts: { blog: "/blog" },
      })
      .returning();
    if (!site) {
      throw new Error("Site seed failed");
    }
    return site;
  };
  beforeEach(async () => {
    await db.delete(sites).where(eq(sites.organizationId, org));
    await db.delete(posts).where(eq(posts.organizationId, org));
    await db
      .delete(repositoryOutputs)
      .where(
        inArray(repositoryOutputs.repositoryId, [
          repositoryId,
          `${org}-second-repository`,
        ])
      );
    await db.insert(posts).values({
      id: input.contentId,
      organizationId: org,
      collectionId: `${org}-collection`,
      title: "Synthetic story",
      slug: "synthetic-story",
      markdown: "A synthetic article.",
      content: "A synthetic article.",
      contentType: "blog_post",
    });
    fake.state.branches = new Map([["main", "initial"]]);
    fake.state.prs = [];
    fake.state.classicPR = false;
    fake.state.protectionError = false;
    secondFake.state.branches = new Map([["main", "initial"]]);
    secondFake.state.prs = [];
  });
  afterAll(async () => {
    fake.stop();
    secondFake.stop();
    await db.delete(organizations).where(eq(organizations.id, org));
    await db.delete(users).where(eq(users.id, `${org}-user`));
    await db.$client.end();
  });
  const setDirect = () =>
    db.insert(repositoryOutputs).values({
      id: crypto.randomUUID(),
      repositoryId,
      outputType: "blog_post",
      reviewProcess: "direct",
    });
  test("without a site preserves default branch and markdown format", async () => {
    const result = await publishSavedContentToGitHub(input);
    expect(fake.state.prs[0]?.base.ref).toBe("main");
    expect(fake.state.commits.get(result.headSha)?.get(result.path)).toBe(
      "A synthetic article."
    );
  });
  test.each(["pull_request", "direct"] as const)(
    "without a site %s saves follow an open PR's retargeted base for protection and metadata",
    async (reviewProcess) => {
      const first = await publishSavedContentToGitHub(input);
      const pr = fake.state.prs[0];
      if (!pr) {
        throw new Error("Expected initial pull request");
      }
      pr.base.ref = "release";
      fake.state.branches.set("release", "initial");
      fake.state.protectedFeatures = true;
      try {
        await db
          .update(repositoryOutputs)
          .set({ reviewProcess })
          .where(eq(repositoryOutputs.repositoryId, repositoryId));
        await db
          .update(posts)
          .set({ markdown: "Saved after retargeting." })
          .where(eq(posts.id, input.contentId));
        const callsBefore = fake.state.calls.length;
        const saved = await call(
          contentRouter.publishChangelogToGitHub,
          { ...input, linkedOnly: true },
          { context: routeContext }
        );
        expect(saved.skipped).not.toBe(true);
        expect(saved.pullRequestNumber).toBe(first.pullRequestNumber);
        expect(saved.branchName).toBe(first.branchName);
        expect(saved.headSha).not.toBe(first.headSha);
        if (reviewProcess === "direct") {
          expect(saved.fallbackReason).toBe("protected");
          expect(fake.state.calls.slice(callsBefore)).toContain(
            "GET /repos/synthetic/blog/branches/release"
          );
        }
        expect(fake.state.commits.get(saved.headSha)?.get(first.path)).toBe(
          "Saved after retargeting."
        );
        expect(fake.state.prs).toHaveLength(1);
        expect(pr.base.ref).toBe("release");
        expect(fake.state.branches.get("main")).toBe("initial");
        expect(fake.state.branches.get("release")).toBe("initial");
        const post = await db.query.posts.findFirst({
          where: eq(posts.id, input.contentId),
        });
        expect(post?.githubPublish?.baseBranch).toBe("release");
        expect(post?.githubPublish?.headSha).toBe(saved.headSha);
      } finally {
        fake.state.protectedFeatures = false;
      }
    }
  );
  test("site uses production branch and root, with frontmatter", async () => {
    await createSite(undefined, "docs");
    const result = await publishSavedContentToGitHub(input);
    expect(fake.state.prs[0]?.base.ref).toBe("release");
    expect(result.path).toBe("docs/blog/synthetic-story.md");
    expect(fake.state.commits.get(result.headSha)?.get(result.path)).toContain(
      "Synthetic story"
    );
  });
  test("several sites require an explicit choice", async () => {
    await createSite();
    const selected = await createSite(`${org}-other`, "other");
    await expect(publishSavedContentToGitHub(input)).rejects.toThrow(
      "choosePublishingSite"
    );
    const result = await publishSavedContentToGitHub({
      ...input,
      siteId: selected.id,
    });
    expect(result.path).toBe("other/blog/synthetic-story.md");
  });
  test("direct mode commits without a PR", async () => {
    await setDirect();
    const result = await publishSavedContentToGitHub(input);
    expect(result.direct).toBe(true);
    expect(result.pullRequestNumber).toBeNull();
    expect(fake.state.prs).toHaveLength(0);
    expect(
      fake.state.commits.get(fake.state.branches.get("main")!)?.get(result.path)
    ).toContain("synthetic");
  });
  for (const followUp of [false, true]) {
    test(`direct metadata failure is reported and recovered after ${followUp ? "a follow-up" : "the first"} commit`, async () => {
      await setDirect();
      if (followUp) {
        await publishSavedContentToGitHub(input);
        await db
          .update(posts)
          .set({ markdown: "Updated direct article" })
          .where(eq(posts.id, input.contentId));
      }
      const before = await db.query.posts.findFirst({
        where: eq(posts.id, input.contentId),
      });
      const historyBefore = await db.query.contentPublications.findMany({
        where: eq(contentPublications.postId, input.contentId),
      });
      const trigger = sql.identifier(`${org}-reject-publication`);
      await db.execute(
        sql`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic publication metadata failure'; END $$`
      );
      await db.execute(
        sql`CREATE TRIGGER ${trigger} BEFORE UPDATE OF github_publish ON posts FOR EACH ROW WHEN (NEW.id = ${sql.raw(`'${input.contentId}'`)}) EXECUTE FUNCTION ${trigger}()`
      );
      try {
        await expect(publishSavedContentToGitHub(input)).rejects.toThrow(
          "Failed to publish content to GitHub"
        );
        const failed = await db.query.posts.findFirst({
          where: eq(posts.id, input.contentId),
        });
        expect(failed?.githubPublish).toEqual(before?.githubPublish);
        expect(
          await db.query.contentPublications.findMany({
            where: eq(contentPublications.postId, input.contentId),
          })
        ).toHaveLength(historyBefore.length);
      } finally {
        await db.execute(sql`DROP TRIGGER ${trigger} ON posts`);
        await db.execute(sql`DROP FUNCTION ${trigger}()`);
      }
      const committed = fake.state.branches.get("main")!;
      expect(
        fake.state.commits.get(committed)?.get("blog/synthetic-story.md")
      ).toBe(followUp ? "Updated direct article" : "A synthetic article.");
      const unrelated = fake.push("main", "unrelated.md", "Later GitHub work");
      const count = fake.state.commitCount;
      const recovered = await publishSavedContentToGitHub(input);
      expect(recovered.direct).toBe(true);
      expect(recovered.headSha).toBe(unrelated);
      expect(fake.state.commitCount).toBe(count);
      expect(fake.state.prs).toHaveLength(0);
      const saved = await db.query.posts.findFirst({
        where: eq(posts.id, input.contentId),
      });
      expect(saved?.githubPublish?.headSha).toBe(unrelated);
      expect(saved?.githubPublish?.writtenBlobs?.[recovered.path]).toBe(
        fake.blob(followUp ? "Updated direct article" : "A synthetic article.")
      );
    });
  }
  for (const humanEdit of [false, true]) {
    test(`direct recovery ${humanEdit ? "preserves later GitHub edits with a fallback PR" : "publishes a newer saved draft"}`, async () => {
      await setDirect();
      const first = await publishSavedContentToGitHub(input);
      await db
        .update(posts)
        .set({ githubPublish: null, markdown: "Newer saved article" })
        .where(eq(posts.id, input.contentId));
      if (humanEdit) {
        fake.push("main", first.path, "Later human edit");
      }
      const head = fake.state.branches.get("main")!;
      const recovered = await publishSavedContentToGitHub(input);
      expect(fake.state.commits.get(recovered.headSha)?.get(first.path)).toBe(
        "Newer saved article"
      );
      if (humanEdit) {
        expect(recovered.fallbackReason).toBe("changed");
        expect(fake.state.branches.get("main")).toBe(head);
        expect(fake.state.commits.get(head)?.get(first.path)).toBe(
          "Later human edit"
        );
        expect(fake.state.prs).toHaveLength(1);
      } else {
        expect(recovered.direct).toBe(true);
        expect(fake.state.prs).toHaveLength(0);
      }
    });
  }
  test("protection and unknown protection fall back to PR", async () => {
    await setDirect();
    fake.state.classicPR = true;
    const result = await publishSavedContentToGitHub(input);
    expect(result.fallbackReason).toBe("protected");
    expect(fake.state.prs).toHaveLength(1);
    fake.state.protectionError = 503;
    expect(
      (
        await resolveContentReviewProcess({
          reviewProcess: "direct",
          token: "synthetic",
          repository: {
            owner: "synthetic",
            repo: "blog",
            organizationId: org,
            integrationId: repositoryId,
            githubRepositoryId: null,
            installationId: "",
          },
          branch: "main",
          path: result.path,
        })
      ).direct
    ).toBe(false);
  });
  test("pending Sites draft falls back without touching production", async () => {
    const site = await createSite(undefined, "", "main");
    await setDirect();
    await db.insert(siteDrafts).values({
      id: crypto.randomUUID(),
      siteId: site.id,
      branch: "main",
      path: "blog/synthetic-story.md",
      content: "Unsaved editor work",
    });
    const result = await publishSavedContentToGitHub(input);
    expect(result.fallbackReason).toBe("draft");
    expect(fake.state.branches.get("main")).toBe("initial");
  });
  test("metadata-only follow-up keeps the same PR and Sites lists its title", async () => {
    const site = await createSite();
    const first = await publishSavedContentToGitHub(input);
    await db
      .update(posts)
      .set({
        tags: ["Updated tag"],
        featured: true,
        hidden: true,
        noindex: true,
        excerpt: "Changed description",
      })
      .where(eq(posts.id, input.contentId));
    const second = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(second.pullRequestNumber).toBe(first.pullRequestNumber);
    const markdown = fake.state.commits.get(second.headSha)?.get(second.path);
    expect(markdown).toContain("Updated tag");
    expect(markdown).toContain("featured: true");
    expect(markdown).toContain("Changed description");
    expect(
      (await listSiteBranches(site)).find(
        (entry) => entry.name === first.branchName
      )?.title
    ).toBe("Synthetic story");
  });
  test("Sites commits Design changes into the Content PR and rejects unowned branches", async () => {
    const site = await createSite();
    const first = await publishSavedContentToGitHub(input);
    const editor = await import("@notra/sites-server/editor");
    const previous =
      fake.state.commits.get(first.headSha)?.get("blog.json") ?? "";
    await editor.saveSiteDraft(site, {
      branch: first.branchName,
      path: "blog.json",
      content: JSON.stringify({ name: "Changed design" }),
      baseBlobSha: fake.blob(previous),
      baseCommitSha: first.headSha,
      draftId: null,
      draftRevision: null,
      sourceContext: {
        repositoryId: site.githubRepositoryId ?? "",
        productionBranch: site.productionBranch,
        rootDirectory: site.rootDirectory,
      },
      userId: `${org}-user`,
    });
    await editor.flushSiteDrafts(site, {
      branch: first.branchName,
      message: "Update site design",
      userId: `${org}-user`,
    });
    expect(fake.state.prs).toHaveLength(1);
    expect(
      fake.state.commits
        .get(fake.state.branches.get(first.branchName)!)
        ?.get("blog.json")
    ).toContain("Changed design");
    await expect(
      editor.listSiteSourceFiles(site, "someone/article")
    ).rejects.toThrow("Branch not found");
    fake.state.branches.set("notra/unreviewed", "initial");
    await expect(
      editor.listSiteSourceFiles(site, "notra/unreviewed")
    ).rejects.toThrow("Branch not found");
  });
  test("direct follow-up updates the same file without a PR", async () => {
    await setDirect();
    const first = await publishSavedContentToGitHub(input);
    await db
      .update(posts)
      .set({ markdown: "Second direct version", title: "New title" })
      .where(eq(posts.id, input.contentId));
    const second = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(second.direct).toBe(true);
    expect(second.path).toBe(first.path);
    expect(fake.state.prs).toHaveLength(0);
    expect(fake.state.commits.get(second.headSha)?.get(second.path)).toContain(
      "Second direct version"
    );
  });
  test("unlinking without removal leaves repository files and the PR untouched", async () => {
    const first = await publishSavedContentToGitHub(input);
    await db.delete(posts).where(eq(posts.id, input.contentId));
    expect(fake.state.prs[0]?.state).toBe("open");
    expect(fake.state.commits.get(first.headSha)?.has(first.path)).toBe(true);
  });
  test("preview comment reuses the existing Sites bot comment", async () => {
    process.env.GITHUB_APP_ID = "999000";
    const first = await publishSavedContentToGitHub(input);
    const params = {
      marker: "<!-- notra-preview:synthetic -->",
      pullRequestNumber: first.pullRequestNumber!,
      commitSha: first.headSha,
      productionBranch: "main",
      body: "<!-- notra-preview:synthetic -->\n[Preview](http://localhost:4332/first)",
    };
    const repository = {
      owner: "synthetic",
      repo: "blog",
      organizationId: org,
      integrationId: repositoryId,
      githubRepositoryId: null,
      installationId: "",
    };
    await github.upsertPreviewComment(repository, "synthetic", params);
    await github.upsertPreviewComment(repository, "synthetic", {
      ...params,
      body: "<!-- notra-preview:synthetic -->\n[Preview](http://localhost:4332/updated)",
    });
    expect(fake.state.comments).toHaveLength(1);
    expect(fake.state.comments[0]?.body).toContain("/updated");
    delete process.env.GITHUB_APP_ID;
  });
  for (const direct of [false, true]) {
    test(`scheduled merge uses the output review process (${direct ? "direct" : "pull request"})`, async () => {
      if (direct) {
        await setDirect();
      }
      const { publishScheduledDestination, openScheduledPullRequestAhead } =
        await import("@/lib/content/scheduled-publication-destinations");
      if (direct) {
        await openScheduledPullRequestAhead({
          organizationId: org,
          postId: input.contentId,
          repositoryId,
        });
        expect(fake.state.prs).toHaveLength(0);
        expect(fake.state.branches.get("main")).toBe("initial");
      }
      const now = new Date();
      const outcome = await publishScheduledDestination(
        {
          id: "synthetic-attempt",
          organizationId: org,
          postId: input.contentId,
          destination: "github",
          destinationConfig: {
            destination: "github",
            repositoryId,
            merge: true,
          },
          scheduledAt: now,
          attempts: 1,
          createdByUserId: null,
          createdAt: now,
          result: null,
        },
        "synthetic-claim"
      );
      expect(outcome.kind).toBe("published");
      expect(fake.state.prs).toHaveLength(direct ? 0 : 1);
      if (!direct) {
        expect(fake.state.prs[0]?.state).toBe("closed");
      }
      expect(fake.state.branches.get("main")).not.toBe("initial");
    });
  }
  test("cover, alt, authors, date and visibility metadata update the open PR", async () => {
    await createSite();
    const first = await publishSavedContentToGitHub(input);
    const authorId = `${org}-author`;
    await db
      .insert(contentAuthors)
      .values({
        id: authorId,
        organizationId: org,
        slug: "synthetic-writer",
        name: "Synthetic writer",
      })
      .onConflictDoNothing();
    await db
      .update(posts)
      .set({
        coverImage: {
          url: "https://example.test/cover.png",
          alt: "A new cover alt",
        },
        authorIds: [authorId],
        displayDate: new Date("2026-09-01"),
        featured: true,
        hidden: true,
        noindex: true,
      })
      .where(eq(posts.id, input.contentId));
    const second = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    const markdown =
      fake.state.commits.get(second.headSha)?.get(second.path) ?? "";
    for (const value of [
      "https://example.test/cover.png",
      "A new cover alt",
      "Synthetic writer",
      "2026-09-01",
      "featured: true",
      "hidden: true",
      "noindex: true",
    ]) {
      expect(markdown).toContain(value);
    }
    expect(second.pullRequestNumber).toBe(first.pullRequestNumber);
  });
  test("concurrent publications keep one open PR", async () => {
    const results = await Promise.all([
      publishSavedContentToGitHub(input),
      publishSavedContentToGitHub(input),
    ]);
    expect(results[0]?.pullRequestNumber).toBe(results[1]?.pullRequestNumber);
    expect(fake.state.prs).toHaveLength(1);
  });
  test("removal deletes recorded media and keeps neighboring files", async () => {
    const first = await publishSavedContentToGitHub(input);
    fake.state.branches.set("main", first.headSha);
    fake.push("main", "images/story/owned.png", "owned media");
    fake.push("main", "images/story/neighbor.png", "human media");
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
      columns: { githubPublish: true },
    });
    if (!post?.githubPublish) {
      throw new Error("Expected publication");
    }
    await db
      .update(posts)
      .set({
        githubPublish: {
          ...post.githubPublish,
          assetPaths: ["images/story/owned.png"],
        },
      })
      .where(eq(posts.id, input.contentId));
    const removed = await removePublishedContent(org, input.contentId);
    if (!removed) {
      throw new Error("Expected removal publication");
    }
    const files = fake.state.commits.get(removed.headSha);
    expect(files?.has(first.path)).toBe(false);
    expect(files?.has("images/story/owned.png")).toBe(false);
    expect(files?.get("images/story/neighbor.png")).toBe("human media");
  });
  test("direct removal deletes the live entry without a PR", async () => {
    await setDirect();
    const first = await publishSavedContentToGitHub(input);
    const removed = await removePublishedContent(org, input.contentId);
    expect(removed?.direct).toBe(true);
    expect(fake.state.prs).toHaveLength(0);
    expect(
      fake.state.commits.get(removed?.headSha ?? "")?.has(first.path)
    ).toBe(false);
  });
  test("removal follows the current base of a retargeted and merged content PR", async () => {
    const first = await publishSavedContentToGitHub(input);
    const pr = fake.state.prs[0]!;
    pr.base.ref = "release";
    pr.state = "closed";
    pr.merged_at = new Date().toISOString();
    fake.state.branches.set("release", first.headSha);
    const removed = await removePublishedContent(org, input.contentId);
    expect(removed).not.toBeNull();
    expect(fake.state.prs.at(-1)?.base.ref).toBe("release");
    expect(fake.state.commits.get(removed!.headSha)?.has(first.path)).toBe(
      false
    );
    expect(fake.state.branches.get("main")).toBe("initial");
  });
  test("explicit update after merge gets a new PR updating the same file and history", async () => {
    await createSite();
    const first = await publishSavedContentToGitHub(input);
    const pr = fake.state.prs[0]!;
    pr.state = "closed";
    pr.merged_at = new Date().toISOString();
    fake.state.branches.set("release", first.headSha);
    await db
      .update(posts)
      .set({ title: "Renamed story", markdown: "Updated article." })
      .where(eq(posts.id, input.contentId));
    const synced = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(synced.skipped).toBe(true);
    expect(fake.state.prs).toHaveLength(1);
    const second = await publishSavedContentToGitHub(input);
    expect(second.pullRequestNumber).not.toBe(first.pullRequestNumber);
    expect(second.path).toBe(first.path);
    expect(fake.state.commits.get(second.headSha)?.get(second.path)).toContain(
      "updated:"
    );
    const history = await db
      .select()
      .from(contentPublications)
      .where(
        and(
          eq(contentPublications.postId, input.contentId),
          eq(contentPublications.organizationId, org)
        )
      );
    expect(history.map((row) => row.status).sort()).toEqual(["merged", "open"]);
  });
  test("removal creates a deletion PR and closes the post PR", async () => {
    const first = await publishSavedContentToGitHub(input);
    const pr = fake.state.prs[0]!;
    fake.state.branches.set("main", first.headSha);
    const removed = await removePublishedContent(org, input.contentId);
    expect(removed?.pullRequestNumber).not.toBe(first.pullRequestNumber);
    expect(fake.state.commits.get(removed!.headSha)?.has(first.path)).toBe(
      false
    );
    expect(pr.state).toBe("closed");
  });
  for (const table of [siteDrafts, siteBranchDrafts]) {
    test(`root-relative ${table === siteDrafts ? "editor" : "branch"} drafts protect direct publish and removal`, async () => {
      const site = await createSite(undefined, "docs", "release");
      await setDirect();
      const first = await publishSavedContentToGitHub(input);
      const head = fake.state.branches.get("release");
      await db.insert(table).values({
        id: crypto.randomUUID(),
        siteId: site.id,
        branch: "release",
        path: "blog/synthetic-story.md",
        content: "Unsaved Sites work",
      });
      await db
        .update(posts)
        .set({ tags: ["New tag"] })
        .where(eq(posts.id, input.contentId));
      const next = await publishSavedContentToGitHub(input);
      expect(next.fallbackReason).toBe("draft");
      expect(next.direct).not.toBe(true);
      expect(fake.state.branches.get("release")).toBe(head);
      const removal = await removePublishedContent(org, input.contentId);
      expect(removal?.direct).not.toBe(true);
      expect(fake.state.branches.get("release")).toBe(head);
      expect(fake.state.commits.get(head!)?.has(first.path)).toBe(true);
    });
  }
  test("direct follow-up preserves GitHub edits and opens a PR with a changed reason", async () => {
    await setDirect();
    const first = await publishSavedContentToGitHub(input);
    const saved = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    expect(saved?.githubPublish?.writtenBlobs?.[first.path]).toBe(
      fake.blob("A synthetic article.")
    );
    const human = fake.push("main", first.path, "Human edit on GitHub");
    await db
      .update(posts)
      .set({ markdown: "An update from Notra" })
      .where(eq(posts.id, input.contentId));
    const second = await publishSavedContentToGitHub(input);
    expect(second.fallbackReason).toBe("changed");
    expect(fake.state.branches.get("main")).toBe(human);
    expect(fake.state.commits.get(human)?.get(first.path)).toBe(
      "Human edit on GitHub"
    );
    expect(second.pullRequestNumber).toBeGreaterThan(0);
  });
  test("linked-only direct updates an already-live entry and records terminal publication history", async () => {
    await setDirect();
    const first = await publishSavedContentToGitHub(input);
    await db
      .update(posts)
      .set({ markdown: "Changed article" })
      .where(eq(posts.id, input.contentId));
    const second = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(second.direct).toBe(true);
    expect(second.headSha).not.toBe(first.headSha);
    const rows = await db.query.contentPublications.findMany({
      where: eq(contentPublications.postId, input.contentId),
    });
    expect(rows).toHaveLength(2);
    expect(
      rows.every(
        (row) => row.status === "merged" && row.pullRequestNumber === null
      )
    ).toBe(true);
  });
  test("linked-only never creates a first PR or reopens a closed unmerged PR", async () => {
    const empty = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(empty.skipped).toBe(true);
    expect(fake.state.prs).toHaveLength(0);
    const first = await publishSavedContentToGitHub(input);
    fake.state.prs[0]!.state = "closed";
    const head = fake.state.branches.get(first.branchName);
    await db
      .update(posts)
      .set({ markdown: "Save after closure" })
      .where(eq(posts.id, input.contentId));
    const synced = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(synced.skipped).toBe(true);
    expect(fake.state.prs).toHaveLength(1);
    expect(fake.state.branches.get(first.branchName)).toBe(head);
    const explicit = await publishSavedContentToGitHub(input);
    expect(explicit.pullRequestNumber).not.toBe(first.pullRequestNumber);
  });
  test("linked-only protected/changed direct updates never open fallback PRs", async () => {
    await setDirect();
    const first = await publishSavedContentToGitHub(input);
    fake.state.classicPR = true;
    const protectedUpdate = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(protectedUpdate.skipped).toBe(true);
    fake.state.classicPR = false;
    fake.push("main", first.path, "Human edit");
    await expect(
      publishSavedContentToGitHub({ ...input, linkedOnly: true })
    ).rejects.toThrow("changed on GitHub");
    expect(fake.state.prs).toHaveLength(0);
  });
  test("human entry edits on an open PR are preserved while extra Design files are allowed", async () => {
    const first = await publishSavedContentToGitHub(input);
    fake.push(first.branchName, "blog.json", '{"name":"Design"}');
    const design = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(design.pullRequestNumber).toBe(first.pullRequestNumber);
    const human = fake.push(
      first.branchName,
      first.path,
      "A human review edit"
    );
    await expect(
      publishSavedContentToGitHub({ ...input, linkedOnly: true })
    ).rejects.toThrow("changed on GitHub");
    expect(fake.state.branches.get(first.branchName)).toBe(human);
    expect(fake.state.commits.get(human)?.get(first.path)).toBe(
      "A human review edit"
    );
  });
  for (const removeImage of [false, true]) {
    test(`follow-up PR publishing preserves a human-replaced image when ${removeImage ? "deleting" : "overwriting"} it`, async () => {
      const markdown = `![Cover](/api/uploads/content-images/organization/${org}/content/cover.png)`;
      await db
        .update(posts)
        .set({ markdown })
        .where(eq(posts.id, input.contentId));
      const first = await publishSavedContentToGitHub(input);
      const saved = await db.query.posts.findFirst({
        where: eq(posts.id, input.contentId),
      });
      const imagePath = saved?.githubPublish?.assetPaths?.[0];
      expect(imagePath).toBeDefined();
      expect(saved?.githubPublish?.writtenBlobs?.[imagePath!]).toBe(
        fake.blob("Original Notra image")
      );
      const human = fake.push(
        first.branchName,
        imagePath!,
        "Human replacement"
      );
      await db
        .update(posts)
        .set({
          markdown: removeImage
            ? "Article without image"
            : `${markdown}\nUpdated article`,
        })
        .where(eq(posts.id, input.contentId));
      await expect(
        publishSavedContentToGitHub({ ...input, linkedOnly: true })
      ).rejects.toThrow("changed on GitHub");
      expect(fake.state.branches.get(first.branchName)).toBe(human);
      expect(fake.state.commits.get(human)?.get(imagePath!)).toBe(
        "Human replacement"
      );
      expect(fake.state.commits.get(human)?.get(first.path)).toBe(
        fake.state.commits.get(first.headSha)?.get(first.path)
      );
      expect(fake.state.prs).toHaveLength(1);
    });
  }
  test("follow-up PR publishing updates and deletes images with matching recorded blobs", async () => {
    const markdown = `![Cover](/api/uploads/content-images/organization/${org}/content/cover.png)`;
    await db
      .update(posts)
      .set({ markdown })
      .where(eq(posts.id, input.contentId));
    const first = await publishSavedContentToGitHub(input);
    const saved = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    const imagePath = saved!.githubPublish!.assetPaths![0]!;
    fake.push(first.branchName, "blog.json", '{"name":"Human design edit"}');
    await db
      .update(posts)
      .set({ markdown: `${markdown}\nUpdated article` })
      .where(eq(posts.id, input.contentId));
    const updated = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(updated.pullRequestNumber).toBe(first.pullRequestNumber);
    expect(fake.state.commits.get(updated.headSha)?.get(imagePath)).toBe(
      "Original Notra image"
    );
    await db
      .update(posts)
      .set({ markdown: "Article without image" })
      .where(eq(posts.id, input.contentId));
    const removed = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(removed.pullRequestNumber).toBe(first.pullRequestNumber);
    expect(fake.state.commits.get(removed.headSha)?.has(imagePath)).toBe(false);
    expect(fake.state.commits.get(removed.headSha)?.get("blog.json")).toContain(
      "Human design edit"
    );
  });
  test("a newer direct publication in the same repo prevents a missing old PR mapping from being repaired", async () => {
    const first = await publishSavedContentToGitHub(input);
    const previous = await db.query.contentPublications.findFirst({
      where: eq(contentPublications.postId, input.contentId),
    });
    const pr = fake.state.prs[0];
    if (!previous || !pr || !first.pullRequestNumber || !first.pullRequestUrl) {
      throw new Error("Expected initial PR publication");
    }
    pr.state = "closed";
    pr.merged_at = new Date().toISOString();
    fake.state.branches.set("main", first.headSha);
    await db
      .delete(contentPublications)
      .where(eq(contentPublications.id, previous.id));
    await db
      .update(repositoryOutputs)
      .set({ reviewProcess: "direct" })
      .where(eq(repositoryOutputs.repositoryId, repositoryId));
    await db
      .update(posts)
      .set({ markdown: "Newer directly published markdown." })
      .where(eq(posts.id, input.contentId));
    const direct = await publishSavedContentToGitHub(input);
    expect(direct.direct).toBe(true);
    const reconciled = await reconcileContentPublication({
      publication: {
        organizationId: org,
        postId: input.contentId,
        repositoryId,
        owner: "synthetic",
        repo: "blog",
        path: first.path,
        branch: first.branchName,
        pullRequestNumber: first.pullRequestNumber,
        pullRequestUrl: first.pullRequestUrl,
        headSha: first.headSha,
      },
      publishedAt: previous.createdAt.toISOString(),
    });
    const repair = await syncContentPublication(
      {
        publicationId: reconciled?.id ?? previous.id,
        organizationId: org,
        postId: input.contentId,
        commitSha: "delayed-old-pr-repair",
        baselineHeadSha: first.headSha,
        expectedHeadSha: first.headSha,
        branch: first.branchName,
        markdown: "Stale markdown from the old PR.",
      },
      async () => true
    );
    expect(reconciled).toBeNull();
    expect(repair).toEqual({ status: "superseded" });
    const history = await db.query.contentPublications.findMany({
      where: eq(contentPublications.postId, input.contentId),
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.createdAt.getTime()).toBeGreaterThan(
      previous.createdAt.getTime()
    );
    expect(history[0]).toMatchObject({
      repositoryId,
      pullRequestNumber: null,
      status: "merged",
      headSha: direct.headSha,
    });
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    expect(post?.markdown).toBe("Newer directly published markdown.");
    expect(post?.githubPublish?.headSha).toBe(direct.headSha);
    expect(fake.state.branches.get("main")).toBe(direct.headSha);
  });
  test("a direct publication in a second repo supersedes the first repo's PR and asset ownership", async () => {
    const first = await publishSavedContentToGitHub(input);
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    await db
      .update(posts)
      .set({
        githubPublish: {
          ...post!.githubPublish!,
          assetPaths: ["old-repo.png"],
        },
      })
      .where(eq(posts.id, input.contentId));
    const secondRepo = `${org}-second-repository`;
    await db
      .insert(githubIntegrations)
      .values({
        id: secondRepo,
        organizationId: org,
        createdByUserId: `${org}-user`,
        displayName: "Second repository",
        owner: "synthetic",
        repo: "other",
        defaultBranch: "main",
        encryptedToken: "synthetic",
      })
      .onConflictDoNothing();
    await db.insert(repositoryOutputs).values({
      id: crypto.randomUUID(),
      repositoryId: secondRepo,
      outputType: "blog_post",
      reviewProcess: "direct",
    });
    const previous = await db.query.contentPublications.findFirst({
      where: eq(contentPublications.postId, input.contentId),
    });
    await publishSavedContentToGitHub({ ...input, repositoryId: secondRepo });
    const saved = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    expect(saved?.githubPublish?.assetPaths).toEqual([]);
    expect(saved?.githubPublish?.writtenBlobs).not.toHaveProperty(
      "old-repo.png"
    );
    expect(saved?.githubPublish?.repositoryId).toBe(secondRepo);
    expect(secondFake.state.prs).toHaveLength(0);
    expect(fake.state.prs[0]?.number).toBe(first.pullRequestNumber!);
    expect(
      await syncContentPublication(
        {
          publicationId: previous!.id,
          organizationId: org,
          postId: input.contentId,
          commitSha: "late-repair",
          baselineHeadSha: first.headSha,
          expectedHeadSha: first.headSha,
          branch: first.branchName,
          markdown: "Stale content from the first repository",
        },
        async () => true
      )
    ).toEqual({ status: "superseded" });
    expect(
      await reconcileContentPublication({
        publication: {
          organizationId: org,
          postId: input.contentId,
          repositoryId,
          owner: "synthetic",
          repo: "blog",
          path: first.path,
          branch: first.branchName,
          pullRequestNumber: first.pullRequestNumber!,
          pullRequestUrl: first.pullRequestUrl!,
          headSha: first.headSha,
        },
        publishedAt: previous!.createdAt.toISOString(),
      })
    ).toBeNull();
    const history = await db.query.contentPublications.findMany({
      where: eq(contentPublications.postId, input.contentId),
    });
    expect(history.find((row) => row.id === previous!.id)?.status).toBe(
      "closed"
    );
    expect(history.find((row) => row.repositoryId === secondRepo)?.status).toBe(
      "merged"
    );
    expect(
      (await db.query.posts.findFirst({ where: eq(posts.id, input.contentId) }))
        ?.markdown
    ).toBe("A synthetic article.");
  });
  test("legacy publication backfills its original PR base across multi-site and project changes", async () => {
    const original = await createSite(undefined, "docs", "release");
    const first = await publishSavedContentToGitHub(input);
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    const {
      siteId: _siteId,
      baseBranch: _baseBranch,
      ...legacy
    } = post!.githubPublish!;
    await db
      .update(posts)
      .set({ githubPublish: legacy })
      .where(eq(posts.id, input.contentId));
    await createSite(`${org}-other`, "other", "main");
    const { projects, brandSettings } = await import("@notra/db/schema");
    const anotherProject = `${org}-another-project`;
    await db.insert(brandSettings).values({
      id: `${anotherProject}-brand`,
      organizationId: org,
      websiteUrl: "https://example.test",
      name: "Other brand",
      isDefault: false,
    });
    await db.insert(projects).values({
      id: anotherProject,
      organizationId: org,
      name: "Other project",
      brandSettingsId: `${anotherProject}-brand`,
    });
    await db
      .update(sites)
      .set({ projectId: anotherProject })
      .where(eq(sites.id, original.id));
    const second = await publishSavedContentToGitHub({
      ...input,
      linkedOnly: true,
    });
    expect(second.pullRequestNumber).toBe(first.pullRequestNumber);
    expect(second.path).toBe(first.path);
    expect(fake.state.prs).toHaveLength(1);
    const saved = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    expect(saved?.githubPublish?.siteId).toBe(original.id);
  });
  test("stale stored site requires an explicit pick without preventing a later save", async () => {
    const { findSiteGitHubPublishTarget } =
      await import("@/lib/integrations/github/site-publish-target");
    const site = await createSite();
    await createSite(`${org}-other`, "other", "main");
    const params = {
      organizationId: org,
      contentType: "blog_post" as const,
      repository: {
        id: repositoryId,
        owner: "synthetic",
        repo: "blog",
        githubRepositoryId: null,
      },
      existingPublication: {
        siteId: "deleted-site",
        path: "gone/blog/story.md",
        baseBranch: "gone",
      },
    };
    await expect(findSiteGitHubPublishTarget(params)).rejects.toThrow(
      "choosePublishingSite"
    );
    await expect(
      findSiteGitHubPublishTarget({
        ...params,
        existingPublication: {
          siteId: "deleted-site",
          path: "blog/story.md",
          baseBranch: "release",
        },
      })
    ).rejects.toThrow("choosePublishingSite");
    expect(
      (await findSiteGitHubPublishTarget({ ...params, siteId: site.id }))
        ?.siteId
    ).toBe(site.id);
  });
  for (const kind of ["other-site", "closed", "foreign"] as const) {
    test(`branch mutations reject ${kind} content branches`, async () => {
      const site = await createSite();
      const first = await publishSavedContentToGitHub(input);
      const branches = await import("@notra/sites-server/branches");
      let name = first.branchName;
      if (kind === "other-site") {
        fake.state.prs[0]!.base.ref = "other-production";
      }
      if (kind === "closed") {
        fake.state.prs[0]!.state = "closed";
      }
      if (kind === "foreign") {
        name = "notra/foreign-branch";
        fake.state.branches.set(name, "initial");
      }
      const head = fake.state.branches.get(name);
      for (const mutate of [
        branches.deleteSiteBranch,
        branches.mergeSiteBranch,
        branches.requestSiteBranchReview,
        branches.discardDeletedSiteBranchDrafts,
      ]) {
        await expect(mutate(site, name)).rejects.toThrow("Branch not found");
      }
      await expect(
        branches.renameSiteBranch(site, name, "New Title")
      ).rejects.toThrow("Branch not found");
      await expect(
        branches.createSiteBranch(site, {
          branch: name,
          title: "Copy",
          userId: `${org}-user`,
          bringChanges: false,
        })
      ).rejects.toThrow("Branch not found");
      expect(fake.state.branches.get(name)).toBe(head);
    });
  }
  test("removal preserves images referenced by another post publication", async () => {
    await setDirect();
    const first = await publishSavedContentToGitHub(input);
    fake.push("main", "images/shared.png", "shared image");
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    await db
      .update(posts)
      .set({
        githubPublish: {
          ...post!.githubPublish!,
          assetPaths: ["images/shared.png"],
        },
      })
      .where(eq(posts.id, input.contentId));
    await db.insert(posts).values({
      id: `${org}-neighbor`,
      organizationId: org,
      collectionId: `${org}-collection`,
      title: "Neighbor",
      content: "Neighbor",
      contentType: "blog_post",
      githubPublish: {
        ...post!.githubPublish!,
        path: "neighbor.md",
        assetPaths: ["images/shared.png"],
      },
    });
    const removal = await removePublishedContent(org, input.contentId);
    expect(
      fake.state.commits.get(removal!.headSha)?.get("images/shared.png")
    ).toBe("shared image");
    expect(fake.state.commits.get(removal!.headSha)?.has(first.path)).toBe(
      false
    );
  });
  test("metadata saves leave a closed PR alone without a sync error", async () => {
    const first = await publishSavedContentToGitHub(input);
    const pr = fake.state.prs[0];
    if (!pr) {
      throw new Error("Expected initial pull request");
    }
    pr.state = "closed";
    const saved = await call(
      contentRouter.updateMetadata,
      {
        organizationId: org,
        contentId: input.contentId,
        metadata: { hidden: true },
      },
      { context: routeContext }
    );
    expect(saved.content.metadata.hidden).toBe(true);
    expect(saved.githubSyncError).toBeNull();
    expect(fake.state.branches.get(first.branchName)).toBe(first.headSha);
    expect(fake.state.prs).toHaveLength(1);
  });
  test("internal sync leaves a closed PR alone and reports the skip", async () => {
    const first = await publishSavedContentToGitHub(input);
    const pr = fake.state.prs[0];
    if (!pr) {
      throw new Error("Expected initial pull request");
    }
    pr.state = "closed";
    const secret = process.env.INTERNAL_WORKFLOW_SECRET;
    process.env.INTERNAL_WORKFLOW_SECRET = "synthetic-sync-secret";
    try {
      const { POST } =
        await import("@/app/api/internal/content/sync-github/route");
      const response = await POST(
        new Request("http://127.0.0.1/api/internal/content/sync-github", {
          method: "POST",
          headers: {
            authorization: "Bearer synthetic-sync-secret",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            organizationId: org,
            postId: input.contentId,
            actorId: `${org}-user`,
          }),
        })
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, skipped: true });
      expect(fake.state.branches.get(first.branchName)).toBe(first.headSha);
    } finally {
      if (secret === undefined) {
        delete process.env.INTERNAL_WORKFLOW_SECRET;
      } else {
        process.env.INTERNAL_WORKFLOW_SECRET = secret;
      }
    }
  });
  test("metadata save persists even when GitHub sync fails or rate limits, and demo never syncs", async () => {
    const first = await publishSavedContentToGitHub(input);
    const human = fake.push(first.branchName, first.path, "Human entry edit");
    const failed = await call(
      contentRouter.updateMetadata,
      {
        organizationId: org,
        contentId: input.contentId,
        metadata: { hidden: true },
      },
      { context: routeContext }
    );
    expect(failed.content.metadata.hidden).toBe(true);
    expect(failed.githubSyncError).toBe("savedSyncFailed");
    expect(fake.state.branches.get(first.branchName)).toBe(human);
    process.env.UPSTASH_REDIS_REST_URL = "https://synthetic.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "synthetic";
    limitPublish.mockResolvedValueOnce({ success: false });
    const limited = await call(
      contentRouter.updateMetadata,
      {
        organizationId: org,
        contentId: input.contentId,
        metadata: { featured: true },
      },
      { context: routeContext }
    );
    expect(limited.content.metadata.featured).toBe(true);
    expect(limited.githubSyncError).toBe("savedSyncFailed");
    expect(limitPublish).toHaveBeenLastCalledWith(`${org}-user:${org}`);
    const commits = fake.state.commitCount;
    process.env.NOTRA_DEMO_MODE = "true";
    const demo = await call(
      contentRouter.updateMetadata,
      {
        organizationId: org,
        contentId: input.contentId,
        metadata: { noindex: true },
      },
      { context: routeContext }
    );
    expect(demo.content.metadata.noindex).toBe(true);
    expect(demo.githubSyncError).toBe("savedSyncFailed");
    expect(fake.state.commitCount).toBe(commits);
    delete process.env.NOTRA_DEMO_MODE;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
  test("per-post publishing does not change the integration default; settings reject foreign sites", async () => {
    const first = await createSite();
    const second = await createSite(`${org}-other`, "other");
    await db.insert(repositoryOutputs).values({
      id: crypto.randomUUID(),
      repositoryId,
      outputType: "blog_post",
      config: { siteId: first.id },
    });
    await publishSavedContentToGitHub({ ...input, siteId: second.id });
    const output = await db.query.repositoryOutputs.findFirst({
      where: eq(repositoryOutputs.repositoryId, repositoryId),
    });
    expect(output?.config).toEqual({ siteId: first.id });
    await expect(
      call(
        integrationsRouter.repositories.contentDirectory.update,
        {
          organizationId: org,
          repositoryId,
          contentType: "blog_post",
          siteId: "foreign-site",
        },
        { context: routeContext }
      )
    ).rejects.toThrow("publishingSiteUnavailable");
  });
  test("post and Sites locks hold no pooled connection during a slow GitHub commit", async () => {
    await createSite();
    fake.state.beforeCommit = async () => {
      expect(db.$client.idleCount).toBe(db.$client.totalCount);
      const rows = await db.execute(
        (await import("drizzle-orm"))
          .sql`select count(*)::int as count from pg_stat_activity where datname = current_database() and state = 'idle in transaction'`
      );
      expect(rows.rows[0]?.count).toBe(0);
    };
    try {
      await publishSavedContentToGitHub(input);
    } finally {
      fake.state.beforeCommit = async () => {};
    }
  });
  test("an invalid explicit site cannot silently change a new publication's target", async () => {
    await createSite();
    await expect(
      publishSavedContentToGitHub({ ...input, siteId: "foreign-site" })
    ).rejects.toThrow("choosePublishingSite");
    expect(fake.state.prs).toHaveLength(0);
  });
  test("a direct schedule without a merge step commits only when its scheduled run executes", async () => {
    await setDirect();
    const { publishScheduledDestination, openScheduledPullRequestAhead } =
      await import("@/lib/content/scheduled-publication-destinations");
    await openScheduledPullRequestAhead({
      organizationId: org,
      postId: input.contentId,
      repositoryId,
    });
    expect(fake.state.branches.get("main")).toBe("initial");
    const now = new Date();
    const outcome = await publishScheduledDestination(
      {
        id: "direct-without-merge",
        organizationId: org,
        postId: input.contentId,
        destination: "github",
        destinationConfig: {
          destination: "github",
          repositoryId,
          merge: false,
        },
        scheduledAt: now,
        attempts: 1,
        createdByUserId: null,
        createdAt: now,
        result: null,
      },
      "synthetic-claim"
    );
    expect(outcome.kind).toBe("published");
    expect(fake.state.branches.get("main")).not.toBe("initial");
    expect(fake.state.prs).toHaveLength(0);
  });
  test("an unchanged pre-rollout scheduled PR does not get another commit", async () => {
    const first = await publishSavedContentToGitHub(input);
    const { createHash } = await import("node:crypto");
    const legacyHash = createHash("sha256")
      .update(
        JSON.stringify([
          "synthetic-story",
          "Synthetic story",
          "A synthetic article.",
        ])
      )
      .digest("hex");
    const { publishScheduledDestination } =
      await import("@/lib/content/scheduled-publication-destinations");
    const before = fake.state.commitCount;
    const now = new Date();
    const outcome = await publishScheduledDestination(
      {
        id: "legacy-hash",
        organizationId: org,
        postId: input.contentId,
        destination: "github",
        destinationConfig: {
          destination: "github",
          repositoryId,
          merge: false,
        },
        scheduledAt: now,
        attempts: 1,
        createdByUserId: null,
        createdAt: now,
        result: {
          pullRequestNumber: first.pullRequestNumber!,
          pullRequestUrl: first.pullRequestUrl!,
          headSha: first.headSha,
          contentHash: legacyHash,
        },
      },
      "synthetic-claim"
    );
    expect(outcome.kind).toBe("published");
    expect(fake.state.commitCount).toBe(before);
    expect(fake.state.prs).toHaveLength(1);
  });
  test("stale per-post sites ignore the output default, preserve saves and recover through an explicit pick", async () => {
    const site = await createSite();
    await createSite(`${org}-other`, "other", "main");
    await db.insert(repositoryOutputs).values({
      id: crypto.randomUUID(),
      repositoryId,
      outputType: "blog_post",
      config: { siteId: site.id },
    });
    const first = await publishSavedContentToGitHub({
      ...input,
      siteId: site.id,
    });
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, input.contentId),
    });
    await db
      .update(posts)
      .set({
        githubPublish: { ...post!.githubPublish!, siteId: "deleted-site" },
      })
      .where(eq(posts.id, input.contentId));
    const saved = await call(
      contentRouter.updateMetadata,
      {
        organizationId: org,
        contentId: input.contentId,
        metadata: { hidden: true },
      },
      { context: routeContext }
    );
    expect(saved.content.metadata.hidden).toBe(true);
    expect(saved.githubSyncError).toBe("savedSyncFailed");
    expect(fake.state.prs).toHaveLength(1);
    const recovered = await publishSavedContentToGitHub({
      ...input,
      siteId: site.id,
    });
    expect(recovered.pullRequestNumber).toBe(first.pullRequestNumber);
    expect(fake.state.prs).toHaveLength(1);
  });
}
