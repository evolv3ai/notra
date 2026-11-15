import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import assert from "node:assert/strict";

import { geoMentionChecks, geoScans, geoSettings } from "@notra/db/schema";
import { eq } from "drizzle-orm";
import { Effect, Exit, Fiber } from "effect";
import { TestClock } from "effect/testing";

import {
  GEO_SEQUENCE_PAIR_TIMEOUT_MS,
  GEO_SEQUENCE_MAX_TURNS,
  GEO_PAID_CODING_AGENT_ENGINE_IDS,
  GEO_SCAN_BILLING_LOCK_TTL_MS,
} from "../src/constants/geo";
import {
  GeoContentBillingService,
  GeoEntitlementService,
  GeoCodingAgentAccessService,
  GeoModelService,
} from "../src/deps";
import { GeoJudgeError, GeoCodingAgentAccessError } from "../src/geo/errors";
import { geoSettingsUpsertInputSchema } from "../src/schemas/geo";
import type { FinalizeContentBillingInput } from "../src/types/content-billing";
import type {
  GeoScanProjectContext,
  GeoScanPlannedTask,
} from "../src/types/geo";
import {
  seedGeoModelCatalog,
  withoutGeoModelCatalogEntries,
} from "../src/utils/geo-model-catalog";
import { geoScanAnswerKey } from "../src/utils/geo-scan-plan";
import { fakeModels, testBillingGate } from "./constants/geo-boundaries";
import {
  codingAgentAnswer,
  withCodingAgentModels,
} from "./utils/coding-agents";
import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  settingsFor,
  testDb,
} from "./utils/database";
import { deferred } from "./utils/deferred";
import {
  mockAskGeoOpenCode,
  mockAskGeoOpenCodeConversation,
} from "./utils/infrastructure";

mock.module("../src/geo/cursor", () => ({
  askCursorEngine: () => Effect.die("Denied plan reached Cursor"),
}));

const {
  prepareGeoScanProject,
  runGeoScanTaskBatch,
  runGeoScanSequenceBatch,
  finalizeGeoScanProject,
} = await import("../src/geo/scan");
const { claimGeoScanRun } = await import("../src/geo/scan-status");
const { upsertGeoSettings } = await import("../src/geo/programs");
const catalogModule = await import("../src/geo/model-catalog");
const envKeys = [
  "UPSTASH_BOX_API_KEY",
  "OPENROUTER_API_KEY",
  "AI_GATEWAY_API_KEY",
] as const;
const originalEnv = envKeys.map((key) => process.env[key]);

beforeAll(async () => {
  for (const key of envKeys) {
    process.env[key] = "test-only-never-sent";
  }
  await initializeDatabase();
}, 30_000);
afterAll(async () => {
  for (const [index, key] of envKeys.entries()) {
    if (originalEnv[index] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[index];
    }
  }
  await database.postgres.close();
});
beforeEach(async () => {
  await resetDatabase();
  mockAskGeoOpenCode.mockReset();
  mockAskGeoOpenCode.mockImplementation(async () => codingAgentAnswer());
  mockAskGeoOpenCodeConversation.mockReset();
  mockAskGeoOpenCodeConversation.mockImplementation(async (prompts) =>
    prompts.map(() => codingAgentAnswer())
  );
});

describe("coding-agent task scans", () => {
  test.each(["unpaid", "billing failure"])(
    "%s blocks saved coding-agent tasks and sequences before provider calls",
    async (failure) => {
      const scope = await seedProject("denied-coding-agents");
      const context: GeoScanProjectContext = {
        ...scope,
        scanId: "denied-coding-agents-scan",
        runId: "run",
        companyName: "Notra",
        aliases: [],
        gate: testBillingGate,
        startedAtMs: Date.now(),
      };
      await testDb.insert(geoScans).values({ id: context.scanId, ...scope });
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const tasks = yield* runGeoScanTaskBatch(
            context,
            GEO_PAID_CODING_AGENT_ENGINE_IDS.map((engine) => ({
              engine,
              groundedKey: null,
              prompt: { id: engine, text: "question" },
              language: "English",
              zdr: "none" as const,
            }))
          );
          const sequences = yield* runGeoScanSequenceBatch(context, [
            {
              sequenceId: "sequence",
              steps: ["first", "second"],
              language: "English",
              engine: "codex/gpt-6-astra",
              groundedKey: null,
              zdr: "none",
            },
          ]);
          return { tasks, sequences };
        }).pipe(
          Effect.provideService(GeoModelService, fakeModels),
          Effect.provideService(GeoCodingAgentAccessService, {
            hasPaidPlanForOrganization: () =>
              failure === "billing failure"
                ? Effect.fail(
                    new GeoCodingAgentAccessError({
                      cause: new Error("billing unavailable"),
                    })
                  )
                : Effect.succeed(false),
          })
        )
      );
      expect(result.tasks).toMatchObject({
        checks: 0,
        dropped: GEO_PAID_CODING_AGENT_ENGINE_IDS.length,
        engineUsage: { totalUsd: 0 },
      });
      expect(result.sequences).toMatchObject({
        checks: 0,
        dropped: 2,
        engineUsage: { totalUsd: 0 },
      });
      expect(mockAskGeoOpenCode).not.toHaveBeenCalled();
      expect(mockAskGeoOpenCodeConversation).not.toHaveBeenCalled();
      expect(await testDb.select().from(geoMentionChecks)).toHaveLength(0);
    }
  );
  test("a native task persists source and token accounting", async () => {
    const engine = "codex/gpt-6-astra";
    const scope = await seedProject("native-task");
    const context: GeoScanProjectContext = {
      ...scope,
      scanId: "native-scan",
      runId: "native-run",
      companyName: "Notra",
      aliases: [],
      websiteUrl: "https://example.com",
      gate: testBillingGate,
      startedAtMs: Date.now(),
    };
    await testDb.insert(geoScans).values({ id: context.scanId, ...scope });
    const before = Date.now();
    const result = await Effect.runPromise(
      runGeoScanTaskBatch(context, [
        {
          engine,
          groundedKey: null,
          prompt: { id: "question", text: "Which tools should I use?" },
          language: "German",
          zdr: "none",
        },
      ]).pipe(withCodingAgentModels(fakeModels))
    );
    expect(mockAskGeoOpenCode).toHaveBeenCalledTimes(1);
    const call = mockAskGeoOpenCode.mock.calls[0];
    expect(call?.[0]).toContain("User question:\nWhich tools should I use?");
    expect(call?.[1]).toBeInstanceOf(AbortSignal);
    expect(call?.[2]).toBeGreaterThan(before);
    expect(call?.[3]).toBe("openai/gpt-6-astra");
    expect(call?.[4]).toBe("codex");
    expect(result).toMatchObject({
      checks: 1,
      mentions: 1,
      dropped: 0,
      engineUsage: {
        inputTokens: 70,
        outputTokens: 40,
        cacheReadTokens: 20,
        cacheWriteTokens: 10,
        reasoningTokens: 15,
        totalTokens: 140,
        totalUsd: 0.25,
      },
    });
    const [row] = await testDb.select().from(geoMentionChecks);
    expect(row).toMatchObject({
      ...scope,
      scanId: context.scanId,
      engine,
      language: "German",
      ownedSourceCited: true,
      promptTokens: 100,
      outputTokens: 40,
      reasoningTokens: 15,
      costUsd: 0.25,
      zdrEnforced: false,
      finishReason: "stop",
      sources: [{ url: "https://docs.example.com/guide", title: null }],
      grounding: {
        queries: ["content generation tools"],
        sources: [
          { url: "https://example.com/search-result", domain: "example.com" },
          {
            url: "https://docs.example.com/guide",
            domain: "docs.example.com",
          },
        ],
      },
    });
  });

  test.each(["empty", "judge failure"])(
    "%s preserves paid native usage while dropping only that check",
    async (failure) => {
      const scope = await seedProject("dropped-native");
      const context: GeoScanProjectContext = {
        ...scope,
        scanId: "dropped-scan",
        runId: "run",
        companyName: "Notra",
        aliases: [],
        gate: testBillingGate,
        startedAtMs: Date.now(),
      };
      await testDb.insert(geoScans).values({ id: context.scanId, ...scope });
      mockAskGeoOpenCode.mockImplementation(async () =>
        codingAgentAnswer(failure === "empty" ? " \n" : undefined)
      );
      const result = await Effect.runPromise(
        runGeoScanTaskBatch(context, [
          {
            engine: "codex/gpt-6-astra",
            groundedKey: null,
            prompt: { id: "bad", text: "question" },
            language: "English",
            zdr: "none",
          },
        ]).pipe(
          withCodingAgentModels({
            ...fakeModels,
            judge: () =>
              Effect.fail(
                new GeoJudgeError({
                  message: "judge unavailable",
                  cause: undefined,
                })
              ),
          })
        )
      );
      expect(result).toMatchObject({
        checks: 0,
        dropped: 1,
        engineUsage: { totalUsd: 0.25, totalTokens: 140 },
        judgeUsage: { totalUsd: 0 },
      });
      expect(mockAskGeoOpenCode).toHaveBeenCalledTimes(1);
      expect(await testDb.select().from(geoMentionChecks)).toHaveLength(0);
    }
  );

  test.each(["provider refusal", "native timeout"])(
    "%s has bounded retries and cannot discard a successful sibling",
    async (failure) => {
      const scope = await seedProject("native-partial");
      const context: GeoScanProjectContext = {
        ...scope,
        scanId: "partial-scan",
        runId: "run",
        companyName: "Notra",
        aliases: [],
        gate: testBillingGate,
        startedAtMs: Date.now(),
      };
      await testDb.insert(geoScans).values({ id: context.scanId, ...scope });
      mockAskGeoOpenCode.mockImplementation(async (prompt) => {
        if (prompt.endsWith("bad")) {
          throw failure === "native timeout"
            ? new DOMException("deadline exceeded", "TimeoutError")
            : new Error("provider refused");
        }
        return codingAgentAnswer();
      });
      const result = await Effect.runPromise(
        runGeoScanTaskBatch(
          context,
          ["good", "bad"].map((id): GeoScanPlannedTask => ({
            engine: "codex/gpt-6-astra",
            groundedKey: null,
            prompt: { id, text: id },
            language: "English",
            zdr: "none",
          }))
        ).pipe(withCodingAgentModels(fakeModels))
      );
      expect(result).toMatchObject({
        checks: 1,
        dropped: 1,
        engineUsage: { totalUsd: 0.25 },
      });
      expect(
        mockAskGeoOpenCode.mock.calls.filter(([prompt]) =>
          prompt.endsWith("bad")
        )
      ).toHaveLength(failure === "native timeout" ? 2 : 1);
      const rows = await testDb.select().from(geoMentionChecks);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.promptId).toBe("good");
    }
  );

  test("cancellation aborts the native signal and waits for cleanup without retrying or storing an answer", async () => {
    const scope = await seedProject("cancel-native");
    const started = deferred<void>();
    const aborted = deferred<void>();
    const cleanup = deferred<void>();
    mockAskGeoOpenCode.mockImplementation(async (_prompt, signal) => {
      assert.ok(signal);
      signal.addEventListener("abort", () => aborted.resolve(), { once: true });
      started.resolve();
      await cleanup.promise;
      throw new DOMException("cancelled", "AbortError");
    });
    const controller = new AbortController();
    let settled = false;
    const result = Effect.runPromiseExit(
      runGeoScanTaskBatch(
        {
          ...scope,
          scanId: "cancel-scan",
          runId: "run",
          companyName: "Notra",
          aliases: [],
          gate: testBillingGate,
          startedAtMs: Date.now(),
        },
        [
          {
            engine: "codex/gpt-6-astra",
            groundedKey: null,
            prompt: { id: "cancel", text: "question" },
            language: "English",
            zdr: "none",
          },
        ]
      ).pipe(withCodingAgentModels(fakeModels)),
      { signal: controller.signal }
    ).then((exit) => {
      settled = true;
      return exit;
    });
    await started.promise;
    controller.abort();
    await aborted.promise;
    expect(settled).toBe(false);
    cleanup.resolve();
    expect(Exit.isFailure(await result)).toBe(true);
    expect(mockAskGeoOpenCode).toHaveBeenCalledTimes(1);
    expect(await testDb.select().from(geoMentionChecks)).toHaveLength(0);
  });
});

describe("coding-agent conversation scans", () => {
  test.each(["expired deadline", "first turn"])(
    "retains completed native usage after a %s failure",
    async (failure) => {
      const scope = await seedProject("provider-partial-sequence");
      const context: GeoScanProjectContext = {
        ...scope,
        scanId: "provider-partial-sequence-scan",
        runId: "run",
        companyName: "Notra",
        aliases: [],
        gate: testBillingGate,
        startedAtMs: Date.now(),
      };
      await testDb.insert(geoScans).values({ id: context.scanId, ...scope });
      const now = Date.now();
      const clock =
        failure === "expired deadline"
          ? spyOn(Date, "now").mockReturnValue(now)
          : null;
      mockAskGeoOpenCodeConversation.mockImplementation(
        async (_prompts, _signal, _deadline, _model, _harness, onResult) => {
          if (failure !== "first turn") {
            onResult?.(codingAgentAnswer());
          }
          if (failure === "expired deadline") {
            clock?.mockReturnValue(now + GEO_SEQUENCE_PAIR_TIMEOUT_MS + 1);
            throw new DOMException("later turn timed out", "TimeoutError");
          }
          throw new Error(`${failure} failed`);
        }
      );
      try {
        const result = await Effect.runPromise(
          runGeoScanSequenceBatch(context, [
            {
              sequenceId: "sequence",
              steps: ["first", "second", "third"],
              language: "English",
              engine: "codex/gpt-6-astra",
              groundedKey: null,
              zdr: "none",
            },
          ]).pipe(withCodingAgentModels(fakeModels))
        );
        expect(result).toMatchObject({
          checks: 0,
          dropped: 3,
          engineUsage: { totalUsd: failure === "first turn" ? 0 : 0.25 },
        });
        expect(await testDb.select().from(geoMentionChecks)).toHaveLength(0);
        expect(mockAskGeoOpenCodeConversation).toHaveBeenCalledTimes(1);
      } finally {
        clock?.mockRestore();
      }
    }
  );

  test.each(["empty", "judge failure", "missing result", "expired deadline"])(
    "%s retains the first valid turn and marks only the remaining turns failed",
    async (failure) => {
      const scope = await seedProject("partial-sequence");
      const context: GeoScanProjectContext = {
        ...scope,
        scanId: "partial-sequence-scan",
        runId: "run",
        companyName: "Notra",
        aliases: [],
        gate: testBillingGate,
        startedAtMs: Date.now(),
      };
      const engine = "codex/gpt-6-astra";
      await testDb.insert(geoScans).values({
        id: context.scanId,
        ...scope,
        plan: {
          totalChecks: 3,
          promptCount: 0,
          sequenceCount: 1,
          engines: [engine],
          languages: ["English"],
          taskStates: {},
        },
      });
      mockAskGeoOpenCodeConversation.mockImplementation(async () =>
        failure === "missing result"
          ? [codingAgentAnswer()]
          : [
              codingAgentAnswer(),
              codingAgentAnswer(failure === "empty" ? "" : undefined),
              codingAgentAnswer(),
            ]
      );
      let judgments = 0;
      const now = Date.now();
      const clock =
        failure === "expired deadline"
          ? spyOn(Date, "now").mockReturnValue(now)
          : null;
      try {
        const result = await Effect.runPromise(
          runGeoScanSequenceBatch(context, [
            {
              sequenceId: "sequence",
              steps: ["first", "second", "third"],
              language: "English",
              engine,
              groundedKey: null,
              zdr: "none",
            },
          ]).pipe(
            withCodingAgentModels({
              ...fakeModels,
              judge: (input) =>
                Effect.suspend(() => {
                  judgments += 1;
                  if (failure === "expired deadline" && judgments === 1) {
                    clock?.mockReturnValue(
                      now + GEO_SEQUENCE_PAIR_TIMEOUT_MS + 1
                    );
                  }
                  return failure === "judge failure" && judgments === 2
                    ? Effect.fail(
                        new GeoJudgeError({
                          message: "judge unavailable",
                          cause: undefined,
                        })
                      )
                    : fakeModels.judge(input);
                }),
            })
          )
        );
        expect(result).toMatchObject({
          checks: 1,
          dropped: 2,
          engineUsage: { totalUsd: failure === "missing result" ? 0.25 : 0.75 },
        });
        const rows = await testDb.select().from(geoMentionChecks);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ turn: 1, prompt: "first" });
        const scan = await testDb.query.geoScans.findFirst();
        expect(
          scan?.plan?.taskStates?.[
            geoScanAnswerKey("sequence-sequence", engine, "English", 2)
          ]
        ).toBe("failed");
        expect(
          scan?.plan?.taskStates?.[
            geoScanAnswerKey("sequence-sequence", engine, "English", 3)
          ]
        ).toBe("failed");
      } finally {
        clock?.mockRestore();
      }
    }
  );

  test("a judge deadline timeout retains earlier turns and all native usage", async () => {
    const scope = await seedProject("judge-timeout");
    const context: GeoScanProjectContext = {
      ...scope,
      scanId: "judge-timeout-scan",
      runId: "run",
      companyName: "Notra",
      aliases: [],
      gate: testBillingGate,
      startedAtMs: Date.now(),
    };
    await testDb.insert(geoScans).values({ id: context.scanId, ...scope });
    const started = deferred<void>();
    let judgments = 0;
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* runGeoScanSequenceBatch(context, [
          {
            sequenceId: "sequence",
            steps: ["first", "second"],
            language: "English",
            engine: "codex/gpt-6-astra",
            groundedKey: null,
            zdr: "none",
          },
        ]).pipe(
          withCodingAgentModels({
            ...fakeModels,
            judge: (input) =>
              Effect.suspend(() => {
                judgments += 1;
                if (judgments === 2) {
                  started.resolve();
                  return Effect.never;
                }
                return fakeModels.judge(input);
              }),
          }),
          Effect.forkChild
        );
        yield* Effect.promise(() => started.promise);
        yield* TestClock.adjust(GEO_SEQUENCE_PAIR_TIMEOUT_MS + 1000);
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestClock.layer()))
    );
    expect(result).toMatchObject({
      checks: 1,
      dropped: 1,
      engineUsage: { totalUsd: 0.5 },
    });
    expect(await testDb.select().from(geoMentionChecks)).toHaveLength(1);
  });

  test("conversation length is capped before the paid invocation", async () => {
    const scope = await seedProject("sequence-cap");
    await testDb.insert(geoScans).values({ id: "cap-scan", ...scope });
    const result = await Effect.runPromise(
      runGeoScanSequenceBatch(
        {
          ...scope,
          scanId: "cap-scan",
          runId: "run",
          companyName: "Notra",
          aliases: [],
          gate: testBillingGate,
          startedAtMs: Date.now(),
        },
        [
          {
            sequenceId: "sequence",
            steps: Array.from(
              { length: GEO_SEQUENCE_MAX_TURNS + 3 },
              (_, index) => `question ${index}`
            ),
            language: "English",
            engine: "codex/gpt-6-astra",
            groundedKey: null,
            zdr: "none",
          },
        ]
      ).pipe(withCodingAgentModels(fakeModels))
    );
    expect(mockAskGeoOpenCodeConversation.mock.calls[0]?.[0]).toHaveLength(
      GEO_SEQUENCE_MAX_TURNS
    );
    expect(result.checks).toBe(GEO_SEQUENCE_MAX_TURNS);
    expect(result.dropped).toBe(0);
  });
});

describe("coding-agent planning and billing", () => {
  test.each([true, false])(
    "an empty visible selection preserves hidden engines=%s without enabling defaults",
    async (hasHiddenEngines) => {
      const stored = hasHiddenEngines
        ? ["codex/gpt-6-astra"]
        : ["openai/gpt-5.4-mini"];
      const scope = await seedProject("unavailable-settings");
      await testDb
        .update(geoSettings)
        .set({ engines: stored })
        .where(eq(geoSettings.projectId, scope.projectId));
      const catalog = withoutGeoModelCatalogEntries(
        seedGeoModelCatalog(),
        GEO_PAID_CODING_AGENT_ENGINE_IDS
      );
      const lookup = spyOn(
        catalogModule,
        "loadGeoModelCatalog"
      ).mockImplementation(() =>
        Effect.succeed({
          ...catalog,
          models: catalog.models.map((model) => ({
            ...model,
            supportsGroundedChecks: false,
          })),
        })
      );
      try {
        const input = geoSettingsUpsertInputSchema.parse({
          ...scope,
          companyName: "Updated name",
          aliases: [],
          competitors: [],
          languages: ["English"],
          engines: [],
          enforceZdr: false,
          nonZdrApprovedEngines: [],
          enabled: true,
          scanIntervalHours: 24,
        });
        const result = Effect.runPromise(
          upsertGeoSettings(input).pipe(
            Effect.provideService(GeoEntitlementService, {
              resolveZdrEntitlement: () => Effect.succeed("not_entitled"),
              checkScanBilling: () => Effect.die("Settings reached billing"),
            }),
            withCodingAgentModels(fakeModels)
          )
        );
        if (hasHiddenEngines) {
          expect((await result).settings?.engines).toEqual([]);
          expect((await settingsFor(scope.projectId))?.companyName).toBe(
            "Updated name"
          );
        } else {
          await expect(result).rejects.toMatchObject({
            _tag: "GeoSettingsTrackingError",
          });
        }
        expect((await settingsFor(scope.projectId))?.engines).toEqual(stored);
      } finally {
        lookup.mockRestore();
      }
    }
  );
  test("enforced ZDR skips unapproved native engines and releases the billing reservation", async () => {
    const scope = await seedProject("native-zdr", { enabled: true });
    await testDb
      .update(geoSettings)
      .set({
        engines: ["codex/gpt-6-astra"],
        enforceZdr: true,
        nonZdrApprovedEngines: [],
      })
      .where(eq(geoSettings.projectId, scope.projectId));
    const finalized: FinalizeContentBillingInput[] = [];
    const result = await Effect.runPromise(
      prepareGeoScanProject(scope.organizationId, scope.projectId, {
        engines: ["codex/gpt-6-astra"],
      }).pipe(
        Effect.provideService(GeoContentBillingService, {
          gateContentBilling: (input) => {
            expect(input.lockTtlMs).toBe(GEO_SCAN_BILLING_LOCK_TTL_MS);
            expect(input.lockTtlMs).toBe(24 * 60 * 60 * 1000);
            return Effect.succeed(testBillingGate);
          },
          finalizeContentBilling: (input) =>
            Effect.sync(() => {
              finalized.push(input);
            }),
        }),
        Effect.provideService(GeoEntitlementService, {
          resolveZdrEntitlement: () => Effect.succeed("entitled"),
          checkScanBilling: () => Effect.die("Unexpected check"),
        }),
        withCodingAgentModels(fakeModels)
      )
    );
    expect(result).toEqual({ status: "skipped", reason: "zdr" });
    expect(finalized.map((input) => input.action)).toEqual(["release"]);
    expect((await settingsFor(scope.projectId))?.scanStartedAt).toBeNull();
    expect((await testDb.query.geoScans.findFirst())?.status).toBe("failed");
  });

  test("another organization cannot prepare the project's coding-agent scan or reserve billing", async () => {
    const scope = await seedProject("native-owner", { enabled: true });
    const result = await Effect.runPromise(
      prepareGeoScanProject("other-org", scope.projectId, {
        engines: ["codex/gpt-6-astra"],
      }).pipe(
        Effect.provideService(GeoContentBillingService, {
          gateContentBilling: () =>
            Effect.die("Foreign organization reached billing"),
          finalizeContentBilling: () =>
            Effect.die("Foreign organization reached settlement"),
        }),
        Effect.provideService(GeoEntitlementService, {
          resolveZdrEntitlement: () => Effect.die("Unexpected entitlement"),
          checkScanBilling: () => Effect.die("Unexpected check"),
        }),
        withCodingAgentModels(fakeModels)
      )
    );
    expect(result).toEqual({ status: "skipped", reason: "disabled" });
    expect(await testDb.select().from(geoScans)).toHaveLength(0);
    expect((await settingsFor(scope.projectId))?.scanStartedAt).toBeNull();
  });

  test("a failed partial native scan bills stored answers and includes paid dropped-turn usage", async () => {
    const scope = await seedProject("partial-billing");
    const claim = await Effect.runPromise(claimGeoScanRun(scope.projectId));
    assert.ok(claim);
    const context: GeoScanProjectContext = {
      ...scope,
      scanId: "billing-scan",
      runId: "run",
      companyName: "Notra",
      aliases: [],
      gate: testBillingGate,
      startedAtMs: Date.now(),
    };
    await testDb.insert(geoScans).values({ id: context.scanId, ...scope });
    mockAskGeoOpenCodeConversation.mockImplementation(async () => [
      codingAgentAnswer(),
      codingAgentAnswer(""),
    ]);
    const totals = await Effect.runPromise(
      runGeoScanSequenceBatch(context, [
        {
          sequenceId: "sequence",
          steps: ["first", "second"],
          language: "English",
          engine: "codex/gpt-6-astra",
          groundedKey: null,
          zdr: "none",
        },
      ]).pipe(withCodingAgentModels(fakeModels))
    );
    const finalized: FinalizeContentBillingInput[] = [];
    await Effect.runPromise(
      finalizeGeoScanProject(
        context,
        totals,
        "failed",
        claim.claimedAt.toISOString()
      ).pipe(
        Effect.provideService(GeoContentBillingService, {
          gateContentBilling: () => Effect.die("Unexpected gate"),
          finalizeContentBilling: (input) =>
            Effect.sync(() => {
              finalized.push(input);
            }),
        })
      )
    );
    expect(finalized).toHaveLength(1);
    expect(finalized[0]).toMatchObject({
      action: "confirm",
      units: 1,
      usage: { totalUsd: 0.5, totalTokens: 280 },
    });
    const scan = await testDb.query.geoScans.findFirst();
    expect(scan).toMatchObject({
      status: "failed",
      checksTotal: 2,
      checksFailed: 1,
      totalUsd: 0.5,
    });
    expect((await settingsFor(scope.projectId))?.scanStartedAt).toBeNull();
  });
});
