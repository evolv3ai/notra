// Offline integration smoke: committed migrations + real PostgreSQL semantics in
// PGlite, real coordinator/ledger, stubbed designers/providers. Never loads env.
import { mock, spyOn } from "bun:test";
import assert from "node:assert/strict";

import {
  brandSettings,
  brandOgTemplates,
  brandOgDesignRuns,
  brandOgDesignCalls,
} from "@notra/db/schema";
import { and, eq } from "drizzle-orm";
import { Deferred, Effect } from "effect";

import { OgQualityError } from "../src/schemas/og-errors";
import type { OgDesignParams } from "../src/types/og-image";
import { createOgTestDatabase } from "./utils/og-test-database";

delete process.env.DATABASE_URL;
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.OPENROUTER_API_KEY;
const { client, db, organizationId } = await createOgTestDatabase();
mock.module("@notra/db/drizzle", () => ({ db }));
const { fallbackOgTemplate } = await import("../src/utils/og-fallback");
let designCalls = 0;
const entered = Deferred.makeUnsafe<void>();
const release = Deferred.makeUnsafe<void>();
let mode = "success";
let ambiguousCommit = false;
mock.module("@notra/ai/agents/og-image", () => ({
  designOgTemplate: async (
    brand: Parameters<typeof fallbackOgTemplate>[0],
    params: OgDesignParams
  ) => {
    designCalls++;
    if (mode !== "cancel") {
      await params.onCall?.({
        id: crypto.randomUUID(),
        stage: "design",
        requestedModel: "offline",
        status: "running",
      });
    }
    if (mode === "fail") {
      throw new OgQualityError({ message: "Fixture rejected design" });
    }
    if (mode === "block") {
      await Effect.runPromise(Deferred.succeed(entered, undefined));
      await Effect.runPromise(Deferred.await(release));
    }
    if (mode === "cancel" || mode === "cancel-spent") {
      await Effect.runPromise(Deferred.succeed(enteredCancel, undefined));
      await new Promise((_resolve, reject) =>
        params.signal?.addEventListener(
          "abort",
          () => reject(new Error("Fixture cancelled")),
          { once: true }
        )
      );
    }
    if (mode === "expire") {
      await db
        .update(brandOgDesignRuns)
        .set({ leaseExpiresAt: new Date(0) })
        .where(eq(brandOgDesignRuns.brandSettingsId, brand.id));
    }
    if (mode === "ambiguous-save") {
      ambiguousCommit = true;
    }
    return fallbackOgTemplate(brand);
  },
}));
let enteredCancel = Deferred.makeUnsafe<void>();
const { generateBrandOgImage, getOgBrandHash } =
  await import("../src/utils/og-image");
const { loadOgBrand } = await import("../src/utils/og-brand");
const {
  claimOgDesign,
  finishOgDesign,
  recordOgDesignCall,
  reconcileOgDesignCosts,
  sweepOgDesignCosts,
} = await import("../src/utils/og-design-store");
const identity = async () => {
  const id = crypto.randomUUID();
  await db.insert(brandSettings).values({
    id,
    organizationId,
    name: `Offline OG smoke ${id}`,
    isDefault: false,
    companyName: "Offline OG smoke",
    websiteUrl: "https://example.com",
  });
  return id;
};
const image = (id: string, signal?: AbortSignal) =>
  generateBrandOgImage({
    organizationId,
    brandIdentityId: id,
    title: "Offline integration smoke",
    signal,
  });
const checks: string[] = [];
try {
  const id = await identity();
  const first = await image(id);
  assert.equal(first.templateSource, "generated");
  assert.equal((await image(id)).templateSource, "cached");
  assert.equal(designCalls, 1);
  assert.equal(
    (
      await db.query.brandOgDesignRuns.findFirst({
        where: eq(brandOgDesignRuns.brandSettingsId, id),
      })
    )?.status,
    "succeeded"
  );
  checks.push(
    "approved template persists; second title spends no design calls"
  );
  const originalTransaction = db.transaction.bind(db);
  const transactionSpy = spyOn(db, "transaction").mockImplementation(
    async (callback, config) => {
      const result = await originalTransaction(callback, config);
      if (ambiguousCommit) {
        ambiguousCommit = false;
        throw new Error("Fixture lost COMMIT acknowledgement");
      }
      return result;
    }
  );
  try {
    mode = "ambiguous-save";
    const ambiguousId = await identity();
    const beforeAmbiguous = designCalls;
    assert.equal((await image(ambiguousId)).templateSource, "generated");
    assert.equal(designCalls, beforeAmbiguous + 1);
    assert.equal((await image(ambiguousId)).templateSource, "cached");
    checks.push(
      "ambiguous save COMMIT retries idempotently without another design"
    );
  } finally {
    transactionSpy.mockRestore();
  }

  const failedId = await identity();
  mode = "fail";
  assert.equal((await image(failedId)).templateSource, "fallback");
  const before = designCalls;
  // There is no worker-local map: a new request reads the durable run row.
  assert.equal((await image(failedId)).templateSource, "fallback");
  assert.equal(designCalls, before);
  await db
    .update(brandSettings)
    .set({ companyName: "Changed brand" })
    .where(eq(brandSettings.id, failedId));
  await image(failedId);
  assert.equal(designCalls, before + 1);
  checks.push(
    "durable backoff prevents repeat spend; brand hash changes permit a new attempt"
  );

  mode = "block";
  const blockedId = await identity();
  const blocked = image(blockedId);
  await Effect.runPromise(Deferred.await(entered));
  // This would block if a provider call were still holding PGlite's transaction.
  await db
    .update(brandSettings)
    .set({ name: "Unrelated write while provider waits" })
    .where(eq(brandSettings.id, failedId));
  const other = await image(blockedId);
  assert.equal(other.templateSource, "fallback");
  const active = await db.query.brandOgDesignRuns.findMany({
    where: and(
      eq(brandOgDesignRuns.brandSettingsId, blockedId),
      eq(brandOgDesignRuns.status, "running")
    ),
  });
  assert.equal(active.length, 1);
  await Effect.runPromise(Deferred.succeed(release, undefined));
  assert.equal((await blocked).templateSource, "generated");
  checks.push(
    "provider does not hold DB transaction; only one lease owner spends"
  );

  mode = "cancel";
  const cancelId = await identity();
  const controller = new AbortController();
  const cancelled = image(cancelId, controller.signal);
  const observed = assert.rejects(cancelled);
  await Effect.runPromise(Deferred.await(enteredCancel));
  controller.abort();
  await observed;
  assert.equal(
    (
      await db.query.brandOgDesignRuns.findFirst({
        where: eq(brandOgDesignRuns.brandSettingsId, cancelId),
      })
    )?.status,
    "cancelled"
  );
  mode = "success";
  assert.equal((await image(cancelId)).templateSource, "generated");
  checks.push("interruption releases durable lease without failure backoff");
  mode = "cancel-spent";
  enteredCancel = Deferred.makeUnsafe<void>();
  const spentCancelId = await identity();
  const spentController = new AbortController();
  const spentCancelled = assert.rejects(
    image(spentCancelId, spentController.signal)
  );
  await Effect.runPromise(Deferred.await(enteredCancel));
  spentController.abort();
  await spentCancelled;
  const cancelledRun = await db.query.brandOgDesignRuns.findFirst({
    where: eq(brandOgDesignRuns.brandSettingsId, spentCancelId),
  });
  assert.ok(
    cancelledRun?.retryAfter && cancelledRun.retryAfter.getTime() > Date.now()
  );
  const spentBeforeRetry = designCalls;
  mode = "success";
  assert.equal((await image(spentCancelId)).templateSource, "fallback");
  assert.equal(designCalls, spentBeforeRetry);
  checks.push(
    "spent cancellation has durable cooldown; an immediate retry cannot spend again"
  );

  mode = "expire";
  const expiredId = await identity();
  assert.equal((await image(expiredId)).templateSource, "fallback");
  assert.equal(
    await db.query.brandOgTemplates.findFirst({
      where: eq(brandOgTemplates.brandSettingsId, expiredId),
    }),
    undefined
  );
  checks.push("expired owner cannot publish a stale template");

  mode = "success";
  const crashedId = await identity();
  const brand = await loadOgBrand(organizationId, crashedId);
  const hash = getOgBrandHash(brand);
  const lease = await Effect.runPromise(
    claimOgDesign(organizationId, crashedId, hash)
  );
  assert.equal(lease.kind, "lease");
  if (lease.kind !== "lease") {
    throw new Error("No fixture lease");
  }
  await recordOgDesignCall(lease.runId, {
    id: crypto.randomUUID(),
    stage: "design",
    requestedModel: "offline",
    status: "running",
  });
  await db
    .update(brandOgDesignRuns)
    .set({ leaseExpiresAt: new Date(0) })
    .where(eq(brandOgDesignRuns.id, lease.runId));
  const retry = await Effect.runPromise(
    claimOgDesign(organizationId, crashedId, hash)
  );
  assert.equal(retry.kind, "unavailable");
  assert.equal(
    (
      await db.query.brandOgDesignRuns.findFirst({
        where: eq(brandOgDesignRuns.id, lease.runId),
      })
    )?.status,
    "abandoned"
  );
  checks.push(
    "crashed worker expiry creates durable backoff, not another paid attempt"
  );

  const ledgerId = await identity();
  const ledgerBrand = await loadOgBrand(organizationId, ledgerId);
  const ledger = await Effect.runPromise(
    claimOgDesign(organizationId, ledgerId, getOgBrandHash(ledgerBrand))
  );
  if (ledger.kind !== "lease") {
    throw new Error("No ledger fixture lease");
  }
  const ai = await import("ai");
  let providerCalls = 0;
  let failProvider = false;
  const gateway = await import("../src/gateway");
  let lookups = 0;
  let costsPending = false;
  mock.module("@notra/ai/gateway", () => ({
    ...gateway,
    enrichRouteMetadata: async (
      route: Parameters<typeof gateway.enrichRouteMetadata>[0]
    ) => {
      lookups++;
      if (costsPending) {
        return route;
      }
      return { ...route, costUsd: 0.013, costSource: "reported" };
    },
  }));
  mock.module("ai", () => ({
    ...ai,
    generateText: async (args: Parameters<typeof ai.generateText>[0]) => {
      assert.equal(
        args.maxRetries,
        0,
        "OG calls must not have hidden SDK retries"
      );
      providerCalls++;
      assert.ok(
        await db.query.brandOgDesignCalls.findFirst({
          where: and(
            eq(brandOgDesignCalls.runId, ledger.runId),
            eq(brandOgDesignCalls.status, "running")
          ),
        })
      );
      if (failProvider) {
        throw new Error("Fixture provider failure");
      }
      return {
        response: { modelId: "anthropic/claude-sonnet-5" },
        totalUsage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
        providerMetadata: { router: {} },
      };
    },
  }));
  const { generateOgModelCall } = await import("../src/utils/og-model-call");
  const params = {
    organizationId,
    onCall: (call: Parameters<typeof recordOgDesignCall>[1]) =>
      recordOgDesignCall(ledger.runId, call),
  };
  await generateOgModelCall(
    { model: "anthropic/claude-sonnet-5", prompt: "offline" },
    "design",
    "anthropic/claude-sonnet-5",
    params
  );
  failProvider = true;
  await assert.rejects(
    generateOgModelCall(
      { model: "anthropic/claude-sonnet-5", prompt: "offline" },
      "review",
      "anthropic/claude-sonnet-5",
      params
    )
  );
  const records = await db.query.brandOgDesignCalls.findMany({
    where: eq(brandOgDesignCalls.runId, ledger.runId),
  });
  assert.equal(records.length, 2);
  assert.equal(
    records.find((row) => row.status === "failed")?.estimatedCostUsd,
    null
  );
  assert.equal(
    records.find((row) => row.status === "failed")?.reportedCostUsd,
    null
  );
  assert.ok(
    (records.find((row) => row.status === "completed")?.estimatedCostUsd ?? 0) >
      0
  );
  const completed = records.find((row) => row.status === "completed");
  if (!completed) {
    throw new Error("Missing completed call");
  }
  await db
    .update(brandOgDesignCalls)
    .set({
      route: {
        gateway: "vercel",
        requestedModel: "anthropic/claude-sonnet-5",
        model: "anthropic/claude-sonnet-5",
        reason: "free",
        generationId: "fixture-generation",
      },
    })
    .where(eq(brandOgDesignCalls.id, completed.id));
  await Effect.runPromise(reconcileOgDesignCosts("wrong-org", ledger.runId));
  assert.equal(lookups, 0);
  await Effect.runPromise(reconcileOgDesignCosts(organizationId, ledger.runId));
  assert.equal(lookups, 1);
  assert.equal(
    (
      await db.query.brandOgDesignCalls.findFirst({
        where: eq(brandOgDesignCalls.id, completed.id),
      })
    )?.reportedCostUsd,
    0.013
  );
  await db
    .update(brandOgDesignCalls)
    .set({
      reportedCostUsd: null,
      costCheckedAt: null,
      createdAt: new Date(Date.now() - 120_000),
    })
    .where(eq(brandOgDesignCalls.id, completed.id));
  await Effect.runPromise(sweepOgDesignCosts());
  assert.equal(lookups, 2);
  await Effect.runPromise(sweepOgDesignCosts());
  assert.equal(lookups, 2);
  checks.push(
    "later cost sweep retries pending gateway IDs and skips already reported costs"
  );
  costsPending = true;
  await db
    .update(brandOgDesignCalls)
    .set({ reportedCostUsd: null, costCheckedAt: null })
    .where(eq(brandOgDesignCalls.id, completed.id));
  await Effect.runPromise(sweepOgDesignCosts());
  assert.equal(lookups, 3);
  await Effect.runPromise(sweepOgDesignCosts());
  assert.equal(lookups, 3);
  await db
    .update(brandOgDesignCalls)
    .set({ costCheckedAt: new Date(Date.now() - 61 * 60_000) })
    .where(eq(brandOgDesignCalls.id, completed.id));
  await Effect.runPromise(sweepOgDesignCosts());
  assert.equal(lookups, 4);
  costsPending = false;
  await db
    .update(brandOgDesignCalls)
    .set({
      costCheckedAt: null,
      reportedCostUsd: null,
      route: { generationId: "invalid-fixture-route", gateway: "unknown" },
    })
    .where(eq(brandOgDesignCalls.id, completed.id));
  assert.equal((await Effect.runPromise(sweepOgDesignCosts())).runs, 1);
  assert.equal((await Effect.runPromise(sweepOgDesignCosts())).runs, 0);
  assert.equal(lookups, 4);
  checks.push(
    "missing gateway costs retry at most hourly, not on every monitoring tick; SDK retries disabled"
  );
  const spent = providerCalls;
  failProvider = false;
  let delivered = 0;
  await assert.rejects(
    generateOgModelCall(
      { model: "anthropic/claude-sonnet-5", prompt: "offline" },
      "design",
      "anthropic/claude-sonnet-5",
      {
        organizationId,
        onUsage: () => {
          delivered++;
        },
        onCall: async (call) => {
          if (call.status !== "running") {
            throw new Error("Fixture completion persistence failure");
          }
          await recordOgDesignCall(ledger.runId, call);
        },
      }
    )
  );
  assert.equal(delivered, 1);
  assert.equal(providerCalls, spent + 1);
  await assert.rejects(
    generateOgModelCall(
      { model: "anthropic/claude-sonnet-5", prompt: "offline" },
      "design",
      "anthropic/claude-sonnet-5",
      {
        ...params,
        onUsage: () => {
          throw new Error("Fixture observer failure");
        },
      }
    ),
    (error) => error instanceof Error && error.name === "OgAccountingError"
  );
  assert.equal(providerCalls, spent + 2);
  await assert.rejects(
    generateOgModelCall(
      { model: "anthropic/claude-sonnet-5", prompt: "offline" },
      "design",
      "anthropic/claude-sonnet-5",
      {
        organizationId,
        onCall: async () => {
          throw new Error("Fixture DB failure");
        },
      }
    )
  );
  assert.equal(providerCalls, spent + 2);
  await Effect.runPromise(finishOgDesign(ledger.runId, "failed"));
  await assert.rejects(
    generateOgModelCall(
      { model: "anthropic/claude-sonnet-5", prompt: "offline" },
      "design",
      "anthropic/claude-sonnet-5",
      params
    )
  );
  assert.equal(providerCalls, spent + 2);
  checks.push(
    "post-provider DB failure still delivers usage; observer failure is fatal without a second model call"
  );
  checks.push(
    "ledger precedes spending; failures unknown, not zero; reconciliation is tenant-scoped; no spend after accounting failure/lost lease"
  );
  const url = await import("@notra/utils/url");
  for (const unsafe of [
    "http://127.0.0.1",
    "http://169.254.169.254",
    "file:///etc/passwd",
  ]) {
    assert.throws(() => url.assertPublicHttpUrl(unsafe));
  }
  const { validateOgFontBounds } = await import("../src/utils/og-font");
  assert.throws(() => validateOgFontBounds(Buffer.alloc(8_000_001)));
  assert.throws(() => validateOgFontBounds(Buffer.alloc(4)));
  checks.push(
    "private/unsupported asset URLs and oversized/truncated fonts are rejected"
  );

  let styleguideCalls = 0;
  let styleguideUnavailable = false;
  const fontLinks = [
    { family: "Saved Sans", files: { "400": "https://example.com/brand.ttf" } },
  ];
  mock.module("@notra/utils/url", () => ({
    ...url,
    assertPublicHttpUrlResolution: async () => undefined,
  }));
  mock.module("@notra/ai/utils/context-dev", () => ({
    retrieveStyleguide: async () => {
      styleguideCalls++;
      if (styleguideUnavailable) {
        throw new Error("Fixture lookup unavailable");
      }
      return {
        styleguide: {
          colors: ["discovered"],
          typography: ["discovered"],
          fontLinks,
        },
      };
    },
    retrieveBrand: async () => {
      throw new Error("Saved logos must be reused");
    },
    captureScreenshot: async () => {
      throw new Error("Saved screenshot must be reused");
    },
  }));
  mock.module("@notra/ai/utils/og-fetch", () => ({
    fetchOgResource: async () => ({
      bytes: Buffer.from("<html></html>"),
      contentType: "text/html",
      url: "https://example.com",
    }),
  }));
  const { researchOgBrand } = await import("../src/utils/og-research");
  const saved = {
    colors: [{ hex: "#123456" }],
    fonts: [{ family: "Saved Sans", weight: 400 }],
    screenshots: [
      { url: "https://example.com/screenshot.png", capturedAt: new Date() },
    ],
  };
  const researchBrand = {
    id: "offline",
    name: "Offline",
    websiteUrl: "https://example.com",
    assets: [
      {
        id: "logo",
        url: "https://example.com/logo.svg",
        label: "Official logo",
      },
    ],
    guideline: saved,
  };
  const researched = await researchOgBrand(researchBrand);
  assert.equal(styleguideCalls, 1);
  assert.deepEqual(researched.styleguide, {
    colors: saved.colors,
    typography: saved.fonts,
    fontLinks: [
      {
        family: "Saved Sans",
        files: [{ url: "https://example.com/brand.ttf", weights: ["400"] }],
      },
    ],
  });
  assert.equal(researched.screenshot, saved.screenshots[0]?.url);
  assert.deepEqual(researched.warnings, []);
  styleguideUnavailable = true;
  const degraded = await researchOgBrand(researchBrand);
  assert.deepEqual(degraded.styleguide, {
    colors: saved.colors,
    typography: saved.fonts,
  });
  assert.ok(degraded.warnings.includes("Public styleguide unavailable."));
  checks.push(
    "saved typography retains discovered font downloads without overriding saved choices; lookup outages retain saved evidence"
  );
  console.log(
    JSON.stringify({ passed: true, paidProviderCalls: 0, checks }, null, 2)
  );
} finally {
  await client.close();
}
