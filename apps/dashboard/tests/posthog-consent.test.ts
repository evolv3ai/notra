import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.NOTRA_POSTHOG_CONSENT_TEST_WORKER) {
  test.each(["granted", "denied", "demo"])(
    "PostHog consent and identity lifecycle (%s)",
    (initialConsent) => {
      const child = spawnSync(
        process.execPath,
        ["--no-env-file", "test", fileURLToPath(import.meta.url)],
        {
          env: {
            PATH: process.env.PATH,
            NOTRA_POSTHOG_CONSENT_TEST_WORKER: initialConsent,
            NEXT_PUBLIC_NOTRA_DEMO_MODE:
              initialConsent === "demo" ? "true" : "false",
            NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "test-token",
          },
          timeout: 30_000,
        }
      );
      expect(child.status, child.stderr?.toString()).toBe(0);
    },
    35_000
  );
} else {
  const effects: Array<() => void | (() => void)> = [];
  const cleanups: Array<() => void> = [];
  const events: string[] = [];
  let granted = false;
  let userId: string | undefined = "user-a";
  let identifiedUserId: string | undefined;
  let status: "pending" | "granted" | "denied" = "pending";

  Object.defineProperty(globalThis, "window", {
    value: { location: { hostname: "localhost" } },
    configurable: true,
  });
  const react = await import("react");
  mock.module("react", () => ({
    ...react,
    useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  }));
  mock.module("c15t/tanstack-start", () => ({
    useConsent: () => granted,
    useSetActiveUI: () => {
      throw new Error("Cookie preferences need a consent provider");
    },
  }));
  mock.module("@/lib/auth/client", () => ({
    authClient: {
      useSession: () => ({
        isPending: false,
        data: userId
          ? { user: { id: userId }, session: { activeOrganizationId: "org" } }
          : null,
      }),
    },
  }));
  mock.module("@/lib/hooks/use-geo-project-query", () => ({
    useGeoProjectQueryState: () => ["project"],
  }));
  const { POSTHOG_CONFIG, POSTHOG_PROJECT_TOKEN } =
    await import("@/constants/posthog");
  const resolveConsent = mock(async () => ({ source: "test" }));
  mock.module("c15t/tanstack-start/server", () => ({ resolveConsent }));
  const { resolveDashboardConsent } =
    await import("@/lib/consent-manager/resolve");
  const client = {
    init: mock(() => events.push("init")),
    // In on_reject mode, pending already counts as opted out.
    has_opted_out_capturing: () => status !== "granted",
    has_opted_in_capturing: () => status === "granted",
    get_explicit_consent_status: () => status,
    opt_in_capturing: mock(() => {
      events.push("opt-in");
      status = "granted";
      identifiedUserId = undefined;
    }),
    opt_out_capturing: mock(() => {
      events.push("opt-out");
      status = "denied";
      identifiedUserId = undefined;
    }),
    get_property: () => identifiedUserId,
    identify: mock((id: string) => {
      if (status === "granted") {
        events.push(`identify:${id}`);
        identifiedUserId = id;
      }
    }),
    reset: mock(() => {
      events.push("reset");
      status = "pending";
      identifiedUserId = undefined;
    }),
    resetGroups: mock(() => undefined),
    group: mock(() => undefined),
    register: mock(() => undefined),
    unregister: mock(() => undefined),
  };
  mock.module("posthog-js", () => ({ default: client }));

  const { PostHogIdentity } =
    await import("@/components/providers/posthog-identity");
  const {
    initPostHog,
    withPostHog,
    whenPostHogReady,
    subscribeWhenPostHogReady,
  } = await import("@/lib/analytics/posthog-lazy");
  const { resetPostHogIdentity } =
    await import("@/lib/analytics/posthog-client");

  const render = () => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    PostHogIdentity();
    for (const effect of effects.splice(0)) {
      const cleanup = effect();
      if (cleanup) {
        cleanups.push(cleanup);
      }
    }
  };

  if (process.env.NOTRA_POSTHOG_CONSENT_TEST_WORKER === "demo") {
    test("demo privacy settings render without a consent provider or cookie controls", async () => {
      mock.module("use-intl", () => ({
        useTranslations: () => (key: string) => key,
      }));
      mock.module("@/lib/hooks/use-privacy-preferences", () => ({
        useHidePersonalData: () => ({
          hidePersonalData: true,
          hasHydrated: true,
          isUpdating: false,
          setHidePersonalData: () => undefined,
        }),
      }));
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { PrivacySection } =
        await import("@/components/settings/privacy-section");
      const html = renderToStaticMarkup(react.createElement(PrivacySection));
      expect(html).toContain("hidePersonalData");
      expect(html).not.toContain("manageCookies");
    });

    test("demo skips consent resolution and all PostHog entry points even with a configured token", async () => {
      expect(POSTHOG_PROJECT_TOKEN).toBeUndefined();
      expect(await resolveDashboardConsent("en")).toBeNull();
      expect(resolveConsent).not.toHaveBeenCalled();
      const callback = mock(() => undefined);
      initPostHog();
      await withPostHog(callback);
      await whenPostHogReady(callback);
      subscribeWhenPostHogReady(callback)();
      resetPostHogIdentity();
      expect(callback).not.toHaveBeenCalled();
      expect(client.init).not.toHaveBeenCalled();
      expect(events).toEqual([]);
    });
  } else if (process.env.NOTRA_POSTHOG_CONSENT_TEST_WORKER === "granted") {
    test("an early grant is applied before lazy ready callbacks", async () => {
      granted = true;
      await resolveDashboardConsent("de");
      expect(resolveConsent).toHaveBeenCalledWith({
        language: "de",
        proxy: true,
        routePrefix: "/api/c15t",
      });
      render();
      expect(events).toEqual([]);
      await withPostHog(() => undefined);
      expect(events).toEqual(["init", "opt-in", "identify:user-a"]);
    });
  } else {
    test("applies consent before lazy init subscribers and preserves it across resets", async () => {
      render();
      expect(client.init).not.toHaveBeenCalled();
      await withPostHog(() => undefined);
      expect(events).toEqual(["init", "opt-out"]);
      expect(status).toBe("denied");
      expect(POSTHOG_CONFIG.cookieless_mode).toBe("on_reject");
      expect(POSTHOG_CONFIG.session_recording.maskAllInputs).toBe(true);
      expect(POSTHOG_CONFIG.session_recording.recordBody).toBe(false);
      expect(POSTHOG_CONFIG.session_recording.recordHeaders).toBe(false);

      events.length = 0;
      granted = true;
      render();
      expect(events).toEqual(["opt-in", "identify:user-a"]);
      expect(client.opt_in_capturing).toHaveBeenLastCalledWith({
        captureEventName: false,
      });

      events.length = 0;
      userId = "user-b";
      render();
      expect(events).toEqual(["reset", "opt-in", "identify:user-b"]);

      events.length = 0;
      userId = undefined;
      render();
      expect(events).toEqual(["reset", "opt-in"]);

      events.length = 0;
      resetPostHogIdentity();
      await withPostHog(() => undefined);
      expect(events).toEqual(["reset", "opt-in"]);

      events.length = 0;
      granted = false;
      render();
      expect(events).toEqual(["opt-out"]);
      render();
      expect(events).toEqual(["opt-out"]);

      events.length = 0;
      resetPostHogIdentity();
      await withPostHog(() => undefined);
      expect(events).toEqual(["reset", "opt-out"]);
    });
  }
}
