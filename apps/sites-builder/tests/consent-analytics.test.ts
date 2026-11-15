import { afterEach, expect, test } from "bun:test";

const globals = globalThis as Record<string, unknown>;

async function startCode(hostname: string) {
  Object.assign(globals, {
    __NOTRA_CONSENT_ANALYTICS__: {
      gtag: { id: "G-TEST" },
      posthog: {
        id: "phc_test",
        apiHost: "https://us.i.posthog.com",
        disableSessionRecording: true,
      },
    },
    __NOTRA_HOSTING_DOMAIN__: "notra.site",
    __NOTRA_CONSENT_STORAGE_KEY__: "__Host-c15t",
    location: { hostname },
    document: { cookie: "" },
  });
  const { default: client } = await import(`../src/c15t.client.ts?${hostname}`);
  return client.scripts
    .map(
      (script: {
        serverStart?: (info: unknown, started: unknown) => { code: string };
      }) =>
        script.serverStart?.(
          {
            hasConsent: true,
            elementId: "test",
            consents: { necessary: true, measurement: true },
          },
          script
        )?.code
    )
    .join("\n");
}

afterEach(() => {
  for (const name of [
    "__NOTRA_CONSENT_ANALYTICS__",
    "__NOTRA_HOSTING_DOMAIN__",
    "__NOTRA_CONSENT_STORAGE_KEY__",
    "location",
    "document",
  ]) {
    delete globals[name];
  }
});

test("consent-gated GA4 and PostHog keep their cookies host-only on the hosting domain", async () => {
  const code = await startCode("acme.notra.site");
  expect(code).toContain('["config","G-TEST",{"cookie_domain":"none"}]');
  expect(code).toContain('"cross_subdomain_cookie":false');
});

test("consent-gated GA4 and PostHog keep their defaults on a custom domain", async () => {
  const code = await startCode("blog.acme.com");
  expect(code).toContain('["config","G-TEST"]');
  expect(code).not.toContain("cookie_domain");
  expect(code).not.toContain("cross_subdomain_cookie");
});
