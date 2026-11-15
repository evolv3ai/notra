import { afterEach, expect, test } from "bun:test";

import {
  deleteTestSnapshot,
  sweepStaleTestSnapshots,
} from "../utils/box-snapshot";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(snapshots: unknown[]) {
  const deletes: unknown[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      deletes.push(JSON.parse(String(init.body)));
      return new Response("{}");
    }
    return Response.json({ snapshots });
  }) as typeof fetch;
  return deletes;
}

test("snapshot deletion refuses anything but one exact ID", async () => {
  const deletes = stubFetch([]);
  for (const id of [undefined, null, "", "a b", 42, ["id"]]) {
    await expect(deleteTestSnapshot(id, "key")).rejects.toThrow(
      "without an exact ID"
    );
  }
  expect(deletes).toEqual([]);
  await deleteTestSnapshot("5f954207-49b3-4993-8d8b-ded578e336c9", "key");
  expect(deletes).toEqual([{ ids: ["5f954207-49b3-4993-8d8b-ded578e336c9"] }]);
});

test("the stale sweep only deletes old lifecycle snapshots with an ID", async () => {
  const old = Date.now() / 1000 - 3 * 60 * 60;
  const deletes = stubFetch([
    {
      id: "keep-fresh",
      name: "notra-sites-e2e-lifecycle-a",
      created_at: Date.now() / 1000,
    },
    { id: "keep-prod", name: "notra-sites-toolchain-a", created_at: old },
    { name: "notra-sites-e2e-lifecycle-b", created_at: old },
    { id: "drop-me", name: "notra-sites-e2e-lifecycle-c", created_at: old },
  ]);
  expect(await sweepStaleTestSnapshots("key")).toBe(1);
  expect(deletes).toEqual([{ ids: ["drop-me"] }]);
});
