import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from "bun:test";

const check = mock();
const finalize = mock();

mock.module("./autumn", () => ({
  autumn: { check, balances: { finalize } },
  allowUnmeteredAiInDevelopment: false,
}));

const { finalizeAutumnLock } = await import("./autumn-locks");
const { confirmContentBilling, reserveContentBilling } =
  await import("./content-billing");

beforeEach(() => {
  check.mockReset();
  finalize.mockReset();
});
afterEach(() => setSystemTime());

describe("Autumn billing lock settlement", () => {
  test.each([404, 409, 410])(
    "surfaces %s on confirmation but permits releasing a gone lock",
    async (status) => {
      for (const error of [{ status }, { statusCode: status }]) {
        finalize.mockRejectedValue(error);
        await expect(finalizeAutumnLock("lock", "confirm", 42)).rejects.toBe(
          error
        );
        await expect(
          finalizeAutumnLock("lock", "release")
        ).resolves.toBeUndefined();
      }
    }
  );

  test("preserves confirmation values, attribution and idempotency on retries", async () => {
    finalize.mockResolvedValue({});
    const properties = { source: "geo_scan", run_id: "run-1" };
    await finalizeAutumnLock("lock", "confirm", 42, properties);
    await finalizeAutumnLock("lock", "confirm", 42, properties);
    expect(finalize.mock.calls).toEqual([
      [
        { lockId: "lock", action: "confirm", overrideValue: 42, properties },
        { headers: { "Idempotency-Key": "lock:confirm" } },
      ],
      [
        { lockId: "lock", action: "confirm", overrideValue: 42, properties },
        { headers: { "Idempotency-Key": "lock:confirm" } },
      ],
    ]);
  });

  test("does not swallow other release failures", async () => {
    const error = { status: 500 };
    finalize.mockRejectedValue(error);
    await expect(finalizeAutumnLock("lock", "release")).rejects.toBe(error);
  });

  test.each(["ai_answers", "ai_credits"] as const)(
    "settles %s after 90 minutes with a scan-length reservation",
    async (featureId) => {
      const startedAt = Date.UTC(2026, 0, 1);
      setSystemTime(startedAt);
      const lockTtlMs = 24 * 60 * 60 * 1000;
      const lockId = `content-billing:run-1:${featureId}`;
      check.mockImplementation((input) => ({
        allowed: input.featureId === featureId,
      }));
      finalize.mockImplementation(() => {
        const reservation = check.mock.calls.find(
          ([input]) => input.featureId === featureId
        )?.[0];
        if (Date.now() >= reservation.lock.expiresAt) {
          throw Object.assign(new Error("Lock expired"), { statusCode: 404 });
        }
        return {};
      });

      const reservation = await reserveContentBilling({
        organizationId: "org-1",
        executionId: "run-1",
        outputType: null,
        quotaFeatureId: "ai_answers",
        lockTtlMs,
      });
      expect(reservation).toMatchObject({
        allowed: true,
        lockId,
        reserved: true,
      });
      expect(check).toHaveBeenCalledWith(
        expect.objectContaining({
          featureId,
          lock: { enabled: true, lockId, expiresAt: startedAt + lockTtlMs },
        }),
        expect.anything()
      );

      setSystemTime(startedAt + 90 * 60 * 1000);
      await confirmContentBilling({ reservation, units: 42 });
      expect(finalize).toHaveBeenCalledWith(
        {
          lockId,
          action: "confirm",
          overrideValue: featureId === "ai_answers" ? 42 : 1,
        },
        { headers: { "Idempotency-Key": `${lockId}:confirm` } }
      );
    }
  );
});
