import { describe, expect, test } from "bun:test";

import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { GEO_CODING_AGENT_ACCESS_CACHE_TTL } from "../src/constants/geo-coding-agents";
import { GeoCodingAgentAccessService } from "../src/deps";
import { loadGeoCodingAgentAccess } from "../src/geo/coding-agent-access";
import { GeoCodingAgentAccessError } from "../src/geo/errors";

describe("coding-agent paid-access cache", () => {
  test("paid lookups share one evaluation and reuse positive results", async () => {
    let calls = 0;
    const access = {
      hasPaidPlanForOrganization: () =>
        Effect.sync(() => {
          calls += 1;
          return true;
        }),
    };
    const results = await Effect.runPromise(
      Effect.all(
        Array.from({ length: 4 }, () => loadGeoCodingAgentAccess("paid-org")),
        {
          concurrency: "unbounded",
        }
      ).pipe(Effect.provideService(GeoCodingAgentAccessService, access))
    );
    expect(results).toEqual([true, true, true, true]);
    expect(
      await Effect.runPromise(
        loadGeoCodingAgentAccess("paid-org").pipe(
          Effect.provideService(GeoCodingAgentAccessService, access)
        )
      )
    ).toBe(true);
    expect(calls).toBe(1);
  });

  test("does not share paid access across organizations or providers", async () => {
    const access = {
      hasPaidPlanForOrganization: (organizationId: string) =>
        Effect.succeed(organizationId === "entitled-org"),
    };
    expect(
      await Effect.runPromise(
        loadGeoCodingAgentAccess("entitled-org").pipe(
          Effect.provideService(GeoCodingAgentAccessService, access)
        )
      )
    ).toBe(true);
    expect(
      await Effect.runPromise(
        loadGeoCodingAgentAccess("free-org").pipe(
          Effect.provideService(GeoCodingAgentAccessService, access)
        )
      )
    ).toBe(false);
    expect(
      await Effect.runPromise(
        loadGeoCodingAgentAccess("entitled-org").pipe(
          Effect.provideService(GeoCodingAgentAccessService, {
            hasPaidPlanForOrganization: () => Effect.succeed(false),
          })
        )
      )
    ).toBe(false);
  });

  test.each(["unpaid", "provider failure"])(
    "%s fails closed without caching the denial",
    async (failure) => {
      let allowed = false;
      let calls = 0;
      const access = {
        hasPaidPlanForOrganization: () =>
          Effect.suspend(() => {
            calls += 1;
            if (!allowed && failure === "provider failure") {
              return Effect.fail(
                new GeoCodingAgentAccessError({
                  cause: new Error("billing unavailable"),
                })
              );
            }
            return Effect.succeed(allowed);
          }),
      };
      const lookup = loadGeoCodingAgentAccess(`recover-${failure}`).pipe(
        Effect.provideService(GeoCodingAgentAccessService, access)
      );
      expect(await Effect.runPromise(lookup)).toBe(false);
      allowed = true;
      expect(await Effect.runPromise(lookup)).toBe(true);
      expect(calls).toBe(2);
    }
  );

  test.each(["downgrade", "provider failure"])(
    "%s revokes cached paid access after the bounded grace period",
    async (failure) => {
      let paid = true;
      let calls = 0;
      const access = {
        hasPaidPlanForOrganization: () =>
          Effect.suspend(() => {
            calls += 1;
            return !paid && failure === "provider failure"
              ? Effect.fail(
                  new GeoCodingAgentAccessError({
                    cause: new Error("billing unavailable"),
                  })
                )
              : Effect.succeed(paid);
          }),
      };
      await Effect.runPromise(
        Effect.gen(function* () {
          expect(yield* loadGeoCodingAgentAccess(`expires-${failure}`)).toBe(
            true
          );
          paid = false;
          expect(yield* loadGeoCodingAgentAccess(`expires-${failure}`)).toBe(
            true
          );
          expect(calls).toBe(1);
          yield* TestClock.adjust(GEO_CODING_AGENT_ACCESS_CACHE_TTL);
          expect(yield* loadGeoCodingAgentAccess(`expires-${failure}`)).toBe(
            false
          );
          expect(calls).toBe(2);
        }).pipe(
          Effect.provideService(GeoCodingAgentAccessService, access),
          Effect.provide(TestClock.layer())
        )
      );
    }
  );
});
