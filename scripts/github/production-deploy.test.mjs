import assert from "node:assert/strict";
import { test } from "node:test";

import { release } from "./production-deploy.mjs";

function fixture({
  dryRun = false,
  preflightOnly = false,
  changed = () => true,
  override,
  api = false,
  demo = false,
  ingest = false,
  envOverrides = {},
  apiStatus = 200,
  liveToolchain = "toolchain-1",
  readBody = () => {},
  toolchain = { version: "toolchain-1", snapshotId: null },
  gates = async () => {},
  migrationError,
} = {}) {
  const sha = "a".repeat(40);
  const previousSha = "b".repeat(40);
  const calls = [];
  const directories = [];
  const published = new Map();
  const deploymentCounts = new Map();
  const toolchainBuilds = [];
  const events = [];
  const env = {
    GH_TOKEN: "test",
    VERCEL_TOKEN: "test",
    VERCEL_TEAM_ID: "test-team",
    GITHUB_SHA: sha,
    GITHUB_REPOSITORY_ID: "123",
    GITHUB_REPOSITORY: "usenotra/notra",
    GITHUB_REF: "refs/heads/main",
    DRY_RUN: String(dryRun),
    RELEASE_DIR: "/release",
    UPSTASH_BOX_API_KEY: "test-box",
    CLOUDFLARE_API_TOKEN: "test-cloudflare",
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    ...(api || demo || ingest
      ? {
          UNKEY_DEPLOY_ROOT_KEY: "test-unkey",
          DEMO_MIGRATION_DATABASE_URL: "postgresql://demo-owner@demo/neondb",
        }
      : {}),
    ...envOverrides,
  };
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    const body = options.body ? JSON.parse(options.body) : undefined;
    const call = { url, body, method: options.method };
    calls.push(call);
    let data = override?.(call);
    if (data === undefined) {
      if (url.hostname === "api.github.com") {
        data = url.pathname.includes("/compare/")
          ? { status: "ahead" }
          : {
              workflow_runs: [
                { head_sha: sha, status: "completed", conclusion: "success" },
              ],
            };
      } else if (url.hostname === "api.vercel.com") {
        assert.equal(url.searchParams.get("teamId"), env.VERCEL_TEAM_ID);
        if (url.pathname === "/v6/deployments") {
          data = { deployments: [] };
        } else if (url.pathname.startsWith("/v9/projects/")) {
          data = {
            id: url.pathname.split("/").at(-1),
            link: { productionBranch: "main", repoId: 123 },
            rootDirectory: url.pathname.endsWith("/notra-console")
              ? "apps/console"
              : undefined,
          };
        } else if (url.pathname.startsWith("/v4/aliases/")) {
          const project = url.pathname
            .split("/")
            .at(-1)
            .replace("-notra.vercel.app", "");
          data = {
            projectId: project,
            deploymentId: published.get(project) ?? `live-${project}`,
          };
        } else if (url.pathname === "/v10/projects/notra/env") {
          data =
            options.method === "POST"
              ? { failed: [] }
              : {
                  envs: liveToolchain
                    ? [
                        {
                          id: "env-version",
                          key: "SITES_BUILDER_TOOLCHAIN_VERSION",
                          target: ["production"],
                        },
                      ]
                    : [],
                };
        } else if (url.pathname === "/v1/projects/notra/env/env-version") {
          data = { value: liveToolchain };
        } else if (url.pathname === "/v13/deployments") {
          const count = (deploymentCounts.get(body.project) ?? 0) + 1;
          deploymentCounts.set(body.project, count);
          const id = `new-${body.project}${count > 1 ? `-${count}` : ""}`;
          published.set(body.project, id);
          data = { id, url: `${body.project}.vercel.app` };
        } else {
          data = {
            readyState: "READY",
            gitSource: {
              sha: url.pathname.includes("/new-") ? sha : previousSha,
            },
            url: "production.vercel.app",
          };
        }
      } else if (url.hostname === "demo.usenotra.com") {
        data = { ok: true, commitSha: sha, tables: 92 };
      } else if (url.hostname === "api.unkey.com") {
        let demoApp;
        if (body.search === "demo.usenotra.com") {
          demoApp = "demo-dashboard";
        } else if (body.search === "demo-api.usenotra.com") {
          demoApp = "demo-api";
        } else if (body.search === "ingest.usenotra.com") {
          demoApp = "ai-traffic-ingest";
        } else if (body.app === "app_ai-traffic-ingest") {
          demoApp = "ai-traffic-ingest";
        } else if (body.app?.startsWith("app_demo-")) {
          demoApp = body.app.slice(4);
        } else {
          demoApp =
            /^(?:live|new)-(demo-api|demo-dashboard|ai-traffic-ingest)$/.exec(
              body.deploymentId ?? ""
            )?.[1];
        }
        const suffix = demoApp ?? "test";
        const slug = demoApp ?? "api";
        assert.equal(options.headers.Authorization, "Bearer test-unkey");
        switch (url.pathname) {
          case "/v2/domains.listDomains":
            data = [
              {
                domain: body.search,
                status: "verified",
                projectId: "proj_test",
                appId: `app_${suffix}`,
                environmentId: "env_test",
              },
            ];
            break;
          case "/v2/apps.getApp":
            data = {
              id: `app_${suffix}`,
              slug,
              git: { repository: "usenotra/notra", defaultBranch: "main" },
              isRolledBack: false,
              currentDeploymentId: `live-${slug}`,
            };
            break;
          case "/v2/environments.getEnvironment":
            data = {
              id: "env_test",
              slug: "production",
              kind: "production",
              build: { autoDeploy: false },
            };
            break;
          case "/v2/deployments.listDeployments":
            data = [];
            break;
          case "/v3/deployments.createDeployment":
            data = { deploymentId: `new-${slug}` };
            break;
          case "/v2/deployments.getDeployment":
            data = {
              id: body.deploymentId,
              status: "ready",
              isCurrent: true,
              project: "notra",
              app: slug,
              environment: "production",
              git: {
                commitSha:
                  body.deploymentId === `new-${slug}` ? sha : previousSha,
              },
            };
            break;
          default:
            assert.fail(`Unexpected Unkey endpoint: ${url.pathname}`);
        }
      } else {
        assert.fail(`Unexpected host: ${url.hostname}`);
      }
    }
    const status =
      typeof apiStatus === "function" ? apiStatus(call) : apiStatus;
    return {
      ok: url.hostname !== "api.unkey.com" || (status >= 200 && status < 300),
      status,
      json: async () => {
        readBody(call);
        return url.hostname === "api.unkey.com" ? { data } : data;
      },
    };
  };
  return {
    sha,
    calls,
    directories,
    toolchainBuilds,
    events,
    run: () =>
      release({
        env,
        preflightOnly,
        fetchImpl,
        sleep: async () => {},
        execFile: (command, args) => {
          if (args.includes("deploy")) {
            events.push("worker");
            return;
          }
          events.push(`demo-migrate@${builds(calls).length}`);
          if (migrationError) {
            throw new Error(migrationError);
          }
        },
        waitForGates: async () => {
          events.push(`gates@${builds(calls).length}`);
          await gates();
        },
        buildToolchain: (directory, liveVersion) => {
          toolchainBuilds.push({ directory, liveVersion });
          events.push("toolchain");
          return toolchain;
        },
        buildChanged: (directory, previous, current) => {
          assert.equal(previous, previousSha);
          assert.equal(current, sha);
          directories.push(directory);
          return changed(directory);
        },
      }),
  };
}

function builds(calls) {
  return calls.filter(
    ({ url, body }) =>
      url.pathname === "/v13/deployments" ||
      url.pathname === "/v3/deployments.createDeployment" ||
      body?.query?.includes("serviceInstanceDeployV2")
  );
}

function toolchainUpserts(calls) {
  return calls.filter(
    ({ url, method }) =>
      url.pathname === "/v10/projects/notra/env" && method === "POST"
  );
}

test("the release prepares before the gates and changes nothing live until they pass", async () => {
  const { calls, run, events } = fixture({ demo: true });
  await run();
  assert.deepEqual(events.slice(0, 3), ["toolchain", "gates@0", "worker"]);
  assert.equal(builds(calls).length, 10);
});

test("a failed release gate stops the release before any build or live change", async () => {
  const { calls, run, events } = fixture({
    demo: true,
    liveToolchain: null,
    toolchain: { version: "toolchain-2", snapshotId: "snap-2" },
    gates: async () => {
      throw new Error("release gates: sites-e2e / Browser ended failure");
    },
  });
  await assert.rejects(run(), /Browser ended failure/);
  assert.deepEqual(events, ["toolchain", "gates@0"]);
  assert.equal(builds(calls).length, 0);
  // The new snapshot only reaches production through a later dashboard build.
  assert.equal(toolchainUpserts(calls).length, 1);
});

test("the demo database is migrated once, after the dashboard and before the parallel releases", async () => {
  const { calls, run, events } = fixture({ demo: true });
  await run();
  // Only the dashboard build exists when the synchronous migrator runs.
  assert.deepEqual(
    events.filter((event) => event.startsWith("demo-migrate")),
    ["demo-migrate@1"]
  );
  assert.equal(builds(calls).length, 10);
});

test("a failed demo migration stops both demo builds and nothing else", async () => {
  const { calls, run } = fixture({
    demo: true,
    migrationError: "migration exited 1",
  });
  await assert.rejects(run(), (error) => {
    assert.equal(error.message, "migration exited 1");
    return true;
  });
  const started = builds(calls).map(({ body }) => body.project ?? body.app);
  assert.ok(!started.includes("app_demo-api"));
  assert.ok(!started.includes("app_demo-dashboard"));
  assert.equal(started.length, 8);
});

test("a demo app rolled back after planning stops the demo migration and both demo builds", async () => {
  let dashboardReads = 0;
  const { calls, run, events } = fixture({
    demo: true,
    override: ({ url, body }) => {
      if (
        url.pathname === "/v2/apps.getApp" &&
        body.app === "app_demo-dashboard" &&
        ++dashboardReads > 1
      ) {
        return {
          id: body.app,
          slug: "demo-dashboard",
          git: { repository: "usenotra/notra", defaultBranch: "main" },
          isRolledBack: true,
          currentDeploymentId: "live-demo-dashboard",
        };
      }
    },
  });
  await assert.rejects(run(), /demo-dashboard must track this repository/);
  assert.ok(events.every((event) => !event.startsWith("demo-migrate")));
  const started = builds(calls).map(({ body }) => body.project ?? body.app);
  assert.ok(!started.includes("app_demo-api"));
  assert.ok(!started.includes("app_demo-dashboard"));
  assert.equal(started.length, 8);
});

test("dry runs do not wait for the release gates", async () => {
  const { run, events } = fixture({ dryRun: true });
  await run();
  assert.ok(events.every((event) => !event.startsWith("gates@")));
});

test("unchanged sites toolchain keeps the live snapshot", async () => {
  const { calls, run, toolchainBuilds } = fixture({ changed: () => false });
  await run();
  assert.deepEqual(toolchainBuilds, [
    { directory: "/release/apps/sites-builder", liveVersion: "toolchain-1" },
  ]);
  assert.equal(toolchainUpserts(calls).length, 0);
  assert.equal(builds(calls).length, 0);
});

test("new sites toolchain rolls the snapshot and redeploys the dashboard", async () => {
  const { calls, run, toolchainBuilds } = fixture({
    changed: () => false,
    liveToolchain: null,
    toolchain: { version: "toolchain-2", snapshotId: "snap-2" },
  });
  await run();
  assert.equal(toolchainBuilds[0].liveVersion, null);
  const [upsert] = toolchainUpserts(calls);
  assert.equal(upsert.url.searchParams.get("upsert"), "true");
  assert.deepEqual(
    upsert.body.map(({ key, value, target }) => [key, value, target]),
    [
      ["SITES_BUILDER_SNAPSHOT_ID", "snap-2", ["production"]],
      ["SITES_BUILDER_TOOLCHAIN_VERSION", "toolchain-2", ["production"]],
    ]
  );
  const started = builds(calls);
  assert.equal(started.length, 1);
  assert.equal(started[0].body.project, "notra");
  assert.ok(
    calls.indexOf(upsert) < calls.indexOf(started[0]),
    "env must be updated before the dashboard build starts"
  );
});

test("sites-builder changes redeploy the dashboard until it is live with them", async () => {
  // The snapshot was rolled by an earlier release whose dashboard build failed.
  const { calls, run } = fixture({
    changed: (directory) => directory === "apps/sites-builder",
  });
  await run();
  assert.equal(toolchainUpserts(calls).length, 0);
  assert.deepEqual(
    builds(calls).map(({ body }) => body.project),
    ["notra"]
  );
});

test("apps/ui changes redeploy every app that depends on it", async () => {
  const { calls, run } = fixture({
    demo: true,
    changed: (directory) => directory === "apps/ui",
  });
  await run();
  assert.deepEqual(
    builds(calls).map(({ url, body }) =>
      url.hostname === "api.unkey.com" ? body.app : body.project
    ),
    ["notra", "notra-web", "notra-ui", "app_demo-dashboard"]
  );
});

test("failed toolchain env update prevents every build", async () => {
  const { calls, run } = fixture({
    toolchain: { version: "toolchain-2", snapshotId: "snap-2" },
    override: ({ url, method }) =>
      url.pathname === "/v10/projects/notra/env" && method === "POST"
        ? { failed: [{ error: { code: "forbidden" } }] }
        : undefined,
  });
  await assert.rejects(run(), /could not update notra env \(forbidden\)/);
  assert.equal(builds(calls).length, 0);
});

test("all six Vercel projects deploy the pinned SHA", async () => {
  const { run, calls, sha, directories } = fixture();
  await run();
  const started = builds(calls);
  assert.equal(started.length, 6);
  assert.deepEqual(
    started.map(({ body }) => body.project),
    [
      "notra",
      "notra-web",
      "notra-console",
      "notra-ui",
      "notra-agent",
      "notra-onboarding-agent",
    ]
  );
  for (const { body } of started) {
    assert.deepEqual(body.gitSource, {
      type: "github",
      repoId: 123,
      ref: "main",
      sha,
    });
    assert.equal(body.target, "production");
  }
  assert.ok(directories.includes("apps/agent"));
  assert.ok(directories.includes("apps/onboarding-agent"));
});

test("the dashboard migrates first, then the other projects build together", async () => {
  const { run, calls } = fixture();
  await run();
  const index = (pathname, from = 0) =>
    calls.findIndex((call, i) => i >= from && call.url.pathname === pathname);
  const created = builds(calls).map((call) => calls.indexOf(call));
  const dashboardLive = index(
    "/v4/aliases/notra-notra.vercel.app",
    index("/v13/deployments/new-notra")
  );
  assert.ok(dashboardLive > created[0]);
  assert.ok(created.slice(1).every((i) => i > dashboardLive));
  assert.ok(
    created.at(-1) < index("/v13/deployments/new-notra-web"),
    "every other project starts before the first one is polled"
  );
});

test("Unkey waits for the dashboard migration, then ships alongside slower Vercel builds", async () => {
  let agentPolls = 0;
  const { run, calls } = fixture({
    api: true,
    override: ({ url }) =>
      url.pathname === "/v13/deployments/new-notra-agent" && ++agentPolls < 20
        ? { readyState: "BUILDING" }
        : undefined,
  });
  await run();
  // Aliases are also read while planning; only reads after a build count.
  const after = (pathname, from) =>
    calls.findIndex((call, i) => i > from && call.url.pathname === pathname);
  const firstUnkey = after("/v3/deployments.createDeployment", -1);
  const dashboardLive = after(
    "/v4/aliases/notra-notra.vercel.app",
    after("/v13/deployments/new-notra", -1)
  );
  const agentLive = after(
    "/v4/aliases/notra-agent-notra.vercel.app",
    calls.findIndex(({ body }) => body?.project === "notra-agent")
  );
  assert.ok(firstUnkey > dashboardLive);
  assert.ok(firstUnkey < agentLive, "Unkey must not wait for the agent build");
});

test("an unrelated failed deployment still runs the demo database check", async () => {
  const { run, calls } = fixture({
    demo: true,
    override: ({ url }) => {
      if (url.pathname === "/v13/deployments/new-notra-agent") {
        return { readyState: "ERROR", errorCode: "BUILD_FAILED" };
      }
      if (url.hostname === "demo.usenotra.com") {
        return { ok: false, error: "permission denied for table sites" };
      }
    },
  });
  await assert.rejects(run(), (error) => {
    assert.match(error.message, /notra-agent: deployment ended ERROR/);
    assert.match(
      error.message,
      /demo: database check failed \(permission denied/
    );
    return true;
  });
  assert.ok(calls.some(({ url }) => url.hostname === "demo.usenotra.com"));
});

test("a failed dashboard deployment starts no Unkey deployment", async () => {
  const { run, calls } = fixture({
    api: true,
    override: ({ url }) =>
      url.pathname === "/v13/deployments/new-notra"
        ? { readyState: "ERROR", errorCode: "BUILD_FAILED" }
        : undefined,
  });
  await assert.rejects(run(), /notra: deployment ended ERROR/);
  assert.ok(
    builds(calls).every(({ url }) => url.hostname === "api.vercel.com")
  );
  assert.equal(builds(calls).length, 6);
});

test("dry run validates every target without creating any builds", async () => {
  const { run, calls, directories, toolchainBuilds } = fixture({
    dryRun: true,
  });
  await run();
  assert.equal(builds(calls).length, 0);
  assert.equal(directories.length, 6);
  assert.equal(toolchainBuilds.length, 0);
});

for (const directory of ["apps/agent", "apps/onboarding-agent"]) {
  test(`${directory} changes deploy only its own project`, async () => {
    const { run, calls } = fixture({ changed: (app) => app === directory });
    await run();
    const started = builds(calls);
    assert.equal(started.length, 1);
    assert.equal(started[0].body.project, `notra-${directory.split("/")[1]}`);
  });
}

for (const project of ["notra-agent", "notra-onboarding-agent"]) {
  for (const guard of ["active", "alias", "commit", "branch"]) {
    test(`${project} fails closed on ${guard} before any builds`, async () => {
      const { run, calls } = fixture({
        override: ({ url }) => {
          if (
            guard === "active" &&
            url.searchParams.get("projectId") === project
          ) {
            return { deployments: [{ id: "active" }] };
          }
          if (
            guard === "alias" &&
            url.pathname === `/v4/aliases/${project}-notra.vercel.app`
          ) {
            return { projectId: "wrong-project", deploymentId: "live" };
          }
          if (
            guard === "commit" &&
            url.pathname === `/v13/deployments/live-${project}`
          ) {
            return { readyState: "READY" };
          }
          if (
            guard === "branch" &&
            url.pathname === `/v9/projects/${project}`
          ) {
            return { id: project, link: { productionBranch: "other" } };
          }
        },
      });
      await assert.rejects(run(), new RegExp(project));
      assert.equal(builds(calls).length, 0);
    });
  }
}

test("diverged production history prevents every build", async () => {
  const { run, calls } = fixture({
    override: ({ url }) =>
      url.pathname.includes("/compare/") ? { status: "diverged" } : undefined,
  });
  await assert.rejects(run(), /not ahead of production/);
  assert.equal(builds(calls).length, 0);
});

test("failed CI prevents all provider requests", async () => {
  const { run, calls } = fixture({
    override: ({ url }) =>
      url.hostname === "api.github.com" ? { workflow_runs: [] } : undefined,
  });
  await assert.rejects(run(), /has not passed/);
  assert.ok(calls.every(({ url }) => url.hostname === "api.github.com"));
});

test("failed agent deployment stops the release", async () => {
  const { run, calls } = fixture({
    override: ({ url }) =>
      url.pathname === "/v13/deployments/new-notra-agent"
        ? { readyState: "ERROR" }
        : undefined,
  });
  await assert.rejects(run(), /notra-agent: deployment ended ERROR/);
  assert.ok(
    builds(calls).every(({ url }) => url.hostname === "api.vercel.com")
  );
});

test("Vercel failures include the provider's error code and reason without retrying", async () => {
  const { run, calls } = fixture({
    override: ({ url }) =>
      url.pathname === "/v13/deployments/new-notra-agent"
        ? {
            readyState: "ERROR",
            errorCode: "git_info_fail",
            readyStateReason:
              "Git information retrieval failed for this deployment.",
          }
        : undefined,
  });
  await assert.rejects(
    run(),
    /git_info_fail: Git information retrieval failed/
  );
  assert.equal(
    builds(calls).filter(({ body }) => body.project === "notra-agent").length,
    1
  );
  assert.ok(
    builds(calls).every(({ url }) => url.hostname === "api.vercel.com")
  );
});

test("Vercel OOM retries only the failed project at the pinned SHA", async () => {
  const { run, calls, sha } = fixture({
    api: true,
    override: ({ url }) =>
      url.pathname === "/v13/deployments/new-notra-agent"
        ? { readyState: "ERROR", errorCode: "out_of_memory" }
        : undefined,
  });
  await run();
  const agentBuilds = builds(calls).filter(
    ({ body }) => body.project === "notra-agent"
  );
  assert.equal(agentBuilds.length, 2);
  assert.equal(agentBuilds[0].url.searchParams.has("forceNew"), false);
  assert.equal(agentBuilds[1].url.searchParams.get("forceNew"), "1");
  assert.deepEqual(agentBuilds[0].body, agentBuilds[1].body);
  assert.equal(agentBuilds[1].body.gitSource.sha, sha);
  assert.equal(builds(calls).length, 11);
  const retryReady = calls.findIndex(
    ({ url }) => url.pathname === "/v13/deployments/new-notra-agent-2"
  );
  const retryAlias = calls.findIndex(
    ({ url }, index) =>
      index > retryReady &&
      url.pathname === "/v4/aliases/notra-agent-notra.vercel.app"
  );
  assert.ok(retryAlias > retryReady);
});

for (const failure of ["oom", "build error", "wrong commit", "canceled"]) {
  test(`Vercel retry ${failure} fails closed without a third build`, async () => {
    const { run, calls } = fixture({
      api: true,
      override: ({ url }) => {
        if (url.pathname === "/v13/deployments/new-notra-agent") {
          return { readyState: "ERROR", errorCode: "out_of_memory" };
        }
        if (url.pathname === "/v13/deployments/new-notra-agent-2") {
          return failure === "wrong commit"
            ? { readyState: "READY", gitSource: { sha: "wrong" } }
            : {
                readyState: failure === "canceled" ? "CANCELED" : "ERROR",
                errorCode:
                  failure === "build error" ? "BUILD_FAILED" : "out_of_memory",
              };
        }
      },
    });
    await assert.rejects(
      run(),
      /notra-agent: (deployment ended|built a different commit)/
    );
    assert.equal(
      builds(calls).filter(({ body }) => body.project === "notra-agent").length,
      2
    );
    assert.ok(
      builds(calls).some(({ url }) => url.hostname === "api.unkey.com"),
      "Unkey ships once the dashboard is live, whatever the agent does"
    );
  });
}

for (const waiting of ["build", "alias"]) {
  test(`Vercel retry times out waiting for ${waiting} without a third build`, async () => {
    const { run, calls } = fixture({
      api: true,
      override: ({ url }) => {
        if (url.pathname === "/v13/deployments/new-notra-agent") {
          return { readyState: "ERROR", errorCode: "out_of_memory" };
        }
        if (
          waiting === "build" &&
          url.pathname === "/v13/deployments/new-notra-agent-2"
        ) {
          return { readyState: "BUILDING" };
        }
        if (
          waiting === "alias" &&
          url.pathname === "/v4/aliases/notra-agent-notra.vercel.app"
        ) {
          return { projectId: "notra-agent", deploymentId: "live-notra-agent" };
        }
      },
    });
    await assert.rejects(
      run(),
      /notra-agent: deployment did not finish in 10 minutes/
    );
    assert.equal(
      builds(calls).filter(({ body }) => body.project === "notra-agent").length,
      2
    );
    assert.ok(
      builds(calls).some(({ url }) => url.hostname === "api.unkey.com"),
      "Unkey ships once the dashboard is live, whatever the agent does"
    );
  });
}

test("Vercel creation errors are not retried", async () => {
  const { run, calls } = fixture({
    override: ({ url, body }) => {
      if (
        url.pathname === "/v13/deployments" &&
        body.project === "notra-agent"
      ) {
        throw new Error("connection lost during deployment creation");
      }
    },
  });
  await assert.rejects(run(), /connection lost during deployment creation/);
  assert.equal(
    builds(calls).filter(({ body }) => body.project === "notra-agent").length,
    1
  );
});

test("transient provider read timeouts are retried", async () => {
  let failures = 0;
  const { run, calls } = fixture({
    api: true,
    preflightOnly: true,
    override: ({ url }) => {
      if (
        (url.pathname === "/v9/projects/notra" ||
          url.pathname === "/v2/domains.listDomains") &&
        failures++ % 2 === 0
      ) {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }
    },
  });
  await run();
  assert.equal(
    calls.filter(({ url }) => url.pathname === "/v9/projects/notra").length,
    2
  );
});

test("persistent read timeouts name the failing request and start no builds", async () => {
  const { run, calls } = fixture({
    api: true,
    override: ({ url }) => {
      if (url.pathname === "/v2/domains.listDomains") {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }
    },
  });
  await assert.rejects(run(), {
    message: "unkey v2/domains.listDomains: The operation timed out.",
  });
  assert.equal(
    calls.filter(({ url }) => url.pathname === "/v2/domains.listDomains")
      .length,
    3
  );
  assert.equal(builds(calls).length, 0);
});

test("Unkey 5xx reads are retried", async () => {
  let failed = false;
  const { run } = fixture({
    api: true,
    preflightOnly: true,
    apiStatus: ({ url }) => {
      if (url.pathname === "/v2/apps.getApp" && !failed) {
        failed = true;
        return 503;
      }
      return 200;
    },
  });
  await run();
  assert.ok(failed);
});

for (const path of ["/v9/projects/notra", "/v2/apps.getApp"]) {
  for (const name of ["TimeoutError", "AbortError", "TypeError"]) {
    test(`${path} retries ${name} while reading JSON`, async () => {
      let reads = 0;
      const { run } = fixture({
        api: true,
        preflightOnly: true,
        readBody: ({ url }) => {
          if (url.pathname === path && ++reads === 1) {
            throw name === "TypeError"
              ? new TypeError("terminated")
              : new DOMException("body read failed", name);
          }
        },
      });
      await run();
      assert.ok(reads > 1);
    });
  }
}

for (const [path, error, attempts] of [
  ["/v9/projects/notra", new DOMException("body timeout", "TimeoutError"), 3],
  ["/v9/projects/notra", new SyntaxError("malformed JSON"), 1],
  ["/v13/deployments", new TypeError("terminated"), 1],
  ["/v3/deployments.createDeployment", new TypeError("terminated"), 1],
]) {
  test(`${path} labels ${error.name} body errors after ${attempts} attempt(s)`, async () => {
    let reads = 0;
    const { run } = fixture({
      api: true,
      readBody: ({ url }) => {
        if (url.pathname === path) {
          reads += 1;
          throw error;
        }
      },
    });
    await assert.rejects(run(), (failure) => {
      assert.ok(failure.message.includes(path.replace(/^\//, "")));
      assert.ok(failure.message.includes(error.message));
      return true;
    });
    // Creations run once per target: six Vercel projects and four
    // independent Unkey services.
    const creations = {
      "/v13/deployments": 6,
      "/v3/deployments.createDeployment": 4,
    };
    assert.equal(reads, creations[path] ?? attempts);
  });
}

test("Vercel cancellation is not retried even with an OOM error code", async () => {
  const { run, calls } = fixture({
    override: ({ url }) =>
      url.pathname === "/v13/deployments/new-notra-agent"
        ? { readyState: "CANCELED", errorCode: "out_of_memory" }
        : undefined,
  });
  await assert.rejects(run(), /deployment ended CANCELED/);
  assert.equal(
    builds(calls).filter(({ body }) => body.project === "notra-agent").length,
    1
  );
});

test("Unkey is opt-in and does not call its API without a deployment key", async () => {
  const { run, calls } = fixture();
  await run();
  assert.ok(calls.every(({ url }) => url.hostname !== "api.unkey.com"));
});

test("demo apps deploy to Unkey with the shared deployment key", async () => {
  const { run, calls, sha } = fixture({ demo: true });
  await run();
  const deployments = builds(calls).filter(
    ({ url }) => url.hostname === "api.unkey.com"
  );
  assert.deepEqual(
    deployments.map(({ body }) => body.app),
    ["app_test", "app_ai-traffic-ingest", "app_demo-api", "app_demo-dashboard"]
  );
  for (const { body } of deployments) {
    assert.deepEqual(body.git, { branch: "main", commitSha: sha });
  }
  assert.ok(calls.indexOf(deployments[0]) < calls.indexOf(deployments[1]));
  assert.ok(calls.indexOf(deployments[1]) < calls.indexOf(deployments[2]));
});

test("demo dry run validates both domains without starting builds", async () => {
  const { run, calls, toolchainBuilds } = fixture({ demo: true, dryRun: true });
  await run();
  assert.deepEqual(
    calls
      .filter(({ url }) => url.pathname === "/v2/domains.listDomains")
      .map(({ body }) => body.search),
    [
      "api.usenotra.com",
      "ingest.usenotra.com",
      "demo-api.usenotra.com",
      "demo.usenotra.com",
    ]
  );
  assert.equal(builds(calls).length, 0);
  assert.equal(toolchainUpserts(calls).length, 0);
  assert.equal(toolchainBuilds.length, 0);
});

test("demo preflight checks both targets before local builds and never falls back on permission failure", async () => {
  const { run, calls, toolchainBuilds } = fixture({
    demo: true,
    preflightOnly: true,
    apiStatus: ({ body }) => (body?.search === "demo.usenotra.com" ? 403 : 200),
  });
  await assert.rejects(run(), /unkey v2\/domains.listDomains: HTTP 403/);
  assert.equal(builds(calls).length, 0);
  assert.equal(toolchainBuilds.length, 0);
});

test("unchanged demo apps do not create Unkey deployments", async () => {
  const { run, calls } = fixture({ demo: true, changed: () => false });
  await run();
  assert.equal(builds(calls).length, 0);
});

for (const app of ["demo-api", "demo-dashboard"]) {
  test(`${app} invalid domain blocks all builds`, async () => {
    const { run, calls } = fixture({
      demo: true,
      override: ({ url, body }) =>
        url.pathname === "/v2/domains.listDomains" &&
        body.search ===
          (app === "demo-api" ? "demo-api.usenotra.com" : "demo.usenotra.com")
          ? []
          : undefined,
    });
    await assert.rejects(run(), /cannot identify verified/);
    assert.equal(builds(calls).length, 0);
  });

  test(`${app} wrong repository blocks all builds`, async () => {
    const { run, calls } = fixture({
      demo: true,
      override: ({ url, body }) =>
        url.pathname === "/v2/apps.getApp" && body.app === `app_${app}`
          ? {
              id: body.app,
              git: { repository: "other/repo", defaultBranch: "main" },
            }
          : undefined,
    });
    await assert.rejects(run(), /must track this repository/);
    assert.equal(builds(calls).length, 0);
  });

  test(`${app} failed deployment fails the release without holding back the other demo app`, async () => {
    const { run, calls, events } = fixture({
      demo: true,
      override: ({ url, body }) =>
        url.pathname === "/v2/deployments.getDeployment" &&
        body.deploymentId === `new-${app}`
          ? {
              id: body.deploymentId,
              app,
              project: "notra",
              environment: "production",
              status: "failed",
            }
          : undefined,
    });
    await assert.rejects(run(), new RegExp(`${app} deployment ended failed`));
    // The shared demo database is migrated once, before either demo build.
    assert.deepEqual(
      events.filter((event) => event.startsWith("demo-migrate")),
      ["demo-migrate@1"]
    );
    assert.deepEqual(
      builds(calls)
        .filter(({ url }) => url.hostname === "api.unkey.com")
        .map(({ body }) => body.app)
        .sort(),
      [
        "app_ai-traffic-ingest",
        "app_demo-api",
        "app_demo-dashboard",
        "app_test",
      ]
    );
  });
}

test("Unkey discovers the verified production domain and deploys the pinned commit", async () => {
  const { run, calls, sha, directories } = fixture({ api: true });
  await run();
  const deployment = calls.find(
    ({ url }) => url.pathname === "/v3/deployments.createDeployment"
  );
  assert.deepEqual(deployment.body, {
    project: "proj_test",
    app: "app_test",
    environment: "env_test",
    git: { branch: "main", commitSha: sha },
  });
  // The two demo apps are checked once more before their shared migration.
  assert.equal(directories.length, 16);
  assert.equal(
    directories.filter((directory) => directory === "apps/api").length,
    5
  );
});

test("Unkey dry run can inspect auto-deploy configuration without creating builds", async () => {
  const { run, calls } = fixture({
    api: true,
    dryRun: true,
    override: ({ url }) =>
      url.pathname === "/v2/environments.getEnvironment"
        ? {
            id: "env_test",
            slug: "production",
            kind: "production",
            build: { autoDeploy: true },
          }
        : undefined,
  });
  await run();
  assert.equal(builds(calls).length, 0);
});

test("unchanged API skips the Unkey build", async () => {
  const { run, calls } = fixture({
    api: true,
    changed: (app) => app !== "apps/api",
  });
  await run();
  assert.ok(
    calls.every(
      ({ url, body }) =>
        url.pathname !== "/v3/deployments.createDeployment" ||
        !["app_test", "app_demo-api"].includes(body.app)
    )
  );
});

for (const [name, path, data] of [
  ["missing domain", "/v2/domains.listDomains", []],
  [
    "unverified domain",
    "/v2/domains.listDomains",
    [{ domain: "api.usenotra.com", status: "pending" }],
  ],
  [
    "wrong repository",
    "/v2/apps.getApp",
    {
      id: "app_test",
      git: { repository: "other/repo", defaultBranch: "main" },
    },
  ],
  [
    "wrong branch",
    "/v2/apps.getApp",
    {
      id: "app_test",
      git: { repository: "usenotra/notra", defaultBranch: "develop" },
    },
  ],
  [
    "rollback",
    "/v2/apps.getApp",
    {
      id: "app_test",
      git: { repository: "usenotra/notra", defaultBranch: "main" },
      isRolledBack: true,
    },
  ],
  [
    "preview environment",
    "/v2/environments.getEnvironment",
    { id: "env_test", kind: "preview" },
  ],
  [
    "automatic production deployment",
    "/v2/environments.getEnvironment",
    { id: "env_test", kind: "production", build: { autoDeploy: true } },
  ],
  [
    "active deployment",
    "/v2/deployments.listDeployments",
    [{ id: "active-api" }],
  ],
  [
    "unidentified live commit",
    "/v2/deployments.getDeployment",
    {
      id: "live-api",
      status: "ready",
      isCurrent: true,
      app: "api",
      environment: "production",
    },
  ],
]) {
  test(`Unkey ${name} prevents all builds`, async () => {
    const { run, calls } = fixture({
      api: true,
      override: ({ url }) => (url.pathname === path ? data : undefined),
    });
    await assert.rejects(run(), /unkey/);
    assert.equal(builds(calls).length, 0);
  });
}

test("Unkey authentication failure prevents all builds without exposing credentials", async () => {
  const { run, calls } = fixture({ api: true, apiStatus: 403 });
  await assert.rejects(run(), {
    message: "unkey v2/domains.listDomains: HTTP 403",
  });
  assert.equal(builds(calls).length, 0);
});

test("diverged Unkey production history prevents all builds", async () => {
  const { run, calls } = fixture({
    api: true,
    override: ({ url }) =>
      url.pathname.includes("/compare/") ? { status: "diverged" } : undefined,
  });
  await assert.rejects(run(), /unkey API: release commit is not ahead/);
  assert.equal(builds(calls).length, 0);
});

test("Unkey creation failure is not retried", async () => {
  const { run, calls } = fixture({
    api: true,
    apiStatus: ({ url }) =>
      url.pathname === "/v3/deployments.createDeployment" ? 500 : 200,
  });
  await assert.rejects(
    run(),
    /unkey v3\/deployments.createDeployment: HTTP 500/
  );
  assert.deepEqual(
    calls
      .filter(({ url }) => url.pathname === "/v3/deployments.createDeployment")
      .map(({ body }) => body.app)
      .sort(),
    ["app_ai-traffic-ingest", "app_demo-api", "app_demo-dashboard", "app_test"]
  );
});

for (const [name, path, data] of [
  [
    "active deployment",
    "/v2/deployments.listDeployments",
    [{ id: "manual-api" }],
  ],
  [
    "rollback",
    "/v2/apps.getApp",
    {
      id: "app_test",
      git: { repository: "usenotra/notra", defaultBranch: "main" },
      isRolledBack: true,
    },
  ],
  [
    "auto deploy enabled",
    "/v2/environments.getEnvironment",
    { id: "env_test", kind: "production", build: { autoDeploy: true } },
  ],
  [
    "repository changed",
    "/v2/apps.getApp",
    {
      id: "app_test",
      git: { repository: "other/repo", defaultBranch: "main" },
    },
  ],
]) {
  test(`Unkey intervening ${name} blocks API creation after the dashboard`, async () => {
    let reads = 0;
    const { run, calls } = fixture({
      api: true,
      override: ({ url, body }) => {
        if (
          url.pathname === path &&
          (body.app === "app_test" || body.search === "api.usenotra.com") &&
          ++reads === 2
        ) {
          return data;
        }
      },
    });
    await assert.rejects(run(), /unkey/);
    assert.equal(
      calls.filter(({ url }) => url.pathname === "/v13/deployments").length,
      6
    );
    assert.ok(builds(calls).every(({ body }) => body.app !== "app_test"));
  });
}

test("Unkey intervening newer commit cannot be overwritten by the scheduled release", async () => {
  let reads = 0;
  const newer = "c".repeat(40);
  const { run, calls } = fixture({
    api: true,
    override: ({ url, body }) => {
      if (
        url.pathname === "/v2/deployments.getDeployment" &&
        body.deploymentId === "live-api" &&
        ++reads === 2
      ) {
        return {
          id: "live-api",
          status: "ready",
          isCurrent: true,
          app: "api",
          environment: "production",
          git: { commitSha: newer },
        };
      }
      if (url.pathname.includes(`/compare/${newer}`)) {
        return { status: "behind" };
      }
    },
  });
  await assert.rejects(run(), /unkey API: release commit is not ahead/);
  assert.ok(builds(calls).every(({ body }) => body.app !== "app_test"));
});

test("Unkey intervening release of the selected SHA skips duplicate API creation", async () => {
  let reads = 0;
  const { run, calls } = fixture({
    api: true,
    override: ({ url, body }) => {
      if (
        url.pathname === "/v2/deployments.getDeployment" &&
        body.deploymentId === "live-api" &&
        ++reads === 2
      ) {
        return {
          id: "live-api",
          status: "ready",
          isCurrent: true,
          app: "api",
          environment: "production",
          git: { commitSha: "a".repeat(40) },
        };
      }
    },
  });
  await run();
  assert.ok(
    calls.every(
      ({ url, body }) =>
        url.pathname !== "/v3/deployments.createDeployment" ||
        body.app !== "app_test"
    )
  );
  assert.ok(
    builds(calls).some(
      ({ url, body }) =>
        url.hostname === "api.unkey.com" && body.app === "app_ai-traffic-ingest"
    )
  );
});

for (const [name, update] of [
  ["failed", { status: "failed" }],
  ["wrong commit", { git: { commitSha: "c".repeat(40) } }],
  ["wrong target", { app: "other" }],
  ["never current", { isCurrent: false }],
]) {
  test(`Unkey deployment ${name} fails the release`, async () => {
    const { run, calls } = fixture({
      api: true,
      override: ({ url, body }) =>
        url.pathname === "/v2/deployments.getDeployment" &&
        body.deploymentId === "new-api"
          ? {
              id: "new-api",
              status: "ready",
              isCurrent: true,
              project: "notra",
              app: "api",
              environment: "production",
              git: { commitSha: "a".repeat(40) },
              ...update,
            }
          : undefined,
    });
    await assert.rejects(run(), /unkey/);
    assert.equal(
      calls.filter(
        ({ url, body }) =>
          url.pathname === "/v3/deployments.createDeployment" &&
          body.app === "app_test"
      ).length,
      1
    );
  });
}
