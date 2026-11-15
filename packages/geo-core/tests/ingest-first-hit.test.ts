import { expect, mock, test } from "bun:test";

import { GEO_INGEST_FIRST_HIT_MEMO_MAX_ENTRIES } from "../src/constants/ingest";

const set = mock(async (): Promise<string | null> => "OK");
mock.module("@notra/ai/utils/redis", () => ({ redis: { set } }));
const { claimFirstIngestHit } =
  await import("../src/utils/claim-first-ingest-hit");

test("first-hit memo coalesces concurrent claims and keeps org/project scopes distinct", async () => {
  set.mockClear();
  const identity = {
    organizationId: "memo-concurrent",
    projectId: "p1",
    generation: 1,
  };
  const results = await Promise.all(
    Array.from({ length: 100 }, () => claimFirstIngestHit(identity))
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(set).toHaveBeenCalledTimes(1);
  expect(await claimFirstIngestHit(identity)).toBe(false);
  expect(set).toHaveBeenCalledTimes(1);
  expect(await claimFirstIngestHit({ ...identity, projectId: "p2" })).toBe(
    true
  );
  expect(
    await claimFirstIngestHit({ ...identity, organizationId: "memo-other-org" })
  ).toBe(true);
  expect(await claimFirstIngestHit({ ...identity, projectId: null })).toBe(
    true
  );
  expect(set).toHaveBeenCalledTimes(4);
});

test("existing durable markers are memoized, failures and unexpected replies are not", async () => {
  set.mockClear();
  set.mockImplementation(async () => null);
  const existing = {
    organizationId: "memo-existing",
    projectId: "p1",
    generation: 1,
  };
  expect(await claimFirstIngestHit(existing)).toBe(false);
  expect(await claimFirstIngestHit(existing)).toBe(false);
  expect(set).toHaveBeenCalledTimes(1);

  const retry = { ...existing, organizationId: "memo-retry" };
  set.mockImplementation(async () => {
    throw new Error("Redis unavailable");
  });
  expect(
    (
      await Promise.all(
        Array.from({ length: 20 }, () => claimFirstIngestHit(retry))
      )
    ).some(Boolean)
  ).toBe(false);
  expect(set).toHaveBeenCalledTimes(2);
  set.mockImplementation(async () => "unexpected");
  expect(await claimFirstIngestHit(retry)).toBe(false);
  set.mockImplementation(async () => "OK");
  expect(await claimFirstIngestHit(retry)).toBe(true);
  expect(await claimFirstIngestHit(retry)).toBe(false);
  expect(set).toHaveBeenCalledTimes(4);
});

test("bounded memo eviction rechecks Redis without producing another first-hit event", async () => {
  set.mockClear();
  set.mockImplementation(async () => null);
  const identity = {
    organizationId: "memo-eviction",
    projectId: "p1",
    generation: 1,
  };
  expect(await claimFirstIngestHit(identity)).toBe(false);
  for (let i = 0; i < GEO_INGEST_FIRST_HIT_MEMO_MAX_ENTRIES; i++) {
    expect(
      await claimFirstIngestHit({
        ...identity,
        organizationId: `memo-bound-${i}`,
      })
    ).toBe(false);
  }
  const before = set.mock.calls.length;
  expect(await claimFirstIngestHit(identity)).toBe(false);
  expect(set.mock.calls.length).toBe(before + 1);
});
