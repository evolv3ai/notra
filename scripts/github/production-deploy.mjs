import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { requireReleaseCI } from "./utils/release-ci.mjs";
import { waitForReleaseGates } from "./utils/release-gates.mjs";

const projects = [
  {
    name: "notra",
    directory: "apps/dashboard",
    // Site builds use the snapshot env this deployment pins, so builder
    // changes redeploy the dashboard until it is live with them. apps/ui is
    // a workspace dependency (registry components and Tailwind sources).
    alsoBuilds: ["apps/sites-builder", "apps/ui"],
    productionAlias: "notra-notra.vercel.app",
    // apps/dashboard/scripts/vercel-build.sh runs db:migrate in production.
    migratesDatabase: true,
  },
  {
    name: "notra-web",
    directory: "apps/web",
    alsoBuilds: ["apps/ui"],
    productionAlias: "notra-web-notra.vercel.app",
  },
  {
    name: "notra-console",
    directory: "apps/console",
    productionAlias: "notra-console-notra.vercel.app",
    initialDeployment: {
      repositoryId: "1352247576",
      sha: "c868f26714dd4e7daa31dd0ff489485b72b21648",
    },
  },
  {
    name: "notra-ui",
    directory: "apps/ui",
    productionAlias: "notra-ui-notra.vercel.app",
  },
  {
    name: "notra-agent",
    directory: "apps/agent",
    productionAlias: "notra-agent-notra.vercel.app",
  },
  {
    name: "notra-onboarding-agent",
    directory: "apps/onboarding-agent",
    productionAlias: "notra-onboarding-agent-notra.vercel.app",
  },
];
const unkeyServices = [
  {
    name: "API",
    domain: "api.usenotra.com",
    directory: "apps/api",
  },
  {
    name: "ai-traffic-ingest",
    domain: "ingest.usenotra.com",
    directory: "apps/ai-traffic-ingest",
  },
  // The demo apps share their own database. Unkey has no pre-deploy hook, so
  // the release migrates it before the first demo build.
  {
    name: "demo-api",
    domain: "demo-api.usenotra.com",
    directory: "apps/api",
    demoDatabase: true,
  },
  {
    name: "demo-dashboard",
    domain: "demo.usenotra.com",
    directory: "apps/dashboard",
    alsoBuilds: ["apps/ui"],
    demoDatabase: true,
  },
];
// Site builds run the toolchain baked into an Upstash Box snapshot, not the
// dashboard's code. The dashboard must only go live with a snapshot built from
// the same commit, or new site settings fail validation inside the sandbox.
const sitesToolchain = {
  project: "notra",
  directory: "apps/sites-builder",
  snapshotKey: "SITES_BUILDER_SNAPSHOT_ID",
  versionKey: "SITES_BUILDER_TOOLCHAIN_VERSION",
};
const activeStates = new Set(["QUEUED", "INITIALIZING", "BUILDING"]);

function deploymentSha(deployment) {
  return deployment?.gitSource?.sha ?? deployment?.meta?.githubCommitSha;
}

export function hasBuildChanges(directory, previousSha, sha) {
  if (!previousSha) {
    return true;
  }
  if (previousSha === sha) {
    return false;
  }
  try {
    const files = execFileSync(
      "git",
      ["diff", "--no-renames", "--name-only", "-z", previousSha, sha, "--"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    ).split("\0");
    return files.some(
      (file) =>
        file.startsWith(`${directory}/`) ||
        file.startsWith("packages/") ||
        (file && !file.startsWith("apps/"))
    );
  } catch {
    return true;
  }
}

export function buildSitesToolchain(directory, liveVersion) {
  const resultFile = join(
    mkdtempSync(join(tmpdir(), "sites-toolchain-")),
    "result.json"
  );
  execFileSync(
    "bun",
    [
      "scripts/create-box-snapshot.ts",
      "--result-file",
      resultFile,
      ...(liveVersion ? ["--skip-version", liveVersion] : []),
    ],
    { cwd: directory, stdio: "inherit" }
  );
  return JSON.parse(readFileSync(resultFile, "utf8"));
}

export async function release({
  env = process.env,
  fetchImpl = fetch,
  buildChanged = hasBuildChanges,
  buildToolchain = buildSitesToolchain,
  execFile = execFileSync,
  sleep = delay,
  preflightOnly = false,
  waitForGates = waitForReleaseGates,
} = {}) {
  for (const key of [
    "GH_TOKEN",
    "VERCEL_TOKEN",
    "VERCEL_TEAM_ID",
    "GITHUB_SHA",
    "GITHUB_REPOSITORY_ID",
  ]) {
    if (!env[key]) {
      throw new Error(`${key} is required`);
    }
  }
  if (
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_REPOSITORY !== "usenotra/notra"
  ) {
    throw new Error("Production releases must run from usenotra/notra main");
  }
  if (env.DRY_RUN !== "true") {
    for (const key of [
      "RELEASE_DIR",
      "UPSTASH_BOX_API_KEY",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
    ]) {
      if (!env[key]) {
        throw new Error(`${key} is required to release the sites toolchain`);
      }
    }
  }
  // RELEASE_SHA is the commit selectReleaseCommit picked; it may trail main.
  const sha = env.RELEASE_SHA || env.GITHUB_SHA;
  const repositoryId = Number(env.GITHUB_REPOSITORY_ID);
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
    throw new Error("GITHUB_REPOSITORY_ID must be a positive safe integer");
  }
  const report = async (message) => {
    console.log(message);
    if (env.GITHUB_STEP_SUMMARY) {
      await appendFile(env.GITHUB_STEP_SUMMARY, `${message}\n\n`);
    }
  };
  // Reads are retried so a slow or flaky provider cannot fail a release;
  // creations run once so a lost response cannot start a second build.
  const send = async (label, url, init, { retry }) => {
    for (let attempt = 1; ; attempt += 1) {
      const canRetry = retry && attempt < 3;
      let response;
      try {
        response = await fetchImpl(url, {
          ...init,
          signal: AbortSignal.timeout(30_000),
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        if (!canRetry || error instanceof SyntaxError) {
          throw new Error(`${label}: ${error.message}`);
        }
        await report(`${label}: ${error.message}; retrying`);
        await sleep(5000 * attempt);
        continue;
      }
      if (canRetry && (response.status === 429 || response.status >= 500)) {
        await report(`${label}: HTTP ${response.status}; retrying`);
        await sleep(5000 * attempt);
        continue;
      }
      throw new Error(`${label}: HTTP ${response.status}`);
    }
  };
  const request = (provider, path, body) => {
    const github = provider === "github";
    const url = new URL(
      path,
      github ? "https://api.github.com" : "https://api.vercel.com"
    );
    if (!github) {
      url.searchParams.set("teamId", env.VERCEL_TEAM_ID);
    }
    return send(
      `${provider} ${url.pathname}`,
      url,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${github ? env.GH_TOKEN : env.VERCEL_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(github ? { "X-GitHub-Api-Version": "2022-11-28" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      { retry: !body }
    );
  };
  const assertAheadOf = async (name, previousSha) => {
    if (previousSha === sha) {
      return;
    }
    const comparison = await request(
      "github",
      `/repos/${env.GITHUB_REPOSITORY}/compare/${previousSha}...${sha}`
    );
    if (comparison.status !== "ahead") {
      throw new Error(
        `${name}: release commit is not ahead of production (${comparison.status}); no builds started`
      );
    }
  };

  await requireReleaseCI({ env, sha, fetchImpl, sleep, report });
  await report(`Release commit: \`${sha}\``);

  const unkey = async (path, body) => {
    const result = await send(
      `unkey ${path}`,
      `https://api.unkey.com/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UNKEY_DEPLOY_ROOT_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      { retry: path !== "v3/deployments.createDeployment" }
    );
    if (result.error || result.data === undefined) {
      throw new Error(`unkey ${path}: invalid response`);
    }
    return result.data;
  };
  const unkeyActiveStates = [
    "pending",
    "starting",
    "building",
    "deploying",
    "network",
    "finalizing",
    "awaiting_approval",
  ];
  const planUnkeyRelease = async (service) => {
    const domains = await unkey("v2/domains.listDomains", {
      search: service.domain,
      limit: 100,
    });
    const matches = domains.filter(
      (domain) => domain.domain === service.domain
    );
    if (matches.length !== 1 || matches[0].status !== "verified") {
      throw new Error(
        `unkey: cannot identify verified ${service.domain} domain`
      );
    }
    const domain = matches[0];
    const target = {
      project: domain.projectId,
      app: domain.appId,
      environment: domain.environmentId,
    };
    const app = await unkey("v2/apps.getApp", {
      project: target.project,
      app: target.app,
    });
    const environment = await unkey("v2/environments.getEnvironment", target);
    if (
      app.id !== target.app ||
      app.git?.repository !== env.GITHUB_REPOSITORY ||
      app.git?.defaultBranch !== "main" ||
      app.isRolledBack ||
      environment.id !== target.environment ||
      environment.kind !== "production"
    ) {
      throw new Error(
        `unkey: ${service.name} must track this repository's main in production without rollback`
      );
    }
    if (environment.build?.autoDeploy !== false) {
      if (env.DRY_RUN !== "true") {
        throw new Error(
          "unkey: disable production auto deploy before scheduled releases"
        );
      }
      await report(
        "unkey: disable production auto deploy before enabling real releases"
      );
    }
    const active = await unkey("v2/deployments.listDeployments", {
      ...target,
      status: unkeyActiveStates,
      limit: 1,
    });
    if (active.length > 0) {
      throw new Error(
        `unkey: ${service.name} already has an active production deployment`
      );
    }
    if (!app.currentDeploymentId) {
      throw new Error(
        `unkey: ${service.name} has no current production deployment`
      );
    }
    const live = await unkey("v2/deployments.getDeployment", {
      deploymentId: app.currentDeploymentId,
    });
    if (
      live.id !== app.currentDeploymentId ||
      live.status !== "ready" ||
      live.isCurrent !== true ||
      live.app !== app.slug ||
      live.environment !== environment.slug ||
      !live.git?.commitSha
    ) {
      throw new Error(
        `unkey: cannot identify ${service.name}'s live production commit`
      );
    }
    await assertAheadOf(`unkey ${service.name}`, live.git.commitSha);
    return {
      target,
      live,
      changed:
        live.git.commitSha !== sha &&
        [service.directory, ...(service.alsoBuilds ?? [])].some((directory) =>
          buildChanged(directory, live.git.commitSha, sha)
        ),
    };
  };
  const unkeyPlans = [];
  for (const service of unkeyServices) {
    if (env.UNKEY_DEPLOY_ROOT_KEY) {
      unkeyPlans.push({ service, ...(await planUnkeyRelease(service)) });
    } else {
      await report(
        `unkey: ${service.name} release disabled; configure UNKEY_DEPLOY_ROOT_KEY to enable`
      );
    }
  }

  const plans = [];
  for (const project of projects) {
    const active = await request(
      "vercel",
      `/v6/deployments?projectId=${project.name}&target=production&limit=1&state=QUEUED,INITIALIZING,BUILDING`
    );
    if (active.deployments.length > 0) {
      throw new Error(`${project.name} already has an active production build`);
    }
    const latest = await request("vercel", `/v9/projects/${project.name}`);
    if (latest.link?.productionBranch !== "main") {
      throw new Error(`${project.name} production branch must remain main`);
    }
    if (
      project.initialDeployment &&
      (Number(latest.link?.repoId) !== repositoryId ||
        latest.rootDirectory !== project.directory)
    ) {
      throw new Error(
        `${project.name}: connect the monorepo and set rootDirectory to ${project.directory} before releasing; no builds started`
      );
    }
    const alias = await request(
      "vercel",
      `/v4/aliases/${project.productionAlias}`
    );
    if (alias.projectId !== latest.id || !alias.deploymentId) {
      throw new Error(
        `${project.name}: production alias must identify this project's live deployment; no builds started`
      );
    }
    const production = await request(
      "vercel",
      `/v13/deployments/${alias.deploymentId}`
    );
    const previousSha = deploymentSha(production);
    if (production.readyState !== "READY" || !previousSha) {
      throw new Error(
        `${project.name}: cannot identify the current production commit; no builds started`
      );
    }
    const importingStandalone =
      project.initialDeployment?.sha === previousSha &&
      project.initialDeployment.repositoryId ===
        String(
          production.gitSource?.repoId ??
            production.meta?.githubCommitRepoId ??
            ""
        );
    if (!importingStandalone) {
      await assertAheadOf(project.name, previousSha);
    }
    const changed =
      importingStandalone ||
      [project.directory, ...(project.alsoBuilds ?? [])].some((directory) =>
        buildChanged(directory, previousSha, sha)
      );
    plans.push({ ...project, changed });
  }

  if (preflightOnly) {
    await report("Production preflight passed; no builds started");
    return;
  }

  if (env.DRY_RUN === "true") {
    await report("sites toolchain: snapshot is checked during real releases");
  } else {
    const { envs } = await request(
      "vercel",
      `/v10/projects/${sitesToolchain.project}/env`
    );
    const liveVar = envs.find(
      (variable) =>
        variable.key === sitesToolchain.versionKey &&
        variable.target?.includes("production")
    );
    const liveVersion = liveVar
      ? ((
          await request(
            "vercel",
            `/v1/projects/${sitesToolchain.project}/env/${liveVar.id}`
          )
        ).value ?? null)
      : null;
    const toolchain = buildToolchain(
      join(env.RELEASE_DIR, sitesToolchain.directory),
      liveVersion
    );
    if (toolchain.snapshotId) {
      const result = await request(
        "vercel",
        `/v10/projects/${sitesToolchain.project}/env?upsert=true`,
        [
          {
            key: sitesToolchain.snapshotKey,
            value: toolchain.snapshotId,
            type: "sensitive",
            target: ["production"],
          },
          {
            key: sitesToolchain.versionKey,
            value: toolchain.version,
            type: "plain",
            target: ["production"],
          },
        ]
      );
      if (result.failed?.length > 0) {
        throw new Error(
          `sites toolchain: could not update ${sitesToolchain.project} env (${result.failed.map((failure) => failure.error?.code).join(", ")}); no builds started`
        );
      }
      // The new snapshot only reaches site builds through a new deployment.
      const dashboard = plans.find(
        (project) => project.name === sitesToolchain.project
      );
      dashboard.changed = true;
      await report(
        `sites toolchain: snapshot ${toolchain.version} built, ${sitesToolchain.project} will redeploy`
      );
    } else {
      await report(`sites toolchain: ${toolchain.version} unchanged`);
    }
  }

  // Everything above only prepares; the first live change waits for the gates.
  if (env.DRY_RUN !== "true") {
    await waitForGates({ env, fetchImpl, sleep, report });
  }

  if (env.DRY_RUN === "true") {
    await report(`sites worker: would deploy ${sha}`);
  } else {
    execFile(
      "bun",
      [
        "run",
        "deploy",
        "--env",
        "",
        "--keep-vars",
        "--tag",
        `prod-${sha.slice(0, 12)}`,
        "--message",
        `Production release ${sha}`,
      ],
      {
        cwd: join(env.RELEASE_DIR, "apps/sites"),
        env,
        stdio: "inherit",
        timeout: 5 * 60_000,
      }
    );
    await report(`sites worker: deployed ${sha}`);
  }

  const failures = [];
  const builds = [];
  for (const project of plans) {
    if (!project.changed) {
      await report(
        `${project.name}: skipped, no build changes since production`
      );
    } else if (env.DRY_RUN === "true") {
      await report(`${project.name}: would deploy ${sha}`);
    } else {
      builds.push(project);
    }
  }
  const deployVercel = async (project) => {
    try {
      for (let buildAttempt = 0; buildAttempt < 2; buildAttempt += 1) {
        const deployment = await request(
          "vercel",
          `/v13/deployments${buildAttempt > 0 ? "?forceNew=1" : ""}`,
          {
            name: project.name,
            project: project.name,
            target: "production",
            gitSource: {
              type: "github",
              repoId: repositoryId,
              ref: "main",
              sha,
            },
          }
        );
        if (!deployment.id) {
          throw new Error(
            `${project.name}: deployment creation returned no ID`
          );
        }
        await report(`${project.name}: started https://${deployment.url}`);
        let completed = false;
        let retry = false;
        const deadline = Date.now() + 10 * 60_000;
        for (
          let attempt = 0;
          attempt < 120 && Date.now() < deadline;
          attempt += 1
        ) {
          const status = await request(
            "vercel",
            `/v13/deployments/${deployment.id}`
          );
          if (status.readyState === "READY") {
            if (deploymentSha(status) !== sha) {
              throw new Error(`${project.name}: built a different commit`);
            }
            let alias;
            try {
              alias = await request(
                "vercel",
                `/v4/aliases/${project.productionAlias}`
              );
            } catch (error) {
              await report(
                `${project.name}: waiting for production alias (${error.message})`
              );
            }
            if (alias?.deploymentId === deployment.id) {
              await report(`${project.name}: READY https://${status.url}`);
              completed = true;
              break;
            }
          } else if (!activeStates.has(status.readyState)) {
            if (
              status.readyState === "ERROR" &&
              status.errorCode === "out_of_memory" &&
              buildAttempt === 0
            ) {
              await report(
                `${project.name}: out_of_memory at https://${status.url ?? deployment.url}; retrying once at ${sha}`
              );
              await sleep(10_000);
              retry = true;
              break;
            }
            const reason = [status.errorCode, status.readyStateReason]
              .filter(Boolean)
              .join(": ");
            throw new Error(
              `${project.name}: deployment ended ${status.readyState}${reason ? ` (${reason})` : ""}`
            );
          }
          const remaining = deadline - Date.now();
          if (remaining > 0) {
            await sleep(Math.min(5000, remaining));
          }
        }
        if (retry) {
          continue;
        }
        if (!completed) {
          throw new Error(
            `${project.name}: deployment did not finish in 10 minutes`
          );
        }
        break;
      }
    } catch (error) {
      failures.push(error.message);
      await report(error.message);
    }
  };
  // Re-runs the planning checks (rollback, active deployment, ancestry) right
  // before a target changes, since planning happened before the gates.
  const refreshUnkeyPlan = async (plan) => {
    const refreshed = await planUnkeyRelease(plan.service);
    if (
      Object.keys(plan.target).some(
        (key) => plan.target[key] !== refreshed.target[key]
      )
    ) {
      throw new Error(
        "unkey: production domain target changed during Vercel releases"
      );
    }
    return { ...plan, ...refreshed };
  };
  let demoMigration;
  const migrateDemoDatabase = () => {
    demoMigration ??= (async () => {
      // Every demo app shares the database, so all of them must still pass
      // their checks before it moves ahead, including unchanged ones.
      await Promise.all(
        unkeyPlans
          .filter((plan) => plan.service.demoDatabase)
          .map(refreshUnkeyPlan)
      );
      execFile(
        "bun",
        ["packages/db/src/scripts/migrate.ts", "packages/db/migrations"],
        {
          cwd: env.RELEASE_DIR,
          env: {
            PATH: env.PATH,
            HOME: env.HOME,
            MIGRATION_DATABASE_URL: env.DEMO_MIGRATION_DATABASE_URL,
          },
          stdio: "inherit",
          timeout: 5 * 60_000,
        }
      );
      await report(`unkey: demo database migrated to ${sha}`);
    })();
    return demoMigration;
  };
  const unkeyDeployed = new Set();
  const deployUnkey = async (initialPlan) => {
    const { service } = initialPlan;
    let plan = initialPlan;
    if (env.DRY_RUN !== "true") {
      plan = await refreshUnkeyPlan(initialPlan);
    }
    if (!plan.changed) {
      await report(
        `unkey: skipped, no ${service.name} build changes since production`
      );
    } else if (service.demoDatabase && !env.DEMO_MIGRATION_DATABASE_URL) {
      // Demo code must never run ahead of its schema; the live demo keeps
      // its current build until the secret exists.
      await report(
        `unkey: skipped ${service.name}, configure DEMO_MIGRATION_DATABASE_URL to migrate the demo database`
      );
    } else if (env.DRY_RUN === "true") {
      await report(
        `unkey: would ${service.demoDatabase ? "migrate the demo database and " : ""}deploy ${service.name} at ${sha}`
      );
    } else {
      if (service.demoDatabase) {
        await migrateDemoDatabase();
      }
      const deployment = await unkey("v3/deployments.createDeployment", {
        ...plan.target,
        git: { branch: "main", commitSha: sha },
      });
      if (!deployment.deploymentId) {
        throw new Error("unkey: deployment creation returned no ID");
      }
      await report(
        `unkey: started ${service.name} deployment ${deployment.deploymentId}`
      );
      const deadline = Date.now() + 20 * 60_000;
      let completed = false;
      for (
        let attempt = 0;
        attempt < 240 && Date.now() < deadline;
        attempt += 1
      ) {
        const status = await unkey("v2/deployments.getDeployment", {
          deploymentId: deployment.deploymentId,
        });
        if (
          status.id !== deployment.deploymentId ||
          status.app !== plan.live.app ||
          status.project !== plan.live.project ||
          status.environment !== plan.live.environment
        ) {
          throw new Error(`unkey: ${service.name} deployment target changed`);
        }
        if (status.status === "ready") {
          if (status.git?.commitSha !== sha) {
            throw new Error(`unkey: ${service.name} built a different commit`);
          }
          if (status.isCurrent === true) {
            await report(`unkey: ${service.name} ready and current at ${sha}`);
            unkeyDeployed.add(service.name);
            completed = true;
            break;
          }
        } else if (!unkeyActiveStates.includes(status.status)) {
          throw new Error(
            `unkey: ${service.name} deployment ended ${status.status}`
          );
        }
        const remaining = deadline - Date.now();
        if (remaining > 0) {
          await sleep(Math.min(5000, remaining));
        }
      }
      if (!completed) {
        throw new Error(
          `unkey: ${service.name} deployment did not become current in 20 minutes`
        );
      }
    }
  };
  // The demo apps share a database that is migrated once before either builds;
  // after that every service ships independently.
  const releaseUnkey = () =>
    Promise.all(
      unkeyPlans.map(async (plan) => {
        try {
          await deployUnkey(plan);
        } catch (error) {
          failures.push(error.message);
          await report(error.message);
        }
      })
    );

  // The dashboard build migrates the production database, so everything else,
  // Unkey included, starts only once it is live; the rest then ships together.
  await Promise.all(
    builds.filter((project) => project.migratesDatabase).map(deployVercel)
  );
  const migrated = failures.length === 0;
  if (!migrated && unkeyPlans.length > 0) {
    await report("unkey: skipped, the dashboard deployment failed");
  }
  // The migrator runs synchronously, so it finishes before any concurrent
  // request is in flight instead of stalling their timeouts.
  if (
    migrated &&
    env.DRY_RUN !== "true" &&
    env.DEMO_MIGRATION_DATABASE_URL &&
    unkeyPlans.some((plan) => plan.service.demoDatabase && plan.changed)
  ) {
    // A failure is reported by each demo deployment, which then stops.
    await migrateDemoDatabase().catch(() => {});
  }
  await Promise.all([
    ...builds.filter((project) => !project.migratesDatabase).map(deployVercel),
    ...(migrated ? [releaseUnkey()] : []),
  ]);

  // Unkey's probe only proves the dashboard boots. Visitors also need the
  // migrated schema to be readable through the demo's own database role.
  // Unchanged demo builds are checked too, so a retry cannot skip a failure,
  // and an unrelated failed deployment does not hide one.
  if (
    migrated &&
    env.DRY_RUN !== "true" &&
    unkeyPlans.some((plan) => plan.service.demoDatabase)
  ) {
    try {
      const expectedSha = unkeyDeployed.has("demo-dashboard") ? sha : null;
      // A shallow response (demo mode off) has no table count.
      const passed = (health) =>
        health.ok === true &&
        health.tables > 0 &&
        (!expectedSha || health.commitSha === expectedSha);
      let health;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const response = await fetchImpl(
            "https://demo.usenotra.com/api/healthcheck?deep=1",
            { signal: AbortSignal.timeout(30_000) }
          );
          health = await response.json();
        } catch (error) {
          health = { ok: false, error: error.message };
        }
        if (passed(health) || attempt === 5) {
          break;
        }
        await sleep(10_000);
      }
      if (!passed(health)) {
        throw new Error(
          `demo: database check failed (${health.error ?? (health.tables > 0 ? `serving ${health.commitSha}` : "no deep check, is demo mode on?")})`
        );
      }
      await report(`demo: database check passed (${health.tables} tables)`);
    } catch (error) {
      failures.push(error.message);
      await report(error.message);
    }
  }
  if (failures.length > 0) {
    throw new Error([...new Set(failures)].join("\n"));
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await release({ preflightOnly: process.argv.includes("--preflight") });
}
