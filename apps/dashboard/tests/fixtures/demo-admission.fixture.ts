import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";

import { DEMO_TURNSTILE_ACTION } from "../../src/constants/turnstile";

const originalSecret = process.env.TURNSTILE_SECRET;
const originalHostnames = process.env.TURNSTILE_HOSTNAMES;
const originalFetch = globalThis.fetch;
const logWarn = mock();
const createDemoSandbox = mock(async () => ({
  anonymousId: "demo_synthetic",
  organizationId: "synthetic-org",
  slug: "demo-synthetic",
}));
const maintainDemoSandboxPool = mock();
const writeDemoSession = mock();
const getCurrentDemoSandbox = mock(
  async (): Promise<{ anonymousId: string } | null> => null
);
const limit = mock(async () => ({ success: true }));
let demoMode = true;

mock.module("@notra/ai/utils/server-log", () => ({ logWarn }));
mock.module("@notra/utils/demo-mode", () => ({ isDemoMode: () => demoMode }));
mock.module("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => new Headers(),
}));
mock.module("@/lib/demo/sandbox", () => ({
  createDemoSandbox,
  maintainDemoSandboxPool,
}));
mock.module("@/lib/demo/session", () => ({
  writeDemoSession,
  getCurrentDemoSandbox,
}));
mock.module("@/utils/demo-ip-hash", () => ({
  getDemoClientIp: () => "192.0.2.1",
  hashDemoClientIp: () => "synthetic-ip",
}));
mock.module("@/utils/ratelimit", () => ({
  ratelimit: { demoSandboxCreate: { limit } },
}));

const { POST } = await import("../../src/app/api/demo/sandbox/route");
const { GET } = await import("../../src/app/api/demo/enter/route");
const { verifyDemoHumanCheck } = await import("../../src/lib/demo/human-check");

const verified = {
  success: true,
  hostname: "demo.example.com",
  action: DEMO_TURNSTILE_ACTION,
};

function admissionRequest(
  body: unknown = {
    "cf-turnstile-response": "synthetic-token",
    timeZone: "UTC",
  }
) {
  return new Request("https://demo.example.com/api/demo/sandbox", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://demo.example.com",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.TURNSTILE_SECRET = "synthetic-secret";
  process.env.TURNSTILE_HOSTNAMES = "demo.example.com";
  globalThis.fetch = originalFetch;
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json(verified));
  demoMode = true;
  logWarn.mockClear();
  createDemoSandbox.mockClear();
  maintainDemoSandboxPool.mockClear();
  writeDemoSession.mockClear();
  getCurrentDemoSandbox.mockClear();
  getCurrentDemoSandbox.mockResolvedValue(null);
  limit.mockClear();
  limit.mockResolvedValue({ success: true });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalSecret === undefined) {
    delete process.env.TURNSTILE_SECRET;
  } else {
    process.env.TURNSTILE_SECRET = originalSecret;
  }
  if (originalHostnames === undefined) {
    delete process.env.TURNSTILE_HOSTNAMES;
  } else {
    process.env.TURNSTILE_HOSTNAMES = originalHostnames;
  }
});

test.each([
  {},
  { "cf-turnstile-response": "" },
  { "cf-turnstile-response": "a".repeat(2049) },
  { "cf-turnstile-response": 42 },
  null,
])(
  "direct POST without a well-formed token cannot allocate a workspace: %j",
  async (body) => {
    const response = await POST(admissionRequest(body));
    expect(response.status).toBe(403);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(createDemoSandbox).not.toHaveBeenCalled();
    expect(maintainDemoSandboxPool).not.toHaveBeenCalled();
    expect(writeDemoSession).not.toHaveBeenCalled();
  }
);

test.each([
  { success: false, "error-codes": ["invalid-input-response"] },
  { success: false, "error-codes": ["timeout-or-duplicate"] },
  { ...verified, action: "contact" },
  { ...verified, hostname: "www.example.com" },
  { success: true },
])(
  "rejects failed, replayed, cross-action and cross-host tokens: %j",
  async (result) => {
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result));
    expect((await POST(admissionRequest())).status).toBe(403);
    expect(createDemoSandbox).not.toHaveBeenCalled();
    expect(maintainDemoSandboxPool).not.toHaveBeenCalled();
    expect(writeDemoSession).not.toHaveBeenCalled();
  }
);

test.each(["TURNSTILE_SECRET", "TURNSTILE_HOSTNAMES"])(
  "missing %s fails closed",
  async (name) => {
    delete process.env[name];
    expect((await POST(admissionRequest())).status).toBe(403);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(createDemoSandbox).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledWith(expect.any(String), {
      reason: "turnstile_unconfigured",
    });
  }
);

test("an unconfigured request hostname cannot accept an otherwise valid token", async () => {
  process.env.TURNSTILE_HOSTNAMES = "www.example.com";
  expect((await POST(admissionRequest())).status).toBe(403);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(createDemoSandbox).not.toHaveBeenCalled();
});

test("verification failures and malformed responses fail closed", async () => {
  for (const response of [
    new Response("unavailable", { status: 503 }),
    new Response("not-json"),
  ]) {
    spyOn(globalThis, "fetch").mockResolvedValue(response);
    expect((await POST(admissionRequest())).status).toBe(403);
  }
  spyOn(globalThis, "fetch").mockRejectedValue(new Error("network timeout"));
  expect((await POST(admissionRequest())).status).toBe(403);
  expect(createDemoSandbox).not.toHaveBeenCalled();
});

test("a verified token claims a workspace only after server-side verification", async () => {
  spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
    expect(createDemoSandbox).not.toHaveBeenCalled();
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    );
    expect(options?.method).toBe("POST");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(String(options?.body)).toBe(
      "secret=synthetic-secret&response=synthetic-token"
    );
    return Response.json(verified);
  });
  const response = await POST(admissionRequest());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ slug: "demo-synthetic" });
  expect(createDemoSandbox).toHaveBeenCalledWith({
    timeZone: "UTC",
    ipHash: "synthetic-ip",
  });
  expect(writeDemoSession).toHaveBeenCalledTimes(1);
  expect(maintainDemoSandboxPool).toHaveBeenCalledTimes(1);
});

test("a token can allocate at most one workspace when Siteverify rejects reuse", async () => {
  const verifier = spyOn(globalThis, "fetch");
  verifier.mockResolvedValueOnce(Response.json(verified));
  verifier.mockResolvedValueOnce(
    Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] })
  );
  expect((await POST(admissionRequest())).status).toBe(201);
  expect((await POST(admissionRequest())).status).toBe(403);
  expect(createDemoSandbox).toHaveBeenCalledTimes(1);
});

test.each(["x-forwarded-host", "host"])(
  "the internal URL uses the public %s for token binding",
  async (header) => {
    const request = new Request("http://0.0.0.0:8080/api/demo/sandbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://demo.example.com",
        "X-Forwarded-Proto": "https",
        [header]: "demo.example.com",
      },
      body: JSON.stringify({
        "cf-turnstile-response": "synthetic-token",
        timeZone: "UTC",
      }),
    });
    expect((await POST(request)).status).toBe(201);
    expect(createDemoSandbox).toHaveBeenCalledTimes(1);
  }
);

test("a forwarded hostname cannot bypass the configured allowlist", async () => {
  const request = admissionRequest();
  request.headers.set("x-forwarded-host", "attacker.example");
  request.headers.set("origin", "https://attacker.example");
  expect((await POST(request)).status).toBe(403);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(createDemoSandbox).not.toHaveBeenCalled();
});

test("IP rate limiting is retained before remote verification", async () => {
  limit.mockResolvedValue({ success: false });
  expect((await POST(admissionRequest())).status).toBe(429);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(createDemoSandbox).not.toHaveBeenCalled();
});

test("cross-site admission is rejected before verification or allocation", async () => {
  const request = admissionRequest();
  request.headers.set("Origin", "https://untrusted.example");
  expect((await POST(request)).status).toBe(403);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(createDemoSandbox).not.toHaveBeenCalled();
});

test("GET entry cannot consume or refill the pool, even with rotating IPs", async () => {
  for (let index = 0; index < 20; index += 1) {
    const response = await GET(
      new Request(
        "https://demo.example.com/api/demo/enter?returnTo=%2Fstudio",
        { headers: { "X-Forwarded-For": `192.0.2.${index}` } }
      )
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe(
      "/auth/demo?returnTo=%2Fstudio"
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
  expect(createDemoSandbox).not.toHaveBeenCalled();
  expect(maintainDemoSandboxPool).not.toHaveBeenCalled();
  expect(writeDemoSession).not.toHaveBeenCalled();
  expect(limit).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("existing sessions bypass the challenge without getting another workspace", async () => {
  getCurrentDemoSandbox.mockResolvedValue({ anonymousId: "demo_existing" });
  const response = await GET(
    new Request("https://demo.example.com/api/demo/enter?returnTo=%2Fstudio")
  );
  expect(response.headers.get("Location")).toBe("/studio");
  expect(createDemoSandbox).not.toHaveBeenCalled();
  expect(maintainDemoSandboxPool).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("demo endpoints stay unavailable outside demo mode", async () => {
  demoMode = false;
  expect((await POST(admissionRequest())).status).toBe(404);
  expect(
    (await GET(new Request("https://demo.example.com/api/demo/enter"))).status
  ).toBe(404);
  expect(createDemoSandbox).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("malformed tokens are also rejected at the verifier boundary", async () => {
  expect(await verifyDemoHumanCheck(null, "demo.example.com")).toBe(false);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
