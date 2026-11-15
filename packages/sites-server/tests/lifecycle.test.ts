import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  organizations,
  siteDeployments,
  siteJobs,
  sites,
} from "@notra/db/schema";
import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import { hashBuildTarget } from "@notra/sites-core/utils/build-target";
import { createInitialServingState } from "@notra/sites-core/utils/serving-state";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { Effect } from "effect";

import type { SiteDeployment } from "../src/types/deployments";
import type { SiteJob } from "../src/types/jobs";
import type { PostPreviewSource, Site } from "../src/types/sites";
import { buildTargetForDeployment } from "../src/utils/urls";

if (process.env.NOTRA_SITES_LIFECYCLE_TEST_WORKER !== "1") {
  test("site lifecycle regressions with an isolated in-memory database adapter", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_SITES_LIFECYCLE_TEST_WORKER: "1" },
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  });
} else {
  const dialect = new PgDialect();
  let jobs: SiteJob[] = [];
  let deployments: SiteDeployment[] = [];
  let site: Site;
  let objects = new Map<string, string>();
  let onList = async () => {};
  let failNextCommit = false;
  const locks = new Map<string, Promise<void>>();

  const select = (selection?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      let condition: SQL | undefined;
      const rows = () => {
        const params = condition ? dialect.sqlToQuery(condition).params : [];
        if (table === sites) {
          return [site];
        }
        if (table === organizations) {
          return [{ id: site.organizationId }];
        }
        if (table === siteJobs && selection) {
          const running = jobs.filter(
            (job) =>
              job.status === "running" &&
              job.kind === "build" &&
              (job.leaseUntil?.getTime() ?? 0) > Date.now() &&
              !deployments.some(
                (deployment) =>
                  deployment.id === job.deploymentId &&
                  deployment.status === "skipped"
              )
          );
          const siteId = dialect.sqlToQuery(selection.site as SQL).params[0];
          return [
            {
              total: running.length,
              site: running.filter((job) => job.siteId === siteId).length,
            },
          ];
        }
        if (table === siteJobs) {
          return jobs.filter(
            (job) =>
              job.id === params[0] &&
              job.attempts < job.maxAttempts &&
              ((job.status === "pending" &&
                job.availableAt.getTime() <= Date.now()) ||
                (job.status === "running" &&
                  (job.leaseUntil?.getTime() ?? Infinity) < Date.now()))
          );
        }
        if (table === siteDeployments && params[1] === "production") {
          return deployments
            .filter(
              (deployment) =>
                deployment.siteId === params[0] &&
                deployment.kind === "production" &&
                deployment.status === "ready"
            )
            .sort((a, b) => b.generation - a.generation)
            .slice(0, 10);
        }
        if (
          table === siteDeployments &&
          selection?.id === siteDeployments.id &&
          condition &&
          dialect.sqlToQuery(condition).sql.includes('"finished_at"')
        ) {
          const cutoff = new Date(String(params.at(-1)));
          const id = params[1] === "queued" ? undefined : params[1];
          return deployments.filter(
            (deployment) =>
              (!id || deployment.id === id) &&
              (["queued", "building", "uploading"].includes(
                deployment.status
              ) ||
                (deployment.status === "ready" &&
                  (!deployment.finishedAt || deployment.finishedAt > cutoff)))
          );
        }
        if (table === siteDeployments && !selection) {
          return deployments.filter(
            (deployment) => deployment.id === params[0]
          );
        }
        return [];
      };
      const builder = {
        where: (where: SQL) => {
          condition = where;
          return builder;
        },
        orderBy: () => builder,
        for: (mode: string) => {
          if (table === organizations) {
            expect(mode).toBe("key share");
            return builder;
          }
          expect(mode).toBe("update");
          expect(table).toBe(sites);
          return builder;
        },
        limit: () => Promise.resolve(rows()),
        then: (resolve: (value: unknown[]) => unknown) =>
          Promise.resolve(rows()).then(resolve),
      };
      return builder;
    },
  });

  const update = (table: unknown) => ({
    set: (patch: Record<string, unknown>) => ({
      where: (condition: SQL) => {
        const query = dialect.sqlToQuery(condition);
        let updated: unknown[] | undefined;
        const apply = () => {
          if (updated) {
            return updated;
          }
          if (table === sites) {
            if (patch.lastGeneration instanceof Object) {
              site.lastGeneration += 1;
            } else {
              Object.assign(site, patch);
            }
            updated = [{ ...site }];
          } else if (table === siteJobs) {
            const target = jobs.find((job) => job.id === query.params[0]);
            const fenced = query.sql.includes('"attempts" =');
            const matches =
              target &&
              (!fenced ||
                (target.status === query.params[1] &&
                  target.attempts === query.params[2]));
            if (matches) {
              const values = { ...patch };
              if (typeof values.attempts === "object") {
                values.attempts = target.attempts + 1;
                values.leaseUntil = new Date(Date.now() + 900_000);
              }
              Object.assign(target, values);
            }
            updated = matches ? [{ ...target }] : [];
          } else if (patch.status === "expired") {
            const target = deployments.find(
              (deployment) => deployment.id === query.params[0]
            );
            if (target) {
              Object.assign(target, patch);
            }
            updated = target ? [target] : [];
          } else {
            const cutoff = query.sql.includes('"generation" <=')
              ? Number(query.params[2])
              : Infinity;
            const matches = deployments.filter(
              (deployment) =>
                deployment.siteId === query.params[0] &&
                deployment.previewKey === query.params[1] &&
                deployment.generation <= cutoff &&
                ["queued", "building", "uploading"].includes(deployment.status)
            );
            for (const deployment of matches) {
              Object.assign(deployment, patch);
            }
            updated = matches;
          }
          return updated;
        };
        return {
          returning: () => Promise.resolve(apply()),
          then: (resolve: (value: unknown[]) => unknown) =>
            Promise.resolve(apply()).then(resolve),
        };
      },
    }),
  });

  const db = {
    select,
    update,
    insert: () => ({
      values: async (values: SiteJob) => {
        jobs.push(values);
      },
    }),
    transaction: async <T>(run: (tx: unknown) => Promise<T>) => {
      const generationBefore = site.lastGeneration;
      const releases: Array<() => void> = [];
      const tx = {
        select,
        update,
        insert: db.insert,
        execute: async (condition: SQL) => {
          const query = dialect.sqlToQuery(condition);
          expect(query.sql).toContain("pg_advisory_xact_lock");
          const key = String(query.params[0] ?? "sites-build-capacity");
          const previous = locks.get(key);
          let release = () => {};
          const current = new Promise<void>((resolve) => {
            release = resolve;
          });
          locks.set(key, current);
          await previous;
          releases.push(release);
        },
      };
      try {
        const result = await run(tx);
        if (failNextCommit) {
          failNextCommit = false;
          site.lastGeneration = generationBefore;
          throw new Error("Storage transaction commit failed");
        }
        return result;
      } finally {
        for (const release of releases) {
          release();
        }
      }
    },
  };
  mock.module("@notra/db/drizzle", () => ({ db }));
  mock.module("@notra/geo-core/geo/ingest", () => ({
    buildGeoIngestSiteToken: () => "traffic-token",
  }));
  mock.module("../src/pipeline", () => ({
    failDeployment: async () => {},
    runDeploymentPipeline: async () => ({ kind: "live" }),
  }));
  const r2 = {
    r2GetText: async (key: string) =>
      objects.has(key) ? { text: objects.get(key), etag: "etag" } : null,
    r2Put: async (key: string, text: string) => {
      objects.set(key, text);
      return "etag";
    },
    r2DeleteKey: async (key: string) => {
      objects.delete(key);
    },
    r2DeleteKeyIfMatch: async (key: string, etag: string) => {
      expect(etag).toBe("etag");
      objects.delete(key);
    },
    r2ListPrefixes: async (root: string) => {
      if (root.startsWith("deployments/")) {
        await onList();
      }
      return [
        ...new Set(
          [...objects.keys()]
            .filter((key) => key.startsWith(root))
            .map((key) => `${root}${key.slice(root.length).split("/")[0]}/`)
        ),
      ];
    },
    r2DeletePrefix: async (prefix: string) => {
      for (const key of objects.keys()) {
        if (key.startsWith(prefix)) {
          objects.delete(key);
        }
      }
    },
  };
  mock.module("../src/r2", () => ({
    ...r2,
    r2GetTextEffect: (...args: Parameters<typeof r2.r2GetText>) =>
      Effect.tryPromise({
        try: () => r2.r2GetText(...args),
        catch: (error) => error,
      }),
    r2PutEffect: (...args: Parameters<typeof r2.r2Put>) =>
      Effect.tryPromise({
        try: () => r2.r2Put(...args),
        catch: (error) => error,
      }),
  }));

  const { claimSiteJob, completeSiteJob, failSiteJob } =
    await import("../src/jobs");
  const {
    enqueuePreviewRemoval,
    cancelPreviewBuilds,
    enqueueSiteDeployment,
    getProductionDeploymentHistory,
  } = await import("../src/deployments");
  const { redeploy, rollbackToDeployment } = await import("../src/deploy");
  const { createBranchPreview } = await import("../src/previews");
  const { runSiteJob } = await import("../src/runner");
  const { cleanupSiteDeployments } = await import("../src/cleanup");
  const { activateDeployment } = await import("../src/activation");
  const readyProduction = async (id: string, generation: number) => {
    const finishedAt = new Date(Date.now() - 2 * 86_400_000);
    const target = buildTargetForDeployment({
      site,
      kind: "production",
      previewKey: null,
    });
    const deployment: SiteDeployment = {
      id,
      siteId: site.id,
      organizationId: site.organizationId,
      kind: "production",
      previewKey: null,
      generation,
      githubRepositoryId: site.githubRepositoryId,
      repositoryOwner: site.repositoryOwner,
      repositoryName: site.repositoryName,
      trigger: "manual",
      status: "ready",
      branch: "main",
      commitSha: id,
      commitMessage: null,
      commitAuthor: null,
      pullRequestNumber: null,
      target,
      configHash: await hashBuildTarget(target),
      inputFingerprint: null,
      skipReason: null,
      smartDeploymentEvaluation: null,
      buildBudgetReserved: true,
      toolchainVersion: null,
      fileCount: 1,
      totalBytes: 2,
      buildDurationMs: 1,
      diagnostics: [],
      errorMessage: null,
      checkRunId: null,
      requestedByUserId: null,
      startedAt: finishedAt,
      finishedAt,
      createdAt: finishedAt,
      updatedAt: finishedAt,
    };
    deployments.push(deployment);
    objects.set(SITE_R2_KEYS.manifest(site.id, id), "{}");
    return deployment;
  };
  const makeJob = (id: string, siteId = "site1"): SiteJob => ({
    id,
    siteId,
    kind: "build",
    deploymentId: null,
    dedupeKey: null,
    payload: {},
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    availableAt: new Date(0),
    dispatchedAt: null,
    leaseUntil: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    jobs = [];
    deployments = [];
    locks.clear();
    site = {
      id: "site1",
      organizationId: "organization",
      slug: "example",
      name: "Example",
      publicOrigin: "https://example.test",
      mounts: { blog: "/blog" },
      showBranding: true,
      lastGeneration: 10,
      previewPassword: null,
      previewVisibility: "protected",
      status: "active",
      previewsEnabled: true,
    } as Site;
    objects = new Map([
      [
        SITE_R2_KEYS.state(site.id),
        JSON.stringify(
          createInitialServingState({
            siteId: site.id,
            slug: site.slug,
            now: new Date(),
          })
        ),
      ],
    ]);
    onList = async () => {};
    failNextCommit = false;
  });

  test("concurrent claims respect per-site and global capacity", async () => {
    jobs = Array.from({ length: 30 }, (_, index) => makeJob(`job${index}`));
    expect(
      (await Promise.all(jobs.map((job) => claimSiteJob(job.id)))).filter(
        Boolean
      )
    ).toHaveLength(2);
    jobs = Array.from({ length: 30 }, (_, index) =>
      makeJob(`job${index}`, `site${index}`)
    );
    expect(
      (await Promise.all(jobs.map((job) => claimSiteJob(job.id)))).filter(
        Boolean
      )
    ).toHaveLength(20);
  });

  test("workflow redelivery cannot reclaim an active or completed job", async () => {
    jobs = [makeJob("redelivered")];
    const claimed = await claimSiteJob("redelivered");
    expect(claimed).not.toBeNull();
    if (!claimed) {
      throw new Error("Expected claimed job");
    }

    expect(await runSiteJob("redelivered")).toEqual({ status: "skipped" });
    expect(jobs[0]?.status).toBe("running");
    expect(jobs[0]?.attempts).toBe(1);

    await completeSiteJob(claimed);
    expect(await runSiteJob("redelivered")).toEqual({ status: "skipped" });
    expect(jobs[0]?.status).toBe("done");
    expect(jobs[0]?.attempts).toBe(1);
  });

  test("expired claims obey capacity and an old attempt cannot complete or fail its replacement", async () => {
    jobs = [makeJob("job1")];
    const first = await claimSiteJob("job1");
    expect(first).not.toBeNull();
    const original = jobs[0];
    if (!original) {
      throw new Error("Expected original job");
    }
    original.leaseUntil = new Date(0);
    const replacement = await claimSiteJob("job1");
    expect(replacement?.attempts).toBe(2);
    if (!first || !replacement) {
      return;
    }
    await completeSiteJob(first);
    expect(await failSiteJob(first, new Error("old failure"), true)).toBe(
      "skipped"
    );
    expect(jobs[0]?.status).toBe("running");
    await completeSiteJob(replacement);
    expect(jobs[0]?.status).toBe("done");
    jobs = [makeJob("expired"), makeJob("running1"), makeJob("running2")];
    for (const job of jobs) {
      job.status = "running";
      job.attempts = 1;
      job.leaseUntil = new Date(Date.now() + 60_000);
    }
    const expired = jobs[0];
    if (!expired) {
      throw new Error("Expected expired job");
    }
    expired.leaseUntil = new Date(0);
    expect(await claimSiteJob("expired")).toBeNull();
    expect(jobs[0]?.status).toBe("pending");
  });

  test("preview removal fixes its generation when enqueued and only cancels older builds", async () => {
    const id = await enqueuePreviewRemoval(site.id, "pr-1");
    expect(jobs[0]?.payload).toEqual({ previewKey: "pr-1", generation: 11 });
    deployments = [
      {
        id: "old",
        siteId: site.id,
        previewKey: "pr-1",
        generation: 10,
        status: "building",
      },
      {
        id: "new",
        siteId: site.id,
        previewKey: "pr-1",
        generation: 12,
        status: "building",
      },
    ] as SiteDeployment[];
    await cancelPreviewBuilds(site.id, "pr-1", 11);
    expect(deployments.map((deployment) => deployment.status)).toEqual([
      "canceled",
      "building",
    ]);
    const queued = jobs[0];
    if (!queued) {
      throw new Error("Expected queued removal");
    }
    const removal = {
      ...makeJob(id),
      kind: "remove_preview" as const,
      payload: queued.payload,
    };
    jobs = [removal];
    site.lastGeneration = 12;
    await runSiteJob(id);
    expect(site.lastGeneration).toBe(12);
    expect(
      JSON.parse(objects.get(SITE_R2_KEYS.state(site.id)) ?? "{}")
        .removedPreviews["pr-1"]
    ).toBe(11);
  });

  test("cleanup wins the storage lock before rollback and activation cannot revive deleted files", async () => {
    const old = await readyProduction("old", 0);
    for (let generation = 1; generation <= 10; generation += 1) {
      await readyProduction(`retained-${generation}`, generation);
    }
    let listed = () => {};
    let resume = () => {};
    const started = new Promise<void>((resolve) => {
      listed = resolve;
    });
    const paused = new Promise<void>((resolve) => {
      resume = resolve;
    });
    onList = async () => {
      listed();
      await paused;
    };
    const cleanup = cleanupSiteDeployments(site.id);
    await started;
    const rollback = rollbackToDeployment(site, old.id).catch(
      (error: unknown) => error
    );
    const activation = activateDeployment(site, old);
    await Promise.resolve();
    expect(site.lastGeneration).toBe(11);
    expect(
      JSON.parse(objects.get(SITE_R2_KEYS.state(site.id)) ?? "{}").production
    ).toBeNull();
    resume();
    expect((await cleanup).deleted).toEqual([old.id]);
    expect(old.status).toBe("expired");
    expect(objects.has(SITE_R2_KEYS.manifest(site.id, old.id))).toBe(false);
    expect(await rollback).toMatchObject({
      message: expect.stringContaining("last ten"),
    });
    expect(await activation).toBe("not_live");
  });

  test("rollback wins the storage lock and cleanup retains the newly live deployment", async () => {
    const old = await readyProduction("old", 0);
    await readyProduction("latest", 1);
    await rollbackToDeployment(site, old.id);
    for (let generation = 2; generation <= 10; generation += 1) {
      await readyProduction(`retained-${generation}`, generation);
    }
    expect(
      (await getProductionDeploymentHistory(site.id)).map(
        (deployment) => deployment.id
      )
    ).not.toContain(old.id);
    expect((await cleanupSiteDeployments(site.id)).deleted).toEqual([]);
    expect(objects.has(SITE_R2_KEYS.manifest(site.id, old.id))).toBe(true);
  });

  test("rollback generation stays reserved if the storage transaction fails after publishing", async () => {
    const old = await readyProduction("old", 1);
    await readyProduction("latest", 2);
    failNextCommit = true;
    await expect(rollbackToDeployment(site, old.id)).rejects.toThrow(
      "Storage transaction commit failed"
    );
    expect(
      JSON.parse(objects.get(SITE_R2_KEYS.state(site.id)) ?? "{}").production
        .generation
    ).toBe(11);
    expect(site.lastGeneration).toBe(11);
    await enqueuePreviewRemoval(site.id, "pr-1");
    expect(jobs[0]?.payload).toEqual({ previewKey: "pr-1", generation: 12 });
  });

  test("cleanup retains an upload that began after its initial database snapshot", async () => {
    objects.set(SITE_R2_KEYS.manifest(site.id, "old"), "{}");
    onList = async () => {
      deployments.push({ id: "old", status: "uploading" } as SiteDeployment);
    };
    expect((await cleanupSiteDeployments(site.id)).deleted).toEqual([]);
    expect(objects.has(SITE_R2_KEYS.manifest(site.id, "old"))).toBe(true);
  });

  test("cleanup expires post previews and orphan sources without pruning live previews or production history", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const state = createInitialServingState({
      siteId: site.id,
      slug: site.slug,
      now: new Date(),
    });
    for (const [key, sourceExpiry, pointerExpiry, hasPointer] of [
      ["post-expired", past, past, true],
      ["post-active", future, future, true],
      ["post-orphan", past, past, false],
      ["post-extended", future, past, true],
    ] as const) {
      const deployment = await readyProduction(key, 5);
      deployment.kind = "preview";
      deployment.previewKey = key;
      objects.set(
        SITE_R2_KEYS.previewSource(site.id, key),
        JSON.stringify({
          generation: 4,
          pagePath: "/blog/example",
          files: [{ path: "blog/example.mdx", content: "c3ludGhldGlj" }],
          access: { lifetime: "1d", expiresAt: sourceExpiry, password: null },
        } satisfies PostPreviewSource)
      );
      if (hasPointer) {
        state.previews[key] = {
          deploymentId: key,
          sequence: 5,
          visibility: "protected",
          activatedAt: new Date().toISOString(),
          expiresAt: pointerExpiry,
        };
      }
    }
    const branch = await readyProduction("branch", 6);
    branch.kind = "preview";
    branch.previewKey = "pr-1";
    state.previews["pr-1"] = {
      deploymentId: branch.id,
      sequence: 6,
      visibility: "protected",
      activatedAt: new Date().toISOString(),
      expiresAt: null,
    };
    await readyProduction("production", 7);
    objects.set(SITE_R2_KEYS.state(site.id), JSON.stringify(state));

    expect((await cleanupSiteDeployments(site.id)).deleted.sort()).toEqual([
      "post-expired",
      "post-orphan",
    ]);
    const cleaned = JSON.parse(
      objects.get(SITE_R2_KEYS.state(site.id)) ?? "{}"
    );
    expect(Object.keys(cleaned.previews).sort()).toEqual([
      "post-active",
      "post-extended",
      "pr-1",
    ]);
    for (const key of ["post-expired", "post-orphan"]) {
      expect(objects.has(SITE_R2_KEYS.previewSource(site.id, key))).toBe(false);
      expect(objects.has(SITE_R2_KEYS.manifest(site.id, key))).toBe(false);
    }
    for (const key of [
      "post-active",
      "post-extended",
      "branch",
      "production",
    ]) {
      expect(objects.has(SITE_R2_KEYS.manifest(site.id, key))).toBe(true);
    }
    expect(
      objects.has(SITE_R2_KEYS.previewSource(site.id, "post-extended"))
    ).toBe(true);
    expect((await cleanupSiteDeployments(site.id)).deleted).toEqual([]);
  });

  test("post builds cannot activate missing or expired sources as non-expiring previews", async () => {
    const deployment = await readyProduction("post-build", 5);
    deployment.kind = "preview";
    deployment.previewKey = "post-example";
    expect(await activateDeployment(site, deployment)).toBe("not_live");
    objects.set(
      SITE_R2_KEYS.previewSource(site.id, deployment.previewKey),
      JSON.stringify({
        generation: 4,
        pagePath: "/blog/example",
        files: [],
        access: {
          lifetime: "1h",
          expiresAt: new Date(0).toISOString(),
          password: null,
        },
      } satisfies PostPreviewSource)
    );
    expect(await activateDeployment(site, deployment)).toBe("not_live");
    expect(
      JSON.parse(objects.get(SITE_R2_KEYS.state(site.id)) ?? "{}").previews
    ).toEqual({});
  });

  test("disabled previews reject creation, redeployment and central enqueue", async () => {
    site.previewsEnabled = false;
    const previous = {
      id: "old",
      siteId: site.id,
      kind: "preview",
      previewKey: "pr-1",
      branch: "feature",
      commitSha: "a".repeat(40),
      generation: 8,
      status: "ready",
    } as SiteDeployment;
    deployments.push(previous);
    await expect(
      createBranchPreview(site, "feature", "member")
    ).rejects.toThrow("Previews are turned off");
    await expect(redeploy(site, previous.id, "member")).rejects.toThrow(
      "Previews are turned off"
    );
    await expect(
      enqueueSiteDeployment({
        siteId: site.id,
        kind: "preview",
        previewKey: "pr-1",
        trigger: "pull_request",
        branch: "feature",
        commitSha: "a".repeat(40),
      })
    ).rejects.toThrow("Previews are turned off");
    expect(jobs).toHaveLength(0);
    expect(deployments).toEqual([previous]);
  });

  test("activation uses locked current policy rather than a stale enabled caller", async () => {
    const stale = {
      ...site,
      previewsEnabled: true,
      previewVisibility: "public" as const,
    };
    site.previewsEnabled = false;
    const preview = {
      id: "old",
      siteId: site.id,
      kind: "preview",
      previewKey: "pr-1",
      generation: 11,
    } as SiteDeployment;
    objects.set(SITE_R2_KEYS.manifest(site.id, preview.id), "{}");
    expect(await activateDeployment(stale, preview)).toBe("not_live");
    expect(
      JSON.parse(objects.get(SITE_R2_KEYS.state(site.id)) ?? "{}").previews
    ).toEqual({});
    site.previewsEnabled = true;
    expect(await activateDeployment(stale, preview)).toBe("live");
    expect(
      JSON.parse(objects.get(SITE_R2_KEYS.state(site.id)) ?? "{}").previews[
        "pr-1"
      ].visibility
    ).toBe("protected");
  });

  test("activation and rollback reject a newly suspended site despite an active caller", async () => {
    const production = await readyProduction("old", 1);
    await readyProduction("latest", 2);
    const stale = { ...site };
    site.status = "suspended";
    expect(await activateDeployment(stale, production)).toBe("not_live");
    await expect(rollbackToDeployment(stale, production.id)).rejects.toThrow(
      "Only active sites"
    );
    expect(
      JSON.parse(objects.get(SITE_R2_KEYS.state(site.id)) ?? "{}").production
    ).toBeNull();
  });
}
