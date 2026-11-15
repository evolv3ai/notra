import { expect, mock, test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import { listFiles } from "../../../apps/sites-builder/compiler/utils/fs";
import type {
  SandboxBuildEffectParams,
  SandboxBuildResult,
} from "../../../packages/sites-server/src/types/build";
import { seedSiteProject } from "../../../packages/sites-server/tests/utils/site-project";
import { requireTestDatabaseUrl } from "../../../scripts/testing/dashboard/utils/database";
import { startSitesEmulators } from "../emulators";
import { serveFetch } from "../emulators/core/http-server";
import type { LifecycleWebhookDelivery } from "./types/lifecycle-webhooks";
import { lifecycleJournal } from "./utils/lifecycle-journal";

// SITES_E2E_BOX=1 builds every deployment in a real Upstash Box from the
// snapshot in SITES_BUILDER_SNAPSHOT_ID; otherwise the same Box client talks
// to the Box emulator, which runs the guest build locally.
const realBox = process.env.SITES_E2E_BOX === "1";
const WEBHOOK_SECRET = "controlled-lifecycle-webhook-secret";
const DASHBOARD_URL = "https://dashboard.example.test";
const CUSTOM_DOMAIN_ZONE = "acme-e2e.com";
const timeoutMs = realBox ? 900_000 : 240_000;
const databuddy = {
  clientId: "lifecycle_databuddy",
  trackWebVitals: true,
  skipPatterns: ["/drafts/**"],
};

if (!process.env.SITES_TEST_DATABASE_URL) {
  test.skip("Connected lifecycle requires isolated PostgreSQL", () => {});
} else if (process.env.NOTRA_SITES_CONNECTED_TEST_WORKER !== "1") {
  test("connected product lifecycle with real PostgreSQL and Box or local builds", () => {
    const databaseUrl = requireTestDatabaseUrl();
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NOTRA_SITES_CONNECTED_TEST_WORKER: "1",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
        },
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }, 910_000);
} else {
  requireTestDatabaseUrl();
  if (realBox) {
    assert.ok(
      process.env.UPSTASH_BOX_API_KEY,
      "UPSTASH_BOX_API_KEY is required"
    );
    assert.ok(
      process.env.SITES_BUILDER_SNAPSHOT_ID,
      "SITES_BUILDER_SNAPSHOT_ID is required"
    );
  }
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "notra-connected-lifecycle-"))
  );
  // GitHub is vercel-labs/emulate (stateful API, App JWT, scoped installation
  // tokens, check runs, signed webhooks). Its push webhooks reach the same
  // Sites handler and secret the dashboard route uses; jobs are then run here
  // instead of through the workflow dispatcher.
  const deliveries: LifecycleWebhookDelivery[] = [];
  const webhook: { receive?: (request: Request) => Promise<Response> } = {};
  const receiver = await serveFetch(
    (request) =>
      webhook.receive?.(request) ?? new Response(null, { status: 503 })
  );
  const fixture = resolve(
    import.meta.dirname,
    "../../sites-builder/fixtures/acme"
  );
  // GitHub, R2, Box, Cloudflare for SaaS, Vercel DNS and DNS itself run as
  // emulators the production clients reach over HTTP/UDP (emulators/).
  const emulators = await startSitesEmulators({
    directory,
    box: !realBox,
    vercelZones: [CUSTOM_DOMAIN_ZONE],
    dashboardUrl: DASHBOARD_URL,
    hostingDomain: "notra.test",
    github: {
      owner: "fixture",
      repo: "acme",
      appId: 4242,
      installationId: 535353,
      webhookUrl: `http://127.0.0.1:${receiver.port}/api/webhooks/github/app`,
      webhookSecret: WEBHOOK_SECRET,
      files: new Map(
        await Promise.all(
          (await listFiles(fixture)).map(
            async (file) =>
              [
                relative(fixture, file),
                new Uint8Array(await readFile(file)),
              ] as const
          )
        )
      ),
    },
  });
  const { github, r2 } = emulators;
  Object.assign(process.env, emulators.env, {
    SITES_HOSTING_DOMAIN: "notra.test",
    SITES_PREVIEW_SECRET: "controlled-lifecycle-preview-secret",
    NEXT_PUBLIC_APP_URL: DASHBOARD_URL,
    GEO_INGEST_SECRET: "controlled-lifecycle-ingest-secret",
    ...(emulators.box
      ? { SITES_E2E_BOX_TOOLCHAIN_VERSION: emulators.box.toolchainVersion }
      : {}),
  });
  // Name moderation is an evaluation call through the AI Gateway's
  // proprietary protocol; it is the one stubbed dependency.
  mock.module("@notra/ai/jobs/site-name-moderation", () => ({
    moderateSiteName: async () => null,
  }));
  let afterCompile = async () => {};
  let transientBuildFailure = false;
  let builds = 0;
  const journal = lifecycleJournal(realBox ? "upstash-box" : "emulated-box");
  const boxBuilds: SandboxBuildResult[] = [];
  const refusedAllocations: SandboxBuildResult[] = [];
  // Instrumentation around the real Box client, not a replacement: it counts
  // builds, injects one transport failure and runs `afterCompile` between
  // the build and its publication. mock.module patches already imported
  // modules in place, so keep the real function before replacing it.
  const { runSandboxBuildEffect: runBoxBuild } =
    await import("../../../packages/sites-server/src/box-build");
  mock.module("../../../packages/sites-server/src/box-build", () => ({
    runSandboxBuildEffect: (params: SandboxBuildEffectParams) =>
      Effect.gen(function* () {
        if (transientBuildFailure) {
          transientBuildFailure = false;
          journal.attemptFailed("Controlled transient Box transport failure");
          return yield* Effect.fail(
            new Error("Controlled transient Box transport failure")
          );
        }
        return yield* runBoxBuild({
          ...params,
          onComplete: (build) =>
            Effect.gen(function* () {
              if (build.metrics?.sandboxId) {
                builds += 1;
                boxBuilds.push(build);
                journal.build(build);
                yield* Effect.tryPromise({
                  try: afterCompile,
                  catch: (error) => error,
                });
              } else {
                refusedAllocations.push(build);
                journal.attemptFailed(
                  build.crash ?? "Box allocation failed",
                  build.durationMs
                );
              }
              if (params.onComplete) {
                yield* params.onComplete(build);
              }
            }),
        });
      }),
  }));
  const expectNoLiveBoxes = () => {
    if (!emulators.box) {
      return;
    }
    expect(
      [...emulators.box.boxes.values()]
        .filter((box) => !box.deleted)
        .map((box) => box.id)
    ).toEqual([]);
  };
  const { db } = await import("@notra/db/drizzle");
  const {
    abuseActions,
    users,
    organizations,
    githubAppInstallations,
    githubIntegrations,
    siteBranchDrafts,
    siteBuildTelemetry,
    siteDomains,
    siteJobs,
    siteDeployments,
    siteDrafts,
    sites,
  } = await import("@notra/db/schema");
  const { SiteHostConflictError, SitePlanLimitError } =
    await import("../../../packages/sites-server/src/errors/sites");
  const { eq, inArray } = await import("drizzle-orm");
  const { getGitHubAppWebhookSecret } =
    await import("@notra/ai/utils/github-mention-ingest");
  const {
    createSite,
    updateSiteSettings,
    deleteSite,
    setOrganizationSuspended,
    setSiteSuspended,
  } = await import("../../../packages/sites-server/src/sites");
  const { getSite, getDeployment } =
    await import("../../../packages/sites-server/src/deployments");
  const {
    deployBranchHead,
    promoteLatestDeployment,
    redeploy,
    rollbackToDeployment,
  } = await import("../../../packages/sites-server/src/deploy");
  const { createSiteBranch, mergeSiteBranch, requestSiteBranchReview } =
    await import("../../../packages/sites-server/src/branches");
  const { handleSitesWebhook } =
    await import("../../../packages/sites-server/src/webhooks");
  const { getBuildTelemetry } =
    await import("../../../packages/sites-server/src/build-telemetry");
  const { createBranchPreview, createPostPreview, deletePreview } =
    await import("../../../packages/sites-server/src/previews");
  const { readSiteIntegrations, saveSiteIntegration } =
    await import("../../../packages/sites-server/src/integrations");
  const { flushSiteDrafts, publishSiteDrafts } =
    await import("../../../packages/sites-server/src/editor");
  const { previewAccessUrl } =
    await import("../../../packages/sites-server/src/preview-access");
  const { runSiteJob } =
    await import("../../../packages/sites-server/src/runner");
  const { handleSiteRequest } = await import("../../../apps/sites/src/handler");
  const { resetCachesForTests } =
    await import("../../../apps/sites/src/loaders");
  const { SITE_R2_KEYS } = await import("@notra/sites-core/constants/sites");
  const { r2Put } = await import("../../../packages/sites-server/src/r2");
  const {
    addSiteDomain,
    refreshSiteDomain,
    removeSiteDomain,
    requireSiteDomain,
  } = await import("../../../packages/sites-server/src/domains");
  const { dnsSetupForDomain } =
    await import("../../../packages/sites-server/src/dns-setup");
  const {
    applyVercelDnsRecords,
    exchangeVercelCode,
    findVercelZone,
    getVercelDnsConfig,
    removeVercelInstallation,
    verifyVercelDnsState,
  } = await import("../../../packages/sites-server/src/vercel-dns");
  // Mirrors the Sites half of apps/dashboard/src/app/api/webhooks/github/app.
  webhook.receive = async (request) => {
    const rawBody = await request.text();
    const secret = getGitHubAppWebhookSecret();
    assert.ok(secret);
    const delivery = {
      event: request.headers.get("x-github-event") ?? "",
      deliveryId: request.headers.get("x-github-delivery"),
      signature: request.headers.get("x-hub-signature-256"),
      rawBody,
    };
    const result = await handleSitesWebhook({ ...delivery, secret });
    deliveries.push({
      ...delivery,
      after: (JSON.parse(rawBody) as { after?: string }).after ?? null,
      jobIds: result?.jobIds ?? [],
      status: result?.httpStatus ?? 202,
    });
    return Response.json(result?.body ?? {}, {
      status: result?.httpStatus ?? 202,
    });
  };
  // emulate derives commit SHAs without timestamps, so identical commits on
  // two branches share a SHA; match the ref too.
  const deliveryFor = async (sha: string, ref = "refs/heads/main") => {
    const deadline = Date.now() + 15_000;
    for (;;) {
      const delivery = deliveries.find(
        (entry) =>
          entry.event === "push" &&
          entry.after === sha &&
          (JSON.parse(entry.rawBody) as { ref?: string }).ref === ref
      );
      if (delivery) {
        return delivery;
      }
      assert.ok(Date.now() < deadline, `no push webhook for ${sha}`);
      await delay(100);
    }
  };
  // A commit on GitHub; its push webhook must enqueue exactly one job.
  const pushAndQueue = async (
    changes: { path: string; content: string | null }[],
    message: string
  ) => {
    const sha = await github.push(
      changes.map((change) => ({
        path: change.path,
        content:
          change.content === null
            ? null
            : new TextEncoder().encode(change.content),
      })),
      message
    );
    const delivery = await deliveryFor(sha);
    expect(delivery.status).toBe(200);
    expect(delivery.jobIds).toHaveLength(1);
    return { sha, jobId: delivery.jobIds[0] as string };
  };
  test("create → publish → failed push → fix with retry → redeploy → rollback → protected preview → settings → post preview → stale build → Databuddy via pull request, direct publish and push webhook → promote → delete", async () => {
    const organizationId = `journey-${crypto.randomUUID()}`;
    const freeOrganizationId = `${organizationId}-free`;
    const userId = `${organizationId}-user`;
    let siteId: string | null = null;
    let freeSiteId: string | null = null;
    const request = (url: string, headers?: HeadersInit) => {
      resetCachesForTests();
      return handleSiteRequest(new Request(url, { headers }), {
        bucket: r2.binding(),
        cache: null,
        hostingDomain: "notra.test",
        dashboardUrl: DASHBOARD_URL,
        previewSecret: "controlled-lifecycle-preview-secret",
        devHostOverrideToken: null,
        passwordAttemptLimiter: null,
        sitePasswordAttemptLimiter: null,
        trafficIngestUrl: null,
        fetch: async () => {
          throw new Error("Unexpected external worker request");
        },
        waitUntil: () => {},
        now: () => new Date(),
      });
    };
    const phase = async (name: string) => {
      expectNoLiveBoxes();
      await journal.phase(name);
    };
    const deploymentFor = async (jobId: string) => {
      const job = await db.query.siteJobs.findFirst({
        where: eq(siteJobs.id, jobId),
      });
      assert.ok(job?.deploymentId);
      const deployment = await getDeployment(job.deploymentId);
      assert.ok(deployment);
      return deployment;
    };
    const runSyncJob = async (syncJobId: string) => {
      expect(await runSiteJob(syncJobId)).toEqual({ status: "done" });
      expect(
        await db.query.siteJobs.findFirst({
          where: eq(siteJobs.id, syncJobId),
        })
      ).toMatchObject({ status: "done", lastError: null });
    };
    // A settings change syncs state and enqueues its own production build.
    const runSettingsRebuild = async (syncJobId: string) => {
      await runSyncJob(syncJobId);
      const [build] = await db
        .select({ id: siteJobs.id })
        .from(siteJobs)
        .where(eq(siteJobs.dedupeKey, `settings-build:${syncJobId}`));
      assert.ok(build, "the settings change enqueued a rebuild");
      expect(await runSiteJob(build.id)).toMatchObject({
        status: "done",
        outcome: "live",
      });
    };
    const expectProduction = async (
      currentSiteId: string,
      deploymentId: string,
      html: string
    ) => {
      const current = await getSite(currentSiteId);
      assert.ok(current);
      expect(current.activeProductionDeploymentId).toBe(deploymentId);
      expect(
        JSON.parse(r2.text(SITE_R2_KEYS.state(currentSiteId)) ?? "null")
          ?.production?.deploymentId
      ).toBe(deploymentId);
      expect(await (await request(`${current.publicOrigin}/blog`)).text()).toBe(
        html
      );
    };
    const checkRun = async (sha: string) => {
      const runs = await github.checkRuns(sha);
      expect(runs).toHaveLength(1);
      return runs[0];
    };
    let failure: unknown;
    try {
      await phase("create site and first deploy");
      await db.insert(users).values({
        id: userId,
        name: "Fixture",
        email: `${userId}@example.test`,
      });
      await db.insert(organizations).values({
        id: organizationId,
        name: "Fixture",
        slug: organizationId,
        createdAt: new Date(),
      });
      // The journey runs on a paid plan: no workspace caps on sites or domains.
      emulators.autumn.setPlan(organizationId, "growth");
      const projectId = await seedSiteProject(organizationId);
      await db.insert(githubAppInstallations).values({
        id: `${organizationId}-installation`,
        organizationId,
        createdByUserId: userId,
        installationId: "535353",
        accountId: "fixture-account",
        accountLogin: "fixture",
        accountAvatarUrl: "https://example.test/avatar",
        accountType: "User",
      });
      await db.insert(githubIntegrations).values({
        id: `${organizationId}-repository`,
        organizationId,
        createdByUserId: userId,
        displayName: "Fixture repository",
        githubAppInstallationId: `${organizationId}-installation`,
        githubRepositoryId: String(github.repositoryId),
        owner: "fixture",
        repo: "acme",
        defaultBranch: "main",
      });
      const input = {
        organizationId,
        userId,
        projectId,
        name: "Acme lifecycle",
        slug: `journey-${crypto.randomUUID().slice(0, 8)}`,
        repositoryId: `${organizationId}-repository`,
        mounts: { blog: "/blog", changelog: "/changelog" },
      };
      await expect(
        createSite({ ...input, organizationId: "another-tenant" })
      ).rejects.toThrow("Project not found");
      const created = await createSite(input);
      siteId = created.site.id;
      const initialSettings = await updateSiteSettings(
        created.site,
        { smartDeployments: false },
        userId
      );
      expect(initialSettings).toMatchObject({
        rebuilding: false,
        site: { smartDeployments: false },
      });
      await runSyncJob(initialSettings.syncJobId);
      let site = initialSettings.site;
      assert.ok(created.jobId);
      const aliasHostname = new URL(site.publicOrigin).hostname;
      const duplicate = await createSite(input).then(
        () => null,
        (error: unknown) => error
      );
      expect(duplicate).toBeInstanceOf(SiteHostConflictError);
      expect((duplicate as Error).message).toBe(
        `${aliasHostname} already belongs to another site`
      );
      expect(
        JSON.parse(r2.text(SITE_R2_KEYS.host(aliasHostname)) ?? "null")
      ).toMatchObject({ siteId: site.id, kind: "alias" });
      expect(
        await db.select().from(sites).where(eq(sites.slug, input.slug))
      ).toHaveLength(1);
      expect(await runSiteJob(created.jobId)).toMatchObject({
        status: "done",
        outcome: "live",
      });
      const first = await deploymentFor(created.jobId);
      expect(first.commitSha).toBe(await github.head());
      expect(await checkRun(first.commitSha ?? "")).toMatchObject({
        status: "completed",
        conclusion: "success",
      });
      expect((await runSiteJob(created.jobId)).status).toBe("skipped");
      expect((await getDeployment(first.id))?.status).toBe("ready");
      const firstLog = r2.objects.get(SITE_R2_KEYS.buildLog(site.id, first.id));
      assert.ok(firstLog, "the build log is stored for the dashboard");
      expect(new TextDecoder().decode(firstLog.body)).toContain(
        "Built blog at /blog"
      );
      // Telemetry comes from the Box's metrics.
      const telemetry = await getBuildTelemetry(first.id);
      assert.ok(telemetry, "build telemetry is stored");
      expect(telemetry.metrics).toMatchObject({
        provider: "upstash",
        cleanupSucceeded: true,
      });
      assert.ok(telemetry.metrics.sandboxId);
      const initial = await request(`${site.publicOrigin}/blog`);
      expect(initial.status).toBe(200);
      const initialHtml = await initial.text();
      expect(initialHtml).toContain("Notes on building calm software");
      expect(initialHtml).not.toContain("A draft idea");
      expect((await request(`${site.publicOrigin}/changelog`)).status).toBe(
        200
      );
      expect((await request(`${site.publicOrigin}/missing`)).status).toBe(404);
      const config = await github.file("blog.json");
      assert.ok(config);
      await phase("broken push fails, production kept");
      // A broken push fails its build, reports it on the commit, keeps prod.
      const broken = await pushAndQueue(
        [{ path: "blog.json", content: "{ invalid JSON" }],
        "Break the config"
      );
      expect(await runSiteJob(broken.jobId)).toMatchObject({
        status: "done",
        outcome: "failed",
      });
      const brokenDeployment = await deploymentFor(broken.jobId);
      expect(brokenDeployment.status).toBe("failed");
      expect(await checkRun(broken.sha)).toMatchObject({
        status: "completed",
        conclusion: "failure",
      });
      await expectProduction(site.id, first.id, initialHtml);
      await phase("redeploy of the broken commit");
      // Redeploying a broken commit builds the same source and fails again.
      const rebuildBroken = await redeploy(site, brokenDeployment.id, userId);
      expect(await runSiteJob(rebuildBroken)).toMatchObject({
        status: "done",
        outcome: "failed",
      });
      expect((await deploymentFor(rebuildBroken)).status).toBe("failed");
      await expectProduction(site.id, first.id, initialHtml);
      const boxApi = emulators.box;
      if (boxApi) {
        await phase("Box keeps refusing allocation: bounded retries");
        const refusedJob = await redeploy(site, brokenDeployment.id, userId);
        const boxesBefore = boxApi.boxes.size;
        const refusedBefore = refusedAllocations.length;
        Object.assign(boxApi.failNext, { create: 10, status: 400 });
        const outcomes: string[] = [];
        for (let attempt = 0; attempt < 10; attempt++) {
          await db
            .update(siteJobs)
            .set({ availableAt: new Date(0) })
            .where(eq(siteJobs.id, refusedJob));
          const { status } = await runSiteJob(refusedJob);
          outcomes.push(status);
          if (status !== "retrying") {
            break;
          }
        }
        const refused = await db.query.siteJobs.findFirst({
          where: eq(siteJobs.id, refusedJob),
        });
        assert.ok(refused);
        expect(outcomes.at(-1)).toBe("failed");
        expect(outcomes.length).toBeLessThanOrEqual(refused.maxAttempts);
        expect(refused.status).toBe("failed");
        expect(refused.lastError).toContain("Sandbox rejected create (400)");
        const refusedDeployment = await deploymentFor(refusedJob);
        expect(refusedDeployment.status).toBe("failed");
        expect(refusedDeployment.errorMessage).toContain(
          "Sandbox rejected create (400)"
        );
        expect(await runSiteJob(refusedJob)).toEqual({ status: "skipped" });
        expect(boxApi.failNext.create).toBe(10 - outcomes.length);
        Object.assign(boxApi.failNext, { create: 0, status: undefined });
        expect(boxApi.boxes.size).toBe(boxesBefore);
        expect(refusedAllocations.length - refusedBefore).toBe(outcomes.length);
        await expectProduction(site.id, first.id, initialHtml);
      }
      await phase("fix push with a transient retry");
      const fixed = await pushAndQueue(
        [
          {
            path: "blog.json",
            content: config.replace(
              '"name": "Acme"',
              '"name": "Acme recovered"'
            ),
          },
        ],
        "Fix the config"
      );
      if (boxApi) {
        boxApi.failNext.create = 1;
      } else {
        transientBuildFailure = true;
      }
      const boxesBeforeRetry = boxApi?.boxes.size ?? 0;
      expect((await runSiteJob(fixed.jobId)).status).toBe("retrying");
      const pendingRetry = await db.query.siteJobs.findFirst({
        where: eq(siteJobs.id, fixed.jobId),
      });
      expect(pendingRetry).toMatchObject({ status: "pending", attempts: 1 });
      if (boxApi) {
        expect(boxApi.failNext.create).toBe(0);
        expect(boxApi.boxes.size).toBe(boxesBeforeRetry);
        expect(pendingRetry?.lastError).toContain(
          "Sandbox rejected create (503)"
        );
      }
      assert.ok(
        pendingRetry && pendingRetry.availableAt.getTime() > Date.now()
      );
      expect(await (await request(`${site.publicOrigin}/blog`)).text()).toBe(
        initialHtml
      );
      await db
        .update(siteJobs)
        .set({ availableAt: new Date(0) })
        .where(eq(siteJobs.id, fixed.jobId));
      expect(await runSiteJob(fixed.jobId)).toMatchObject({
        status: "done",
        outcome: "live",
      });
      expect(
        await (await request(`${site.publicOrigin}/blog`)).text()
      ).toContain("Acme recovered");
      await phase("rollback");
      await rollbackToDeployment(site, first.id);
      expect(await (await request(`${site.publicOrigin}/blog`)).text()).toBe(
        initialHtml
      );
      await phase("protected branch preview");
      await github.createBranch("feature/example");
      const preview = await createBranchPreview(
        site,
        "feature/example",
        userId
      );
      expect(await runSiteJob(preview.jobId)).toMatchObject({
        status: "done",
        outcome: "live",
      });
      const share = await previewAccessUrl({
        site,
        previewKey: preview.previewKey,
        kind: "share",
        userId,
        next: "/blog",
      });
      const previewOrigin = new URL(share.url).origin;
      const denied = await request(`${previewOrigin}/blog`);
      expect(denied.status).toBe(401);
      const auth = await request(share.url);
      expect(auth.status).toBe(302);
      const cookie = auth.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie);
      const authorized = await request(`${previewOrigin}/blog`, { cookie });
      expect(authorized.status).toBe(200);
      const previewHtml = await authorized.text();
      expect(previewHtml).toContain("Acme recovered");
      expect(previewHtml).toContain("noindex");
      expect(await (await request(`${previewOrigin}/robots.txt`)).text()).toBe(
        "User-agent: *\nDisallow: /\n"
      );
      await phase("public preview setting");
      const settings = await updateSiteSettings(
        site,
        { previewVisibility: "public" },
        userId
      );
      site = settings.site;
      expect(settings.rebuilding).toBe(false);
      await runSyncJob(settings.syncJobId);
      expect((await request(`${previewOrigin}/blog`)).status).toBe(200);
      expect(
        (await runSiteJob(await deletePreview(site, preview.previewKey))).status
      ).toBe("done");
      expect((await request(`${previewOrigin}/blog`)).status).toBe(410);
      await phase("post preview overlay");
      // A post preview builds unpublished files on top of production without
      // committing them (Box overlay upload).
      const postPreview = await createPostPreview(site, {
        postId: "lifecycle-post",
        title: "Preview only post",
        pagePath: "/blog/preview-only",
        files: [
          {
            path: "blog/preview-only.md",
            contents: new TextEncoder().encode(
              "---\ntitle: Preview only post\ndescription: Overlay only.\ndate: 2026-10-01\nauthor: jan\n---\n\nOnly in the post preview.\n"
            ),
          },
        ],
        lifetime: "1h",
        password: null,
        userId,
      });
      expect(await runSiteJob(postPreview.jobId)).toMatchObject({
        status: "done",
        outcome: "live",
      });
      const postOrigin = new URL(
        (
          await previewAccessUrl({
            site,
            previewKey: postPreview.previewKey,
            kind: "share",
            userId,
            next: "/blog/preview-only",
          })
        ).url
      ).origin;
      const postPage = await request(`${postOrigin}/blog/preview-only`);
      expect(postPage.status).toBe(200);
      expect(await postPage.text()).toContain("Only in the post preview.");
      expect(await github.file("blog/preview-only.md")).toBeNull();
      expect(
        await (await request(`${site.publicOrigin}/blog`)).text()
      ).not.toContain("Preview only post");
      expect(
        (await request(`${site.publicOrigin}/blog/preview-only`)).status
      ).toBe(404);
      expect(
        (await runSiteJob(await deletePreview(site, postPreview.previewKey)))
          .status
      ).toBe("done");
      expect((await request(`${postOrigin}/blog/preview-only`)).status).toBe(
        410
      );
      await phase("previews off, suspend and resume");
      const disabled = await updateSiteSettings(
        site,
        { previewsEnabled: false },
        userId
      );
      site = disabled.site;
      await runSyncJob(disabled.syncJobId);
      const servingState = JSON.parse(
        r2.text(SITE_R2_KEYS.state(site.id)) ?? "null"
      );
      expect(servingState.previews).toEqual({});
      expect(servingState.removedPreviews).toMatchObject({
        [preview.previewKey]: site.lastGeneration,
        [postPreview.previewKey]: site.lastGeneration,
      });
      await expect(
        createBranchPreview(site, "feature/new", userId)
      ).rejects.toThrow("Previews are turned off");
      await setSiteSuspended(site, true);
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(410);
      const suspended = await getSite(site.id);
      assert.ok(suspended);
      await setSiteSuspended(suspended, false);
      const resumed = await getSite(site.id);
      assert.ok(resumed);
      site = resumed;
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(200);
      await phase("Notra suspension: reason page, audit, owner can't lift");
      await setSiteSuspended(site, true, {
        by: "notra",
        reason: "Lifecycle phishing report",
        category: "phishing",
        actorUserId: userId,
      });
      const takenDown = await request(`${site.publicOrigin}/blog`);
      expect(takenDown.status).toBe(410);
      const takenDownHtml = await takenDown.text();
      expect(takenDownHtml).toContain(
        "Reason: Phishing or credential harvesting"
      );
      expect(takenDownHtml).toContain(
        `mailto:abuse@usenotra.com?subject=${encodeURIComponent(`Abuse report: ${new URL(site.publicOrigin).host}`)}`
      );
      expect(takenDownHtml).not.toContain("Lifecycle phishing report");
      const notraSuspended = await getSite(site.id);
      assert.ok(notraSuspended);
      await expect(setSiteSuspended(notraSuspended, false)).rejects.toThrow(
        "Notra suspended this site"
      );
      await setSiteSuspended(notraSuspended, false, {
        by: "notra",
        reason: "Lifecycle appeal accepted",
        actorUserId: userId,
      });
      const reinstated = await getSite(site.id);
      assert.ok(reinstated);
      site = reinstated;
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(200);
      await phase("workspace suspension: sites, builds and new sites blocked");
      const workspace = await setOrganizationSuspended({
        organizationId,
        suspended: true,
        reason: "Lifecycle repeat abuse",
        category: "malware",
        actorUserId: userId,
      });
      expect(workspace.sites.map((entry) => entry.id)).toEqual([site.id]);
      const workspacePage = await request(`${site.publicOrigin}/blog`);
      expect(workspacePage.status).toBe(410);
      expect(await workspacePage.text()).toContain(
        "Reason: Malware or unwanted software"
      );
      await expect(
        deployBranchHead(site, { trigger: "manual", userId })
      ).rejects.toThrow("This site is suspended");
      const blockedPush = await github.push(
        [
          {
            path: "notes/suspended.txt",
            content: new TextEncoder().encode("blocked"),
          },
        ],
        "Push while the workspace is suspended"
      );
      const blockedDelivery = await deliveryFor(blockedPush);
      expect(blockedDelivery.jobIds).toEqual([]);
      await expect(
        createSite({ ...input, name: "Second site", slug: undefined })
      ).rejects.toThrow("Notra suspended this workspace");
      const workspaceSite = await getSite(site.id);
      assert.ok(workspaceSite);
      await expect(
        setSiteSuspended(workspaceSite, false, {
          by: "notra",
          reason: "Too early",
          actorUserId: userId,
        })
      ).rejects.toThrow("Lift the workspace suspension first");
      await expect(setSiteSuspended(workspaceSite, false)).rejects.toThrow(
        "Notra suspended this"
      );
      const lifted = await setOrganizationSuspended({
        organizationId,
        suspended: false,
        reason: "Lifecycle appeal accepted",
        actorUserId: userId,
      });
      expect(lifted.sites.map((entry) => entry.id)).toEqual([site.id]);
      const workspaceRestored = await getSite(site.id);
      assert.ok(workspaceRestored);
      expect(workspaceRestored).toMatchObject({
        status: "active",
        suspendedBy: null,
        suspendedWithOrganization: false,
      });
      site = workspaceRestored;
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(200);
      const audit = await db
        .select({
          subjectType: abuseActions.subjectType,
          action: abuseActions.action,
          category: abuseActions.category,
          actorUserId: abuseActions.actorUserId,
        })
        .from(abuseActions)
        .where(inArray(abuseActions.subjectId, [site.id, organizationId]))
        // A workspace action writes its own row and its sites' rows in one
        // transaction, so they share a timestamp; the workspace row sorts first.
        .orderBy(abuseActions.createdAt, abuseActions.subjectType);
      // The owner's own suspend and resume above are not moderation, so
      // they leave no audit rows.
      expect(audit).toEqual([
        {
          subjectType: "site",
          action: "suspend",
          category: "phishing",
          actorUserId: userId,
        },
        {
          subjectType: "site",
          action: "unsuspend",
          category: null,
          actorUserId: userId,
        },
        {
          subjectType: "organization",
          action: "suspend",
          category: "malware",
          actorUserId: userId,
        },
        {
          subjectType: "site",
          action: "suspend",
          category: "malware",
          actorUserId: userId,
        },
        {
          subjectType: "organization",
          action: "unsuspend",
          category: null,
          actorUserId: userId,
        },
        {
          subjectType: "site",
          action: "unsuspend",
          category: null,
          actorUserId: userId,
        },
      ]);
      await phase("workspace actions serialize with each other and the owner");
      // Holds the workspace row while the given actions start one after
      // another, so each queues behind it and they run in that order.
      const queuedBehindWorkspaceLock = async (
        starts: (() => Promise<unknown>)[]
      ) => {
        let release = () => {};
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        let locked = () => {};
        const holding = new Promise<void>((resolve) => {
          locked = resolve;
        });
        const holder = db.transaction(async (tx) => {
          await tx
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.id, organizationId))
            .for("update");
          locked();
          await released;
        });
        await holding;
        const runs: Promise<unknown>[] = [];
        for (const start of starts) {
          runs.push(start());
          await delay(200);
        }
        release();
        await holder;
        return await Promise.allSettled(runs);
      };
      const workspaceState = async () => {
        const [row] = await db
          .select({ suspendedAt: organizations.suspendedAt })
          .from(organizations)
          .where(eq(organizations.id, organizationId));
        return {
          suspended: row?.suspendedAt != null,
          site: await getSite(site.id),
        };
      };
      const [raceSuspend, raceLift] = await queuedBehindWorkspaceLock([
        () =>
          setOrganizationSuspended({
            organizationId,
            suspended: true,
            reason: "Lifecycle race suspend",
            category: "spam",
            actorUserId: userId,
          }),
        () =>
          setOrganizationSuspended({
            organizationId,
            suspended: false,
            reason: "Lifecycle race lift",
            actorUserId: userId,
          }),
      ]);
      expect(raceSuspend?.status).toBe("fulfilled");
      expect(raceLift?.status).toBe("fulfilled");
      const afterLift = await workspaceState();
      expect(afterLift.suspended).toBe(false);
      expect(afterLift.site).toMatchObject({
        status: "active",
        suspendedWithOrganization: false,
      });
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(200);
      const ownerPaused = await getSite(site.id);
      assert.ok(ownerPaused);
      await setSiteSuspended(ownerPaused, true);
      const [raceTakedown, raceReactivate] = await queuedBehindWorkspaceLock([
        () =>
          setOrganizationSuspended({
            organizationId,
            suspended: true,
            reason: "Lifecycle race takedown",
            category: "spam",
            actorUserId: userId,
          }),
        () => setSiteSuspended(ownerPaused, false),
      ]);
      expect(raceTakedown?.status).toBe("fulfilled");
      expect(raceReactivate?.status).toBe("rejected");
      expect(
        String((raceReactivate as PromiseRejectedResult).reason)
      ).toContain("Notra suspended this workspace");
      const afterTakedown = await workspaceState();
      expect(afterTakedown.suspended).toBe(true);
      expect(afterTakedown.site?.status).toBe("suspended");
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(410);
      const raceRestored = await setOrganizationSuspended({
        organizationId,
        suspended: false,
        reason: "Lifecycle race restore",
        actorUserId: userId,
      });
      expect(raceRestored.sites).toEqual([]);
      const ownerResumed = await getSite(site.id);
      assert.ok(ownerResumed);
      expect(ownerResumed).toMatchObject({
        status: "suspended",
        suspendedBy: "owner",
      });
      await setSiteSuspended(ownerResumed, false);
      const raceDone = await getSite(site.id);
      assert.ok(raceDone);
      site = raceDone;
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(200);
      await phase(
        "workspace state machine: repeats, partial failures, retries"
      );
      const { CAS_ATTEMPTS } =
        await import("../../../packages/sites-server/src/constants/state");
      const machineStateKey = SITE_R2_KEYS.state(site.id);
      // Every serving-state write of this site to the given status loses its
      // compare-and-set until the retries run out, so that site update fails.
      const failStatusWrites = (status: string) => {
        for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
          r2.raceNextConditionalWrite(
            (key, incoming) =>
              key === machineStateKey &&
              incoming.includes(`"status":"${status}"`),
            (text) => `${text} `
          );
        }
      };
      const workspaceRow = async () =>
        (
          await db
            .select({
              suspendedAt: organizations.suspendedAt,
              suspendedReason: organizations.suspendedReason,
              suspendedCategory: organizations.suspendedCategory,
            })
            .from(organizations)
            .where(eq(organizations.id, organizationId))
        )[0];
      const suspendWorkspace = {
        organizationId,
        suspended: true,
        reason: "Lifecycle state machine",
        category: "phishing" as const,
        actorUserId: userId,
      };
      const liftWorkspace = {
        organizationId,
        suspended: false,
        reason: "Lifecycle state machine lift",
        actorUserId: userId,
      };
      await expect(
        setOrganizationSuspended({ ...suspendWorkspace, category: undefined })
      ).rejects.toThrow("A suspension needs a category");

      failStatusWrites("suspended");
      const partialSuspend = await setOrganizationSuspended(suspendWorkspace);
      expect(partialSuspend).toMatchObject({
        retry: false,
        failed: 1,
        sites: [],
      });
      expect(r2.pendingRaces()).toBe(0);
      const suspendedRow = await workspaceRow();
      expect(suspendedRow?.suspendedAt).not.toBeNull();
      expect((await getSite(site.id))?.status).toBe("active");

      const finishSuspend = await setOrganizationSuspended({
        ...suspendWorkspace,
        reason: "Finish the takedown",
        category: undefined,
      });
      expect(finishSuspend).toMatchObject({ retry: true, failed: 0 });
      expect(finishSuspend.sites.map((entry) => entry.id)).toEqual([site.id]);
      assert.ok(partialSuspend.notice);
      expect(finishSuspend.notice).toEqual({
        key: partialSuspend.notice.key,
        category: "phishing",
        reason: "Lifecycle state machine",
        siteNames: [site.name],
      });
      expect(await workspaceRow()).toEqual(suspendedRow);
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(410);
      const repeatSuspend = await setOrganizationSuspended(suspendWorkspace);
      expect(repeatSuspend).toMatchObject({
        retry: true,
        failed: 0,
        sites: [],
      });
      expect(repeatSuspend.notice?.key).toBe(partialSuspend.notice?.key);
      expect(await workspaceRow()).toEqual(suspendedRow);

      failStatusWrites("active");
      const partialLift = await setOrganizationSuspended(liftWorkspace);
      expect(partialLift).toMatchObject({
        retry: false,
        failed: 1,
        sites: [],
        notice: null,
      });
      expect(r2.pendingRaces()).toBe(0);
      expect((await workspaceRow())?.suspendedAt).toBeNull();
      expect(await getSite(site.id)).toMatchObject({
        status: "suspended",
        suspendedWithOrganization: true,
      });
      const finishLift = await setOrganizationSuspended(liftWorkspace);
      expect(finishLift).toMatchObject({ retry: true, failed: 0 });
      expect(finishLift.sites.map((entry) => entry.id)).toEqual([site.id]);
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(200);
      const repeatLift = await setOrganizationSuspended(liftWorkspace);
      expect(repeatLift).toMatchObject({ retry: true, failed: 0, sites: [] });

      const machineSite = await getSite(site.id);
      assert.ok(machineSite);
      const notraTakedown = {
        by: "notra" as const,
        reason: "Lifecycle site repeat",
        category: "spam" as const,
        actorUserId: userId,
      };
      const siteSuspend = await setSiteSuspended(
        machineSite,
        true,
        notraTakedown
      );
      expect(siteSuspend).toMatchObject({
        changed: true,
        retry: false,
        notice: { category: "spam", reason: "Lifecycle site repeat" },
      });
      // A repeat keeps the original notice, whatever the retry says.
      expect(
        await setSiteSuspended(machineSite, true, {
          ...notraTakedown,
          reason: "Lifecycle site repeat, second report",
          category: "malware",
        })
      ).toEqual({
        changed: false,
        retry: true,
        notice: siteSuspend.notice,
      });
      const notraRestore = {
        by: "notra" as const,
        reason: "Lifecycle site restore",
        actorUserId: userId,
      };
      expect(await setSiteSuspended(machineSite, false, notraRestore)).toEqual({
        changed: true,
        retry: false,
        notice: null,
      });
      expect(await setSiteSuspended(machineSite, false, notraRestore)).toEqual({
        changed: false,
        retry: true,
        notice: null,
      });
      const machineAudit = await db
        .select({
          subjectType: abuseActions.subjectType,
          retry: abuseActions.retry,
        })
        .from(abuseActions)
        .where(inArray(abuseActions.subjectId, [site.id, organizationId]));
      expect(
        machineAudit
          .filter((row) => row.retry)
          .map((row) => row.subjectType)
          .sort()
      ).toEqual([
        "organization",
        "organization",
        "organization",
        "organization",
        "site",
        "site",
      ]);
      const machineDone = await getSite(site.id);
      assert.ok(machineDone);
      site = machineDone;
      expect((await request(`${site.publicOrigin}/blog`)).status).toBe(200);
      await phase("stale push during compile");
      // A push that lands while the previous build is still compiling makes
      // that build stale: it must not publish.
      const stalePush = await pushAndQueue(
        [{ path: "notes/stale.txt", content: "first" }],
        "Stale change"
      );
      let newerJob: string | undefined;
      afterCompile = async () => {
        afterCompile = async () => {};
        newerJob = (
          await pushAndQueue(
            [{ path: "notes/stale.txt", content: "second" }],
            "Newer change"
          )
        ).jobId;
      };
      expect(await runSiteJob(stalePush.jobId)).toMatchObject({
        status: "done",
        outcome: "skipped",
      });
      assert.ok(newerJob);
      const stale = await deploymentFor(stalePush.jobId);
      expect(stale.status).toBe("superseded");
      expect(r2.has(SITE_R2_KEYS.manifest(site.id, stale.id))).toBe(false);
      expect(await (await request(`${site.publicOrigin}/blog`)).text()).toBe(
        initialHtml
      );
      await phase("Databuddy on a feature branch: draft PR, review, merge");
      expect(initialHtml).not.toContain("databuddy");
      // The editor's branch flow, as the dashboard's sites.branches routes run
      // it: create a branch, save the integration there (feature branches
      // commit automatically and open a draft pull request), request review,
      // then merge and deploy the merged commit.
      const { branch: featureBranch } = await createSiteBranch(site, {
        title: "Add Databuddy",
        bringChanges: false,
        userId,
      });
      expect(await github.head(featureBranch)).toBe(await github.head());
      expect(
        await saveSiteIntegration(site, {
          provider: "databuddy",
          settings: databuddy,
          userId,
          branch: featureBranch,
        })
      ).toMatchObject({ hasDraft: true, invalid: false });
      expect(await readSiteIntegrations(site, featureBranch)).toMatchObject({
        integrations: { databuddy },
        hasDraft: true,
      });
      expect(await readSiteIntegrations(site)).toMatchObject({
        integrations: {},
        hasDraft: false,
      });
      const saved = await flushSiteDrafts(site, {
        branch: featureBranch,
        message: "Update site content",
        userId,
      });
      expect(saved.commitSha).toBe(await github.head(featureBranch));
      // The branch push reaches the webhook; with previews off it deploys
      // nothing.
      expect(
        await deliveryFor(saved.commitSha, `refs/heads/${featureBranch}`)
      ).toMatchObject({ status: 200, jobIds: [] });
      const [proposal, ...otherPullRequests] = await github.pullRequests();
      expect(otherPullRequests).toHaveLength(0);
      assert.ok(proposal);
      expect(proposal).toMatchObject({
        state: "open",
        draft: true,
        base: { ref: "main" },
        head: { ref: featureBranch, sha: saved.commitSha },
      });
      expect(saved.pullRequestUrl).toContain(`/pull/${proposal.number}`);
      expect(await github.file("blog.json", featureBranch)).toContain(
        databuddy.clientId
      );
      expect(await github.file("blog.json")).not.toContain("databuddy");
      // A draft cannot be merged until review is requested.
      await expect(mergeSiteBranch(site, featureBranch)).rejects.toThrow(
        "GitHub has not allowed this pull request to merge"
      );
      await requestSiteBranchReview(site, featureBranch);
      expect((await github.pullRequests())[0]).toMatchObject({
        draft: false,
        state: "open",
      });
      const merged = await mergeSiteBranch(site, featureBranch);
      expect(merged).toMatchObject({ branch: "main" });
      expect(merged.commitSha).toBe(await github.head());
      expect((await github.pullRequests())[0]).toMatchObject({
        state: "closed",
        merged: true,
      });
      expect(await github.file("blog.json")).toContain(databuddy.clientId);
      expect(await readSiteIntegrations(site)).toMatchObject({
        integrations: { databuddy },
        hasDraft: false,
      });
      // mergeAndPublish deploys the merged commit right away.
      const integrationJob = await deployBranchHead(site, {
        trigger: "manual",
        userId,
        commitSha: merged.commitSha,
      });
      const published = merged;
      await phase("signed push webhook");
      // GitHub delivers the commit as a signed push webhook; a forged
      // signature is rejected and a redelivery is ignored.
      const delivered = await deliveryFor(published.commitSha);
      expect(delivered.status).toBe(200);
      // The dashboard already queued this commit; the push adds no build.
      expect(delivered.jobIds).toEqual([integrationJob]);
      const webhookUrl = `http://127.0.0.1:${receiver.port}/api/webhooks/github/app`;
      const forged = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "x-github-event": "push",
          "x-github-delivery": crypto.randomUUID(),
          "x-hub-signature-256": `sha256=${createHmac("sha256", "wrong-secret").update(delivered.rawBody).digest("hex")}`,
        },
        body: delivered.rawBody,
      });
      expect(forged.status).toBe(401);
      const redelivered = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "x-github-event": "push",
          "x-github-delivery": delivered.deliveryId ?? "",
          "x-hub-signature-256": delivered.signature ?? "",
        },
        body: delivered.rawBody,
      });
      expect(await redelivered.json()).toEqual({
        message: "duplicate delivery",
      });
      await phase("held build and promote");
      // The earlier rollback pinned production, so the new build waits.
      expect(await runSiteJob(integrationJob)).toMatchObject({
        status: "done",
        outcome: "held",
      });
      expect(await (await request(`${site.publicOrigin}/blog`)).text()).toBe(
        initialHtml
      );
      await promoteLatestDeployment(site);
      const tracked = await request(`${site.publicOrigin}/blog`);
      expect(tracked.status).toBe(200);
      const trackedHtml = await tracked.text();
      const tag = /<script[^>]*databuddy\.js[^>]*>/.exec(trackedHtml)?.[0];
      assert.ok(tag, "live page loads the Databuddy tracker");
      expect(tag).toContain('src="https://cdn.databuddy.cc/databuddy.js"');
      expect(tag).toContain(`data-client-id="${databuddy.clientId}"`);
      expect(tag).toContain('data-track-web-vitals="true"');
      expect(tag).toContain("data-skip-patterns=");
      const policy = tracked.headers.get("content-security-policy") ?? "";
      expect(policy).toMatch(/script-src [^;]*https:\/\/cdn\.databuddy\.cc/);
      expect(policy).toMatch(
        /connect-src [^;]*https:\/\/basket\.databuddy\.cc/
      );
      expect(
        await (await request(`${site.publicOrigin}/changelog`)).text()
      ).toContain("cdn.databuddy.cc/databuddy.js");
      await phase("Databuddy setting published directly on main");
      // On the deployment branch Publish commits straight to main.
      const skipped = {
        ...databuddy,
        skipPatterns: ["/drafts/**", "/internal/**"],
      };
      await saveSiteIntegration(site, {
        provider: "databuddy",
        settings: skipped,
        userId,
      });
      await expect(
        publishSiteDrafts(site, {
          message: "Skip internal pages",
          branch: featureBranch,
          userId,
        })
      ).rejects.toThrow("Feature branches save automatically");
      const direct = await publishSiteDrafts(site, {
        message: "Skip internal pages",
        userId,
      });
      expect(direct.pullRequestUrl).toBeNull();
      expect(direct.commitSha).toBe(await github.head());
      expect(await github.file("blog.json")).toContain("/internal/**");
      const directJob = await deployBranchHead(site, {
        trigger: "manual",
        userId,
        commitSha: direct.commitSha,
      });
      expect((await deliveryFor(direct.commitSha)).jobIds).toEqual([directJob]);
      // Another writer (a second deploy or Worker) updates the serving state
      // just before this activation writes it. The compare-and-set write
      // must lose, reread and keep both changes.
      const stateKey = SITE_R2_KEYS.state(site.id);
      const directDeployment = (await deploymentFor(directJob)).id;
      r2.raceNextConditionalWrite(
        (key, incoming) =>
          key === stateKey && incoming.includes(directDeployment),
        (text) => {
          const state = JSON.parse(text);
          state.previews["concurrent-writer"] = {
            deploymentId: first.id,
            visibility: "protected",
            sequence: 1,
            activatedAt: new Date().toISOString(),
            expiresAt: null,
          };
          return JSON.stringify(state);
        }
      );
      expect(await runSiteJob(directJob)).toMatchObject({
        status: "done",
        outcome: "live",
      });
      expect(r2.pendingRaces()).toBe(0);
      const raced = JSON.parse(r2.text(stateKey) ?? "null");
      expect(raced.previews["concurrent-writer"]).toMatchObject({
        deploymentId: first.id,
      });
      expect(raced.production.deploymentId).toBe(directDeployment);
      delete raced.previews["concurrent-writer"];
      await r2Put(stateKey, JSON.stringify(raced), {
        ifMatch: r2.objects.get(stateKey)?.etag,
      });
      const retagged = /<script[^>]*databuddy\.js[^>]*>/.exec(
        await (await request(`${site.publicOrigin}/blog`)).text()
      )?.[0];
      expect(retagged).toContain("/internal/**");
      await phase("custom domain: Vercel DNS, ownership, certificate");
      // A custom subdomain: Cloudflare for SaaS hostname, DNS set up through
      // the Vercel integration (records land in the emulated DNS), ownership
      // TXT and certificate verified, then the site rebuilds for its new
      // origin and serves on it. Removal restores the hosted alias.
      const aliasOrigin = site.publicOrigin;
      const hostname = `blog.${CUSTOM_DOMAIN_ZONE}`;
      const added = await addSiteDomain(site, {
        value: `https://${hostname}/`,
        kind: "subdomain",
      });
      expect(added).toMatchObject({ hostname, status: "pending" });
      expect(added.cloudflareHostnameId).toBeTruthy();
      const unverified = await refreshSiteDomain(site, added.id, userId);
      expect(unverified.domain.status).toBe("verifying");
      expect(unverified.rebuildJobId).toBeNull();
      // Half-finished DNS must not verify. First the user points the CNAME
      // at Notra and adds Cloudflare's TXT, but not Notra's ownership TXT.
      const records = (await requireSiteDomain(site.id, added.id))
        .verificationRecords;
      const routing = records.find((record) => record.type === "CNAME");
      const cloudflareTxt = records.find((record) =>
        record.name.startsWith("_cf-custom-hostname.")
      );
      const ownershipTxt = records.find((record) =>
        record.name.startsWith("_notra.")
      );
      assert.ok(routing && cloudflareTxt && ownershipTxt);
      const addRecord = (record: typeof routing) =>
        emulators.zone.add({ ...record, source: "user" });
      addRecord(routing);
      addRecord(cloudflareTxt);
      const withoutOwnership = await refreshSiteDomain(site, added.id, userId);
      expect(withoutOwnership.domain).toMatchObject({ status: "verifying" });
      expect(withoutOwnership.domain.lastError).toContain(
        "Notra ownership TXT"
      );
      // Then Notra's TXT is there but Cloudflare's is gone: the hostname and
      // its certificate are not active yet.
      emulators.zone.remove(cloudflareTxt.name, "TXT");
      addRecord(ownershipTxt);
      const withoutCertificate = await refreshSiteDomain(
        site,
        added.id,
        userId
      );
      expect(withoutCertificate.domain).toMatchObject({ status: "verifying" });
      expect(withoutCertificate.domain.lastError).toContain(
        "ownership TXT record not found"
      );
      expect(withoutCertificate.rebuildJobId).toBeNull();
      emulators.zone.remove(routing.name, "CNAME");
      emulators.zone.remove(ownershipTxt.name, "TXT");
      const setup = await dnsSetupForDomain({ site, domainId: added.id });
      assert.ok(
        setup.status === "ready" && setup.applyUrl,
        JSON.stringify(setup)
      );
      expect(setup.providerName).toBe("Vercel");
      // The user approves the integration; Vercel redirects to the dashboard
      // callback, mirrored from apps/dashboard/src/app/sites/vercel-dns.
      const claims = verifyVercelDnsState(
        new URL(setup.applyUrl).searchParams.get("state") ?? ""
      );
      expect(claims).toMatchObject({ siteId: site.id, domainId: added.id });
      const vercelConfig = getVercelDnsConfig();
      assert.ok(vercelConfig);
      const zone = await findVercelZone(hostname);
      expect(zone).toBe(CUSTOM_DOMAIN_ZONE);
      assert.ok(zone);
      const grant = await exchangeVercelCode(
        vercelConfig,
        emulators.vercel.approve()
      );
      try {
        await applyVercelDnsRecords({
          grant,
          zone,
          records: (await requireSiteDomain(site.id, added.id))
            .verificationRecords,
        });
      } finally {
        await removeVercelInstallation(grant);
      }
      expect(emulators.vercel.grants.every((entry) => entry.removed)).toBe(
        true
      );
      expect(emulators.zone.has(hostname, "CNAME", "cname.notra.test")).toBe(
        true
      );
      const verified = await refreshSiteDomain(site, added.id, userId);
      expect(verified.domain.status).toBe("active");
      assert.ok(verified.rebuildJobId);
      await runSettingsRebuild(verified.rebuildJobId);
      const onDomain = await getSite(site.id);
      assert.ok(onDomain);
      site = onDomain;
      expect(site.publicOrigin).toBe(`https://${hostname}`);
      const customPage = await request(`https://${hostname}/blog`);
      expect(customPage.status).toBe(200);
      expect(await customPage.text()).toContain(`"https://${hostname}/blog"`);
      const restoredJob = await removeSiteDomain(
        site,
        added.id,
        aliasOrigin,
        userId
      );
      assert.ok(restoredJob);
      await runSettingsRebuild(restoredJob);
      expect(emulators.cloudflare.hostnames.size).toBe(0);
      expect(r2.has(SITE_R2_KEYS.host(hostname))).toBe(false);
      expect((await request(`https://${hostname}/blog`)).status).toBe(404);
      const restored = await getSite(site.id);
      assert.ok(restored);
      site = restored;
      expect(site.publicOrigin).toBe(aliasOrigin);
      await phase("custom domain and open preview stay attached");
      const enabled = await updateSiteSettings(
        site,
        { previewsEnabled: true },
        userId
      );
      site = enabled.site;
      await runSyncJob(enabled.syncJobId);
      const docsHostname = `docs.${CUSTOM_DOMAIN_ZONE}`;
      const docs = await addSiteDomain(site, {
        value: `https://${docsHostname}/`,
        kind: "subdomain",
      });
      for (const record of (await requireSiteDomain(site.id, docs.id))
        .verificationRecords) {
        emulators.zone.add({ ...record, source: "user" });
      }
      const docsVerified = await refreshSiteDomain(site, docs.id, userId);
      expect(docsVerified.domain.status).toBe("active");
      assert.ok(docsVerified.rebuildJobId);
      await runSettingsRebuild(docsVerified.rebuildJobId);
      const onDocs = await getSite(site.id);
      assert.ok(onDocs);
      site = onDocs;
      expect(site.publicOrigin).toBe(`https://${docsHostname}`);
      expect(emulators.cloudflare.hostnames.size).toBe(1);
      expect(r2.has(SITE_R2_KEYS.host(docsHostname))).toBe(true);
      await github.createBranch("feature/attached");
      const attached = await createBranchPreview(
        site,
        "feature/attached",
        userId
      );
      expect(await runSiteJob(attached.jobId)).toMatchObject({
        status: "done",
        outcome: "live",
      });
      const attachedOrigin = new URL(
        (
          await previewAccessUrl({
            site,
            previewKey: attached.previewKey,
            kind: "share",
            userId,
            next: "/blog",
          })
        ).url
      ).origin;
      expect((await request(`${attachedOrigin}/blog`)).status).toBe(200);
      expect((await request(`https://${docsHostname}/blog`)).status).toBe(200);
      await phase("delete site");
      await r2Put("sites/unrelated-tenant/state.json", "preserve");
      const deploymentIds = (
        await db
          .select({ id: siteDeployments.id })
          .from(siteDeployments)
          .where(eq(siteDeployments.siteId, site.id))
      ).map((deployment) => deployment.id);
      expect(deploymentIds.length).toBeGreaterThan(0);
      await deleteSite(site);
      expect(emulators.cloudflare.hostnames.size).toBe(0);
      for (const hostname of [new URL(aliasOrigin).hostname, docsHostname]) {
        expect(r2.has(SITE_R2_KEYS.host(hostname))).toBe(false);
      }
      expect(await getSite(site.id)).toBeNull();
      for (const table of [
        siteJobs,
        siteDeployments,
        siteDrafts,
        siteBranchDrafts,
        siteDomains,
      ]) {
        expect(
          await db.select().from(table).where(eq(table.siteId, site.id))
        ).toHaveLength(0);
      }
      expect(
        await db
          .select()
          .from(siteBuildTelemetry)
          .where(inArray(siteBuildTelemetry.deploymentId, deploymentIds))
      ).toHaveLength(0);
      expect(
        [...r2.objects.keys()].filter((key) => key.includes(site.id))
      ).toHaveLength(0);
      expect(r2.has("sites/unrelated-tenant/state.json")).toBe(true);
      expect((await request(`https://${docsHostname}/blog`)).status).toBe(404);
      expect((await request(`${aliasOrigin}/blog`)).status).toBe(404);
      expect((await request(`${attachedOrigin}/blog`)).status).toBe(404);
      await expect(deleteSite(site)).rejects.toThrow("Site not found");
      await phase("Free plan: one site, one custom domain, badge forced");
      // A workspace Autumn has only on its auto-enabled free plan.
      await db.insert(organizations).values({
        id: freeOrganizationId,
        name: "Free fixture",
        slug: freeOrganizationId,
        createdAt: new Date(),
      });
      const freeProjectId = await seedSiteProject(freeOrganizationId);
      await db.insert(githubAppInstallations).values({
        id: `${freeOrganizationId}-installation`,
        organizationId: freeOrganizationId,
        createdByUserId: userId,
        installationId: "535353",
        accountId: "fixture-account",
        accountLogin: "fixture",
        accountAvatarUrl: "https://example.test/avatar",
        accountType: "User",
      });
      await db.insert(githubIntegrations).values({
        id: `${freeOrganizationId}-repository`,
        organizationId: freeOrganizationId,
        createdByUserId: userId,
        displayName: "Fixture repository",
        githubAppInstallationId: `${freeOrganizationId}-installation`,
        githubRepositoryId: String(github.repositoryId),
        owner: "fixture",
        repo: "acme",
        defaultBranch: "main",
      });
      const freeInput = {
        organizationId: freeOrganizationId,
        userId,
        projectId: freeProjectId,
        name: "Acme free",
        slug: `free-${crypto.randomUUID().slice(0, 8)}`,
        repositoryId: `${freeOrganizationId}-repository`,
        mounts: { blog: "/blog", changelog: "/changelog" },
      };
      const freeSite = (await createSite(freeInput)).site;
      freeSiteId = freeSite.id;
      const secondSite = await createSite({
        ...freeInput,
        name: "Acme free two",
        slug: `free-${crypto.randomUUID().slice(0, 8)}`,
      }).catch((error: unknown) => error);
      expect(secondSite).toBeInstanceOf(SitePlanLimitError);
      expect(secondSite).toMatchObject({ limit: "sites" });
      expect(
        await db
          .select({ id: sites.id })
          .from(sites)
          .where(eq(sites.organizationId, freeOrganizationId))
      ).toEqual([{ id: freeSite.id }]);
      await addSiteDomain(freeSite, {
        kind: "proxy",
        value: `free-blog.${CUSTOM_DOMAIN_ZONE}`,
      });
      const secondDomain = await addSiteDomain(freeSite, {
        kind: "proxy",
        value: `free-docs.${CUSTOM_DOMAIN_ZONE}`,
      }).catch((error: unknown) => error);
      expect(secondDomain).toBeInstanceOf(SitePlanLimitError);
      expect(secondDomain).toMatchObject({ limit: "domains" });
      expect(
        await db
          .select({ hostname: siteDomains.hostname })
          .from(siteDomains)
          .where(eq(siteDomains.siteId, freeSite.id))
      ).toEqual([{ hostname: `free-blog.${CUSTOM_DOMAIN_ZONE}` }]);
      const hiddenBadge = await updateSiteSettings(
        freeSite,
        { showBranding: false },
        userId
      ).catch((error: unknown) => error);
      expect(hiddenBadge).toBeInstanceOf(SitePlanLimitError);
      expect(hiddenBadge).toMatchObject({ limit: "branding" });
      // A setting stored before the limit, or under a paid plan the
      // workspace dropped, can't hide the badge either: the build forces it.
      await db
        .update(sites)
        .set({ showBranding: false })
        .where(eq(sites.id, freeSite.id));
      const forcedJobId = await deployBranchHead(
        { ...freeSite, showBranding: false },
        { trigger: "manual", userId }
      );
      expect(await runSiteJob(forcedJobId)).toMatchObject({
        status: "done",
        outcome: "live",
      });
      expect((await deploymentFor(forcedJobId)).target.branding).toBe(true);
      expect((await getSite(freeSite.id))?.showBranding).toBe(true);
      const freeHtml = await (
        await request(`${freeSite.publicOrigin}/blog`)
      ).text();
      expect(freeHtml).toContain("Notes on building calm software");
      expect(freeHtml).toContain("data-notra-badge");
      expect(freeHtml).toContain("Powered by <b>Notra</b>");
      // Upgrading lifts the caps without touching what already exists.
      emulators.autumn.setPlan(freeOrganizationId, "starter");
      await addSiteDomain(freeSite, {
        kind: "proxy",
        value: `free-docs.${CUSTOM_DOMAIN_ZONE}`,
      });
      const paidBadge = await updateSiteSettings(
        freeSite,
        { showBranding: false },
        userId
      );
      expect(paidBadge.site.showBranding).toBe(false);
      // A paid site can hide the badge, but visitors can still report abuse.
      const unbrandedJobId = await deployBranchHead(paidBadge.site, {
        trigger: "manual",
        userId,
      });
      expect(await runSiteJob(unbrandedJobId)).toMatchObject({
        status: "done",
        outcome: "live",
      });
      expect((await deploymentFor(unbrandedJobId)).target.branding).toBe(false);
      const unbrandedHtml = await (
        await request(`${freeSite.publicOrigin}/blog`)
      ).text();
      expect(unbrandedHtml).not.toContain("data-notra-badge");
      expect(unbrandedHtml).toContain(">Report abuse<");
      await phase("build and emulator accounting");
      // Every outbound call hit an emulated route.
      expect(
        emulators.summaries().flatMap((summary) => summary.unhandled)
      ).toEqual([]);
      expect(builds).toBe(15);
      expect(boxBuilds).toHaveLength(builds);
      if (emulators.box) {
        expectNoLiveBoxes();
        expect(emulators.box.boxes.size).toBe(builds);
        const allocations = emulators.box.requests.filter(
          (entry) => entry.path === "POST /v2/box/from-snapshot"
        );
        expect(
          allocations.filter((entry) => entry.status !== 200)
        ).toHaveLength(refusedAllocations.length);
        expect(refusedAllocations.length).toBeGreaterThan(1);
        for (const refused of refusedAllocations) {
          expect(refused.metrics).toMatchObject({
            sandboxId: null,
            cleanupSucceeded: false,
          });
        }
      } else {
        expect(refusedAllocations).toHaveLength(0);
      }
      const tarballs = github.requests.filter((entry) =>
        entry.path.startsWith("GET /repos/fixture/acme/tarball/")
      );
      expect(tarballs.length).toBeGreaterThanOrEqual(builds);
      expect(tarballs.every((entry) => entry.status === 302)).toBe(true);
      expect(
        github.requests.filter(
          (entry) =>
            entry.path.startsWith("GET /_codeload/") && entry.status === 200
        )
      ).toHaveLength(tarballs.length);
      for (const build of boxBuilds) {
        expect(build.metrics).toMatchObject({
          provider: "upstash",
          snapshotId: process.env.SITES_BUILDER_SNAPSHOT_ID,
          cleanupSucceeded: true,
        });
        assert.ok(build.metrics?.sandboxId);
        if (process.env.SITES_E2E_BOX_TOOLCHAIN_VERSION) {
          expect(build.toolchainVersion).toBe(
            process.env.SITES_E2E_BOX_TOOLCHAIN_VERSION
          );
        }
      }
      expect(boxBuilds.filter((build) => build.result?.ok)).toHaveLength(13);
      console.log(
        JSON.stringify({
          scope: "connected-postgres-compiler-publisher-worker-lifecycle",
          builder: realBox ? "upstash-box" : "emulated-box",
          builds,
          webhookDeliveries: deliveries.length,
          boxBuilds: boxBuilds.map((build) => ({
            sandboxId: build.metrics?.sandboxId,
            ok: build.result?.ok ?? false,
            durationMs: build.durationMs,
          })),
          emulators: emulators.summaries(),
          cleanup:
            "site rows/jobs/deployments/drafts/host and storage removed; unrelated namespace retained",
        })
      );
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      // Saving diagnostics must not keep the cleanup from running.
      try {
        await journal.finish(failure, deliveries.length, emulators.summaries());
      } finally {
        try {
          try {
            const createdSiteIds = [siteId, freeSiteId].filter(
              (id): id is string => id !== null
            );
            if (createdSiteIds.length > 0) {
              await db.delete(sites).where(inArray(sites.id, createdSiteIds));
            }
          } finally {
            try {
              await db
                .delete(organizations)
                .where(
                  inArray(organizations.id, [
                    organizationId,
                    freeOrganizationId,
                  ])
                );
            } finally {
              await db.delete(users).where(eq(users.id, userId));
            }
          }
        } finally {
          try {
            await emulators.close();
          } finally {
            try {
              await receiver.stop();
            } finally {
              await rm(directory, { recursive: true, force: true });
            }
          }
        }
      }
    }
  }, 890_000);
}
