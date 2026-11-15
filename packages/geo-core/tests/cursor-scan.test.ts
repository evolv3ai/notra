import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { access } from "node:fs/promises";

import type { Agent } from "@cursor/sdk";
import { geoMentionChecks, geoScans } from "@notra/db/schema";
import { Effect, Exit } from "effect";

import {
  GEO_CURSOR_ENGINE_ID,
  GEO_CURSOR_MODEL_ID,
} from "../src/constants/geo";
import { testBillingGate } from "./constants/geo-boundaries";
import { withCodingAgentModels } from "./utils/coding-agents";
import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  testDb,
} from "./utils/database";
import { deferred } from "./utils/deferred";
import "./utils/infrastructure";

const wait = mock(async () => ({
  status: "finished",
  result: " Notra is a good choice. ",
}));
const cancel = mock(async () => undefined);
const dispose = mock(async () => undefined);
const send = mock(async (_message: string) => ({ wait, cancel }));
const create = mock(async (_input: Parameters<typeof Agent.create>[0]) => ({
  send,
  [Symbol.asyncDispose]: dispose,
}));
mock.module("@cursor/sdk", () => ({
  Agent: { create },
  JsonlLocalAgentStore: mock(function () {
    return {};
  }),
}));

const { askCursorEngine } = await import("../src/geo/cursor");
const { runGeoScanTaskBatch } = await import("../src/geo/scan");
const originalKey = process.env.CURSOR_API_KEY;

beforeAll(async () => {
  process.env.CURSOR_API_KEY = "test-only-never-sent";
  await initializeDatabase();
}, 30_000);
afterAll(async () => {
  if (originalKey === undefined) {
    delete process.env.CURSOR_API_KEY;
  } else {
    process.env.CURSOR_API_KEY = originalKey;
  }
  await database.postgres.close();
});
beforeEach(async () => {
  await resetDatabase();
  wait.mockReset();
  wait.mockImplementation(async () => ({
    status: "finished",
    result: " Notra is a good choice. ",
  }));
  cancel.mockReset();
  dispose.mockReset();
  send.mockReset();
  send.mockImplementation(async () => ({ wait, cancel }));
  create.mockReset();
  create.mockImplementation(async () => ({
    send,
    [Symbol.asyncDispose]: dispose,
  }));
});

describe("Cursor scan adapter security and cleanup", () => {
  test("runs the pinned model with no tools in a disposable working directory", async () => {
    expect(
      await Effect.runPromise(askCursorEngine("Which tools should I use?"))
    ).toBe("Notra is a good choice.");
    expect(create).toHaveBeenCalledTimes(1);
    const input = create.mock.calls[0]?.[0];
    expect(input?.model).toEqual({ id: GEO_CURSOR_MODEL_ID });
    expect(input?.tools).toEqual([]);
    expect(input?.local?.cwd).toContain("geo-cursor-");
    expect(send.mock.calls[0]?.[0]).toContain("Which tools should I use?");
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    await expect(access(input?.local?.cwd ?? "")).rejects.toThrow();
  });

  test.each(["failed", "empty"])(
    "a %s result is rejected and still disposes the agent and working directory",
    async (failure) => {
      wait.mockImplementation(async () => ({
        status: failure === "failed" ? "failed" : "finished",
        result: " \n ",
      }));
      expect(
        Exit.isFailure(await Effect.runPromiseExit(askCursorEngine("question")))
      ).toBe(true);
      expect(dispose).toHaveBeenCalledTimes(1);
      await expect(
        access(create.mock.calls[0]?.[0].local?.cwd ?? "")
      ).rejects.toThrow();
    }
  );

  test("a creation failure still removes the throwaway directory", async () => {
    create.mockImplementation(async () => {
      throw new Error("creation failed");
    });
    expect(
      Exit.isFailure(await Effect.runPromiseExit(askCursorEngine("question")))
    ).toBe(true);
    expect(send).not.toHaveBeenCalled();
    await expect(
      access(create.mock.calls[0]?.[0].local?.cwd ?? "")
    ).rejects.toThrow();
  });

  test("a send failure disposes the created agent and directory", async () => {
    send.mockImplementation(async () => {
      throw new Error("send failed");
    });
    expect(
      Exit.isFailure(await Effect.runPromiseExit(askCursorEngine("question")))
    ).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    await expect(
      access(create.mock.calls[0]?.[0].local?.cwd ?? "")
    ).rejects.toThrow();
  });

  test("cancellation cancels the in-flight run before disposing its agent and directory", async () => {
    const started = deferred<void>();
    const finished = deferred<{ status: string; result: string }>();
    const actions: string[] = [];
    wait.mockImplementation(async () => {
      started.resolve();
      return await finished.promise;
    });
    cancel.mockImplementation(async () => {
      actions.push("cancel");
      finished.resolve({ status: "aborted", result: "" });
    });
    dispose.mockImplementation(async () => {
      actions.push("dispose");
    });
    const controller = new AbortController();
    const result = Effect.runPromiseExit(askCursorEngine("question"), {
      signal: controller.signal,
    });
    await started.promise;
    controller.abort();
    expect(Exit.isFailure(await result)).toBe(true);
    expect(actions).toEqual(["cancel", "dispose"]);
    await expect(
      access(create.mock.calls[0]?.[0].local?.cwd ?? "")
    ).rejects.toThrow();
  });

  test("a Cursor task persists its answer as non-search, non-ZDR, without invented token costs", async () => {
    const scope = await seedProject("cursor-task");
    await testDb.insert(geoScans).values({ id: "cursor-scan", ...scope });
    const result = await Effect.runPromise(
      runGeoScanTaskBatch(
        {
          ...scope,
          scanId: "cursor-scan",
          runId: "run",
          companyName: "Notra",
          aliases: [],
          gate: testBillingGate,
          startedAtMs: Date.now(),
        },
        [
          {
            engine: GEO_CURSOR_ENGINE_ID,
            groundedKey: null,
            prompt: { id: "question", text: "question" },
            language: "English",
            zdr: "none",
          },
        ]
      ).pipe(withCodingAgentModels())
    );
    expect(result).toMatchObject({
      checks: 1,
      dropped: 0,
      engineUsage: { totalTokens: 0, totalUsd: 0 },
    });
    const [row] = await testDb.select().from(geoMentionChecks);
    expect(row).toMatchObject({
      engine: GEO_CURSOR_ENGINE_ID,
      answer: "Notra is a good choice.",
      sources: [],
      grounding: { queries: [], sources: [] },
      zdrEnforced: false,
      promptTokens: null,
      outputTokens: null,
      costUsd: 0,
    });
  });
});
