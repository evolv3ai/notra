import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { call } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { Effect } from "effect";
import { z } from "zod";

import type { AuthSessionData } from "@/types/auth/session";

if (process.env.NOTRA_RPC_CUSTOM_ATTRIBUTION_TEST !== "1") {
  test("custom membership paths contribute to the original RPC request memo", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_RPC_CUSTOM_ATTRIBUTION_TEST: "1",
          DATABASE_URL: "",
          NEXT_PUBLIC_DEMO_MODE: "false",
        },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stderr?.toString()).toBe(0);
  }, 25_000);
} else {
  const access = { allowed: true, organizationId: "org_b" };
  const failure = mock(() => {
    throw new Error("fixture failure after membership");
  });
  const membership = async () =>
    access.allowed ? { id: "member_fixture", role: "owner" } : undefined;
  mock.module("@notra/db/drizzle", () => ({
    db: {
      query: {
        members: {
          findFirst: membership,
          findMany: async () => [{ organizationId: access.organizationId }],
        },
      },
      select: failure,
      transaction: async (task: (tx: unknown) => Promise<unknown>) => {
        let selects = 0;
        const lock = {
          from: () => lock,
          where: () => lock,
          for: async () => [],
        };
        return task({
          select: () => (++selects === 1 ? lock : failure()),
          query: {
            members: { findFirst: membership },
            organizations: { findFirst: failure },
          },
        });
      },
    },
  }));
  mock.module("@/lib/i18n/server", () => ({
    getTranslations: async () => (key: string) => key,
  }));
  const { assertOrganizationAccessWithDeps } =
    await import("@/lib/auth/organization");
  const session: AuthSessionData = {
    session: {
      activeOrganizationId: "org_b",
      userId: "user_fixture",
      impersonatedBy: null,
    },
    user: {
      id: "user_fixture",
      name: "Fixture",
      email: "fixture@example.invalid",
      emailVerified: true,
      image: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      role: null,
      banned: false,
      banReason: null,
      banExpires: null,
      hidePersonalData: false,
      showAgentStats: false,
      locale: null,
      workosUserId: null,
      marketingOptInAt: null,
      marketingOptInEvidence: null,
      marketingOptInPolicyVersion: null,
    },
  };
  mock.module("@/lib/auth/organization", () => ({
    assertAuthenticated: async () => session,
    assertOrganizationAccessWithDeps,
  }));
  mock.module("@/lib/auth/server", () => ({
    getAuthSession: async () => session,
  }));
  mock.module("@/lib/orpc/routers/user-account", () => ({
    userAccountRouter: {},
    userSecurityRouter: {},
  }));
  mock.module("@notra/sites-server/organization", () => ({
    deleteOrganizationSites: failure,
  }));
  mock.module("@/lib/organizations/workos-sync", () => ({
    deleteOrganizationFromWorkOS: failure,
    removeMembershipFromWorkOS: failure,
    updateMembershipRoleInWorkOS: failure,
  }));
  mock.module("@/lib/billing/delete-autumn-customer", () => ({
    deleteAutumnCustomer: failure,
  }));
  mock.module("@/lib/sites/preview-revocation", () => ({
    revokeSitePreviewAccess: failure,
  }));
  mock.module("@/lib/upload/cleanup", () => ({
    deleteOrganizationChatFiles: failure,
    deleteOrganizationFiles: failure,
    deleteUserFiles: failure,
  }));
  mock.module("@/lib/upload/r2", () => ({ getR2Config: failure }));
  mock.module("@/lib/upload/content-image-store", () => ({
    readContentImage: failure,
    saveContentImage: failure,
  }));
  mock.module("@/lib/upload/validate", () => ({ validateUpload: failure }));
  const { userRouter } = await import("../src/lib/orpc/routers/user");
  const { uploadRouter } = await import("../src/lib/orpc/routers/upload");
  const {
    createPresignedUpload,
    deleteChatUpload,
    recordChatAttachment,
    readAuthorizedContentImage,
  } = await import("../src/lib/upload/server");
  const { requireMembership } = await import("../src/lib/organizations/guards");
  const { createORPCContext } = await import("../src/lib/orpc/context");
  const { baseProcedure } = await import("../src/lib/orpc/base");
  const { rpcRequestOrganizationId, finalizeRpcRequestAttribution } =
    await import("../src/utils/rpc-telemetry");
  const { evlogRequestIntegration } =
    await import("@notra/ai/utils/evlog-request");
  const { getOperationalContext, runWithOperationalContext } =
    await import("@notra/ai/utils/operational-context");

  test("real central/custom batch retains both verified targets after a custom SQL failure", async () => {
    failure.mockClear();
    const central = baseProcedure
      .input(z.object({ organizationId: z.string() }))
      .handler(async ({ context, input }) => {
        await assertOrganizationAccessWithDeps(
          {
            headers: context.headers,
            organizationId: input.organizationId,
            user: session.user,
          },
          {
            hasDatabaseUrl: () => true,
            getServerSession: async () => ({
              session: undefined,
              user: undefined,
            }),
            findMembership: membership,
          }
        );
        return true;
      });
    const handler = new RPCHandler(
      { central, custom: userRouter.membership.applyAction },
      { plugins: [new BatchHandlerPlugin()] }
    );
    const request = new Request("https://fixture.invalid/rpc/batch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-orpc-batch": "streaming",
      },
      body: JSON.stringify([
        {
          url: "https://fixture.invalid/rpc/central",
          body: { json: { organizationId: "org_a" } },
        },
        {
          url: "https://fixture.invalid/rpc/custom",
          body: { json: { organizationId: "org_b", action: "leave" } },
        },
      ]),
    });
    const context = await createORPCContext({ headers: request.headers });
    const events: Record<string, unknown>[] = [];
    const log = evlogRequestIntegration.start(request, {
      drain: ({ event }) => {
        events.push(event);
      },
    });
    await log.runWith(() =>
      runWithOperationalContext(
        { requestId: "req_fixture", organizationId: "org_ui" },
        async () => {
          const { response } = await handler.handle(request, {
            context,
            prefix: "/rpc",
          });
          expect(response).toBeDefined();
          finalizeRpcRequestAttribution(context.requestMemo);
          if (!response) {
            throw new Error("Missing batch response");
          }
          const body = await (await log.finishResponse(response)).text();
          expect(body).toContain("INTERNAL_SERVER_ERROR");
          expect(failure).toHaveBeenCalled();
          expect(getOperationalContext()?.organizationId).toBe("org_ui");
        }
      )
    );
    expect([...context.requestMemo.authorizedOrganizationIds].sort()).toEqual([
      "org_a",
      "org_b",
    ]);
    expect(rpcRequestOrganizationId(context.requestMemo)).toBeUndefined();
    expect(events).toHaveLength(1);
    expect(events[0]?.organizationId).toBeUndefined();
  });

  test("user, upload and headerless Effect guards record only successful membership", async () => {
    const guard = baseProcedure.handler(async () =>
      Effect.runPromise(requireMembership(session, access.organizationId))
    );
    const clonedHeaders = baseProcedure.handler(async ({ context }) =>
      assertOrganizationAccessWithDeps(
        {
          headers: new Headers(context.headers),
          organizationId: access.organizationId,
          user: session.user,
        },
        {
          hasDatabaseUrl: () => true,
          getServerSession: async () => ({
            session: undefined,
            user: undefined,
          }),
          findMembership: membership,
        }
      )
    );
    const cases = [
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        call(
          userRouter.membership.applyAction,
          { organizationId: "org_b", action: "leave" },
          { context }
        ),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        call(
          userRouter.deleteWithTransfers,
          { transfers: [{ orgId: "org_b", action: "delete" }] },
          { context }
        ),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        call(
          uploadRouter.logoFromUrl,
          { sourceUrl: "https://fixture.invalid/logo.png" },
          { context }
        ),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        call(
          uploadRouter.uploadSvg,
          { type: "brand_asset", svg: "not-svg" },
          { context }
        ),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        createPresignedUpload({
          headers: context.headers,
          type: "logo",
          fileType: "image/png",
          fileSize: 1,
        }),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        deleteChatUpload({ headers: context.headers, key: "wrong-prefix" }),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        recordChatAttachment({
          headers: context.headers,
          key: "wrong-prefix",
          filename: "fixture",
          mediaType: "image/png",
          size: 1,
        }),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        readAuthorizedContentImage({
          headers: context.headers,
          key: "wrong-prefix",
        }),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        call(guard, undefined, { context }),
      (context: Awaited<ReturnType<typeof createORPCContext>>) =>
        call(clonedHeaders, undefined, { context }),
    ];
    for (const invoke of cases) {
      const context = await createORPCContext({ headers: new Headers() });
      access.allowed = false;
      await expect(invoke(context)).rejects.toBeDefined();
      expect(context.requestMemo.authorizedOrganizationIds.size).toBe(0);
      access.allowed = true;
      await invoke(context).catch(() => {});
      expect(rpcRequestOrganizationId(context.requestMemo)).toBe("org_b");
      await invoke(context).catch(() => {});
      expect(context.requestMemo.authorizedOrganizationIds.size).toBe(1);
    }
  });

  test("verified headerless guards retain non-RPC operational attribution without the UI tenant", async () => {
    access.allowed = true;
    await runWithOperationalContext({ requestId: "req_fixture" }, async () => {
      await Effect.runPromise(requireMembership(session, "org_verified"));
      expect(getOperationalContext()).toMatchObject({
        organizationId: "org_verified",
        userId: session.user.id,
      });
    });
    expect(getOperationalContext()).toBeUndefined();
  });

  test("owned organization summaries record verified ownership before later queries fail", async () => {
    const context = await createORPCContext({ headers: new Headers() });
    await expect(
      call(userRouter.organizations.listOwned, undefined, { context })
    ).rejects.toThrow("fixture failure after membership");
    expect(rpcRequestOrganizationId(context.requestMemo)).toBe("org_b");
  });
}
