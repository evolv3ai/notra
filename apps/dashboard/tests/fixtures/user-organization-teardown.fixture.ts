import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";

import {
  autopilotNamespaceDeletions,
  members,
  organizations,
  users,
} from "@notra/db/schema";
import { setMemoryStore } from "@notra/memory/memory";
import { createInMemoryStore } from "@notra/memory/stores/in-memory";
import { call, os } from "@orpc/server";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS } from "../../src/constants/autopilot";
import { createORPCContext } from "../../src/lib/orpc/context";
import type { ORPCContext } from "../../src/types/orpc/context";
import { owner } from "../constants/user-organization-teardown";
import { createAutopilotSandbox } from "../utils/autopilot-sandbox";

const { db, postgres } = await createAutopilotSandbox();
afterAll(() => postgres.close());
const memory = new Set<string>();
const workosEvents: string[] = [];
let failTeardown = false;
let failMemoryCleanup = false;
let failWorkos = false;
let stalledRequest = 0;
let expireCleanupBudget = () => {};
let abortedRequests = 0;
let activeRequests = 0;
const teardown = mock(async () => {
  if (failTeardown) {
    throw new Error("Synthetic teardown failure");
  }
});
const deleteNamespace = mock(
  async (organizationId: string, signal?: AbortSignal) => {
    if (
      stalledRequest > 0 &&
      deleteNamespace.mock.calls.length === stalledRequest
    ) {
      if (!signal) {
        throw new Error("Cleanup must provide a deadline signal");
      }
      activeRequests += 1;
      const stalled = new Promise<void>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            abortedRequests += 1;
            activeRequests -= 1;
            reject(signal.reason);
          },
          { once: true }
        );
      });
      expireCleanupBudget();
      return stalled;
    }
    if (failMemoryCleanup) {
      throw new Error("Synthetic memory cleanup failure");
    }
    memory.delete(organizationId);
  }
);
setMemoryStore({ ...createInMemoryStore(), deleteRepo: deleteNamespace });
afterAll(() => setMemoryStore(null));

mock.module("@notra/db/drizzle", () => ({ db }));
mock.module("@notra/sites-server/organization", () => ({
  deleteOrganizationSites: teardown,
}));
mock.module("@notra/ai/utils/server-log", () => ({ logError: mock() }));
mock.module("@/lib/orpc/base", () => ({
  authorizedProcedure: os
    .$context<Pick<ORPCContext, "headers">>()
    .use(({ next }) => next({ context: { user: { id: "synthetic-user" } } })),
}));
mock.module("@/lib/i18n/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
mock.module("@/lib/organizations/workos-sync", () => ({
  deleteOrganizationFromWorkOS: () =>
    failWorkos
      ? Effect.fail(new Error("Synthetic WorkOS failure"))
      : Effect.void,
  removeMembershipFromWorkOS: () => {
    workosEvents.push("remove");
    return Effect.void;
  },
  updateMembershipRoleInWorkOS: () => {
    workosEvents.push("promote");
    return Effect.void;
  },
}));
mock.module("@/lib/billing/delete-autumn-customer", () => ({
  deleteAutumnCustomer: async () => {},
}));
mock.module("@/lib/sites/preview-revocation", () => ({
  revokeSitePreviewAccess: async () => {},
}));
mock.module("@/lib/upload/cleanup", () => ({
  deleteOrganizationChatFiles: async () => {},
  deleteOrganizationFiles: async () => {},
  deleteUserFiles: async () => {},
}));
mock.module("../../src/lib/orpc/routers/user-account", () => ({
  userAccountRouter: {},
  userSecurityRouter: {},
}));
const runDueAutopilots = mock(async () => {
  expect(activeRequests).toBe(0);
  return { checked: 0, started: 0, failed: 0 };
});
mock.module("@/lib/autopilot/schedule", () => ({ runDueAutopilots }));

const { userRouter } = await import("../../src/lib/orpc/routers/user");
const { cleanupAutopilotNamespaces } =
  await import("../../src/lib/autopilot/namespace-deletions");
const { GET } = await import("../../src/app/api/cron/autopilot/route");
const context = await createORPCContext({ headers: new Headers() });

await postgres.exec(
  `CREATE FUNCTION fail_deletion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic DB failure'; END $$`
);
beforeEach(async () => {
  await postgres.exec(`DROP TRIGGER IF EXISTS fail_cascade ON organizations;
    DROP TRIGGER IF EXISTS fail_ack ON autopilot_namespace_deletions;
    TRUNCATE organizations, users, autopilot_namespace_deletions CASCADE;`);
  await db.insert(users).values([
    {
      id: "synthetic-user",
      name: "Synthetic User",
      email: "synthetic@example.test",
    },
    { id: "next-owner", name: "Next Owner", email: "next@example.test" },
  ]);
  await db.insert(organizations).values(
    ["workspace", "other"].map((id) => ({
      id,
      name: id,
      slug: id,
      createdAt: new Date(),
    }))
  );
  await db.insert(members).values([
    {
      ...owner,
      organizationId: "workspace",
      userId: "synthetic-user",
      createdAt: new Date(),
    },
    {
      id: "other-membership",
      organizationId: "other",
      userId: "synthetic-user",
      role: "owner",
      createdAt: new Date(),
    },
  ]);
  memory.clear();
  memory.add("workspace");
  memory.add("other");
  workosEvents.length = 0;
  teardown.mockClear();
  deleteNamespace.mockClear();
  failTeardown = false;
  failMemoryCleanup = false;
  failWorkos = false;
  stalledRequest = 0;
  abortedRequests = 0;
  activeRequests = 0;
  runDueAutopilots.mockClear();
});

async function deleteWorkspace(route: string) {
  return route === "normal"
    ? await call(
        userRouter.membership.applyAction,
        { organizationId: "workspace", action: "delete" },
        { context }
      )
    : await call(
        userRouter.deleteWithTransfers,
        { transfers: [{ orgId: "workspace", action: "delete" }] },
        { context }
      );
}

test.each(["normal", "transfers"])(
  "%s rejects nonmembers and nonowners without touching memory",
  async (route) => {
    await db
      .update(members)
      .set({ role: "admin" })
      .where(eq(members.id, owner.id));
    await expect(deleteWorkspace(route)).rejects.toThrow();
    await db.delete(members).where(eq(members.id, owner.id));
    await expect(deleteWorkspace(route)).rejects.toThrow();
    expect(teardown).not.toHaveBeenCalled();
    expect(deleteNamespace).not.toHaveBeenCalled();
    expect(await db.select().from(autopilotNamespaceDeletions)).toEqual([]);
  }
);

test("normal deletion preserves the last workspace", async () => {
  await db.delete(members).where(eq(members.organizationId, "other"));
  await expect(deleteWorkspace("normal")).rejects.toThrow();
  expect(teardown).not.toHaveBeenCalled();
});

test.each(["normal", "transfers"])(
  "%s site and DB failures preserve active workspace memory with no cleanup queued",
  async (route) => {
    failTeardown = true;
    await expect(deleteWorkspace(route)).rejects.toThrow(
      "Synthetic teardown failure"
    );
    failTeardown = false;
    await postgres.exec(
      "CREATE TRIGGER fail_cascade BEFORE DELETE ON organizations FOR EACH ROW EXECUTE FUNCTION fail_deletion()"
    );
    await expect(deleteWorkspace(route)).rejects.toThrow();
    expect(
      await db.query.organizations.findFirst({
        where: eq(organizations.id, "workspace"),
      })
    ).toBeDefined();
    expect(await db.select().from(autopilotNamespaceDeletions)).toEqual([]);
    expect(await cleanupAutopilotNamespaces()).toEqual({
      checked: 0,
      failed: 0,
    });
    expect(memory.has("workspace")).toBe(true);
    expect(deleteNamespace).not.toHaveBeenCalled();
    await postgres.exec("DROP TRIGGER fail_cascade ON organizations");
    await deleteWorkspace(route);
    await cleanupAutopilotNamespaces();
    expect(memory.has("workspace")).toBe(false);
  }
);

test.each(["normal", "transfers"])(
  "%s commits deletion and retries remote failures independently of user membership",
  async (route) => {
    await deleteWorkspace(route);
    expect(
      await db.query.organizations.findFirst({
        where: eq(organizations.id, "workspace"),
      })
    ).toBeUndefined();
    expect(deleteNamespace).not.toHaveBeenCalled();
    expect(memory.has("workspace")).toBe(true);
    expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
    await expect(deleteWorkspace(route)).rejects.toThrow();
    await db.delete(users).where(eq(users.id, "synthetic-user"));
    failMemoryCleanup = true;
    const now = new Date();
    expect(await cleanupAutopilotNamespaces(now)).toEqual({
      checked: 1,
      failed: 1,
    });
    expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
    expect(await cleanupAutopilotNamespaces(now)).toEqual({
      checked: 0,
      failed: 0,
    });
    failMemoryCleanup = false;
    expect(
      await cleanupAutopilotNamespaces(new Date(now.getTime() + 300_001))
    ).toEqual({ checked: 1, failed: 0 });
    expect(memory.has("workspace")).toBe(false);
    expect(memory.has("other")).toBe(true);
    expect(await db.select().from(autopilotNamespaceDeletions)).toEqual([]);
    expect(await cleanupAutopilotNamespaces()).toEqual({
      checked: 0,
      failed: 0,
    });
  }
);

test.each(["normal", "transfers"])(
  "%s retries safely after remote success but failed DB acknowledgement",
  async (route) => {
    await deleteWorkspace(route);
    await postgres.exec(
      "CREATE TRIGGER fail_ack BEFORE DELETE ON autopilot_namespace_deletions FOR EACH ROW EXECUTE FUNCTION fail_deletion()"
    );
    expect(await cleanupAutopilotNamespaces()).toEqual({
      checked: 1,
      failed: 1,
    });
    expect(memory.has("workspace")).toBe(false);
    expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
    await postgres.exec(
      "DROP TRIGGER fail_ack ON autopilot_namespace_deletions"
    );
    expect(await cleanupAutopilotNamespaces()).toEqual({
      checked: 1,
      failed: 0,
    });
    expect(deleteNamespace).toHaveBeenCalledTimes(2);
  }
);

test.each(["normal", "transfers"])(
  "%s retains cleanup if later WorkOS processing fails",
  async (route) => {
    failWorkos = true;
    await expect(deleteWorkspace(route)).rejects.toThrow();
    expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
    await cleanupAutopilotNamespaces();
    expect(memory.has("workspace")).toBe(false);
  }
);

test("account deletion preserves transferred workspace memory and ownership synchronization", async () => {
  await db.insert(members).values({
    id: "next-membership",
    organizationId: "workspace",
    userId: "next-owner",
    role: "admin",
    createdAt: new Date(),
  });
  await call(
    userRouter.deleteWithTransfers,
    {
      transfers: [
        { orgId: "workspace", action: "transfer" },
        { orgId: "other", action: "delete" },
      ],
    },
    { context }
  );
  expect(
    (
      await db.query.members.findFirst({
        where: eq(members.id, "next-membership"),
      })
    )?.role
  ).toBe("owner");
  expect(workosEvents).toEqual(["promote", "remove"]);
  await cleanupAutopilotNamespaces();
  expect(memory.has("workspace")).toBe(true);
  expect(memory.has("other")).toBe(false);
});

test("account deletion retains earlier cleanup if a later organization action fails", async () => {
  await expect(
    call(
      userRouter.deleteWithTransfers,
      {
        transfers: [
          { orgId: "workspace", action: "delete" },
          { orgId: "missing", action: "transfer" },
        ],
      },
      { context }
    )
  ).rejects.toThrow("notOwner");
  expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
  await cleanupAutopilotNamespaces();
  expect(memory.has("workspace")).toBe(false);
  expect(memory.has("other")).toBe(true);
});

test("authenticated cron retries the outbox even without any active Autopilots", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  await deleteWorkspace("normal");
  expect(
    (await GET(new Request("https://example.test/api/cron/autopilot"))).status
  ).toBe(401);
  expect(deleteNamespace).not.toHaveBeenCalled();
  const response = await GET(
    new Request("https://example.test/api/cron/autopilot", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    cleanup: { checked: 1, failed: 0 },
  });
  expect(memory.has("workspace")).toBe(false);
});

test("cron reports remote cleanup failure and retries on the next due sweep", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  await deleteWorkspace("normal");
  failMemoryCleanup = true;
  const request = () =>
    new Request("https://example.test/api/cron/autopilot", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    });
  expect((await GET(request())).status).toBe(500);
  expect(memory.has("workspace")).toBe(true);
  await db
    .update(autopilotNamespaceDeletions)
    .set({ nextAttemptAt: new Date(0) });
  failMemoryCleanup = false;
  expect((await GET(request())).status).toBe(200);
  expect(memory.has("workspace")).toBe(false);
});

test("one overall cleanup deadline aborts a stalled deletion, preserves partial progress and starts daily runs", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  const now = new Date();
  await db.insert(autopilotNamespaceDeletions).values(
    Array.from({ length: 5 }, (_, index) => ({
      organizationId: `deleted-${index}`,
      nextAttemptAt: new Date(now.getTime() - 5000 + index),
    }))
  );
  const deadline = new AbortController();
  const timeout = spyOn(AbortSignal, "timeout").mockReturnValue(
    deadline.signal
  );
  // Two requests succeed before the single batch deadline expires on request three.
  stalledRequest = 3;
  expireCleanupBudget = () =>
    deadline.abort(new DOMException("Synthetic deadline", "TimeoutError"));
  const request = () =>
    new Request("https://example.test/api/cron/autopilot", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    });
  try {
    expect(
      (await GET(new Request("https://example.test/api/cron/autopilot"))).status
    ).toBe(401);
    expect(timeout).not.toHaveBeenCalled();
    expect(runDueAutopilots).not.toHaveBeenCalled();
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      checked: 0,
      started: 0,
      failed: 0,
      cleanup: { checked: 5, failed: 1 },
    });
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS);
    expect(deleteNamespace).toHaveBeenCalledTimes(3);
    expect(abortedRequests).toBe(1);
    expect(activeRequests).toBe(0);
    expect(runDueAutopilots).toHaveBeenCalledTimes(1);
    const pending = await db.select().from(autopilotNamespaceDeletions);
    expect(pending.map((row) => row.organizationId).sort()).toEqual([
      "deleted-2",
      "deleted-3",
      "deleted-4",
    ]);
    expect(
      pending
        .find((row) => row.organizationId === "deleted-2")
        ?.nextAttemptAt.getTime()
    ).toBeGreaterThan(now.getTime());
    // A new transaction can claim the retained row; no background deletion survives return.
    await db
      .update(autopilotNamespaceDeletions)
      .set({ nextAttemptAt: new Date(0) });
    timeout.mockRestore();
    stalledRequest = 0;
    expect((await GET(request())).status).toBe(200);
    expect(await db.select().from(autopilotNamespaceDeletions)).toEqual([]);
    expect(deleteNamespace).toHaveBeenCalledTimes(6);
    expect(activeRequests).toBe(0);
  } finally {
    timeout.mockRestore();
  }
});
