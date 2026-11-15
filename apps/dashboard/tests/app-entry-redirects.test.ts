import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_APP_ENTRY_TEST_WORKER !== "1") {
  test("app entry redirects in an isolated process", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_APP_ENTRY_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  }, 35_000);
} else {
  const serverFn = {
    validator: mock(),
    handler: (handler: unknown) => handler,
  };
  serverFn.validator.mockReturnValue(serverFn);
  mock.module("@tanstack/react-start", () => ({
    createServerFn: () => serverFn,
  }));
  mock.module("@tanstack/react-start/server", () => ({
    getCookie: () => undefined,
    getRequestHeaders: () => new Headers(),
  }));
  mock.module("../src/lib/auth/actions", () => ({
    getSession: async () => ({ user: { id: "fixture-user" } }),
    getLastActiveOrganization: async () => ({
      slug: "fixture-org",
      projectId: "fixture-project",
    }),
  }));
  mock.module("../src/lib/analytics/posthog-server", () => ({
    setPersonProperties: () => {},
    trackServerEvent: () => {},
  }));
  mock.module("../src/lib/auth/banned", () => ({
    isSessionBanned: async () => false,
  }));
  mock.module("../src/lib/auth/mfa-cookies", () => ({
    readPendingMfaFlow: async () => null,
  }));
  mock.module("../src/lib/billing/checkout-plan-cookie", () => ({
    rememberCheckoutPlan: () => {},
  }));
  mock.module("../src/lib/integrations/deeplink-resolution", () => ({
    resolveIntegrationConnectDeeplink: () => {},
  }));
  mock.module("@notra/utils/demo-mode", () => ({ isDemoMode: () => false }));

  const { loadAppEntry, loadGuestAccess, loadAuthCallback } =
    await import("../src/routes/-entry-loaders");

  for (const [name, loader] of Object.entries({
    loadAppEntry,
    loadGuestAccess,
    loadAuthCallback,
  })) {
    test(`${name} opens Overview with the last project`, async () => {
      await expect(
        loader({ data: { params: {}, searchParams: {} } })
      ).rejects.toMatchObject({
        options: { href: "/fixture-org/geo?project=fixture-project" },
      });
    });
  }

  test("an explicit login destination still takes priority", async () => {
    await expect(
      loadAuthCallback({
        data: {
          params: {},
          searchParams: { returnTo: "/fixture-org/content" },
        },
      })
    ).rejects.toMatchObject({ options: { href: "/fixture-org/content" } });
  });
}
