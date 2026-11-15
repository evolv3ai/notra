import { afterAll, expect, mock, test } from "bun:test";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { Context, Deferred, Effect, Fiber } from "effect";

import { geoDb } from "../src/geo/effect";
import { GeoPromptDuplicateError } from "../src/geo/errors";

const postgres = new PGlite();
const database = drizzle(postgres);
mock.module("@notra/db/drizzle", () => ({ db: database }));

const { geoTransaction } = await import("../src/geo/transaction");

await postgres.exec("CREATE TABLE tx_rows (id text PRIMARY KEY)");

afterAll(async () => {
  await postgres.close();
});

const Marker = Context.Service<{ readonly value: string }>("TxMarker");

const insertRow = (
  tx: Parameters<Parameters<typeof geoTransaction>[1]>[0],
  id: string
) =>
  geoDb("insert failed", () =>
    tx.execute(sql`INSERT INTO tx_rows (id) VALUES (${id})`)
  );

const rowIds = async () =>
  (
    await postgres.query<{ id: string }>("SELECT id FROM tx_rows ORDER BY id")
  ).rows.map((row) => row.id);

test("geoTransaction commits on success and keeps the caller's services", async () => {
  const value = await Effect.runPromise(
    geoTransaction("tx failed", (tx) =>
      Effect.gen(function* () {
        yield* insertRow(tx, "committed");
        const marker = yield* Marker;
        return marker.value;
      })
    ).pipe(Effect.provideService(Marker, { value: "from-outside" }))
  );

  expect(value).toBe("from-outside");
  expect(await rowIds()).toContain("committed");
});

test("geoTransaction rolls back and keeps a typed failure", async () => {
  const error = await Effect.runPromise(
    geoTransaction("tx failed", (tx) =>
      insertRow(tx, "rolled-back").pipe(
        Effect.andThen(
          Effect.fail(new GeoPromptDuplicateError({ prompt: "p" }))
        )
      )
    ).pipe(Effect.flip)
  );

  expect(error).toBeInstanceOf(GeoPromptDuplicateError);
  expect(await rowIds()).not.toContain("rolled-back");
});

test("geoTransaction maps a failing statement to GeoDatabaseError", async () => {
  const error = await Effect.runPromise(
    geoTransaction("tx failed", (tx) => insertRow(tx, "committed")).pipe(
      Effect.flip
    )
  );

  expect(error._tag).toBe("GeoDatabaseError");
});

const interruptMidway = (
  id: string,
  afterGate: (
    tx: Parameters<Parameters<typeof geoTransaction>[1]>[0]
  ) => Effect.Effect<unknown, unknown>
) =>
  Effect.gen(function* () {
    const firstWritten = yield* Deferred.make<void>();
    const gate = yield* Deferred.make<void>();
    const settled = yield* Deferred.make<void>();
    const fiber = yield* geoTransaction("tx failed", (tx) =>
      Effect.gen(function* () {
        yield* insertRow(tx, `${id}-1`);
        yield* Deferred.succeed(firstWritten, undefined);
        yield* Deferred.await(gate);
        yield* afterGate(tx);
      }).pipe(Effect.ensuring(Deferred.succeed(settled, undefined)))
    ).pipe(Effect.forkChild);

    yield* Deferred.await(firstWritten);
    // The caller stops waiting right away, while the transaction is parked.
    yield* Fiber.interrupt(fiber);
    yield* Deferred.succeed(gate, undefined);
    yield* Deferred.await(settled);
  });

test("geoTransaction lets an interrupted caller go and still commits both writes", async () => {
  await Effect.runPromise(
    interruptMidway("detached", (tx) => insertRow(tx, "detached-2"))
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  const ids = await rowIds();
  expect(ids).toContain("detached-1");
  expect(ids).toContain("detached-2");
});

test("geoTransaction still rolls back a failure after the caller was interrupted", async () => {
  await Effect.runPromise(
    interruptMidway("abandoned", () =>
      Effect.fail(new GeoPromptDuplicateError({ prompt: "p" }))
    )
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(await rowIds()).not.toContain("abandoned-1");
});
