import { expect, mock, spyOn, test } from "bun:test";

import { GATEWAY_LIMIT_ALERT } from "@notra/ai/constants/evlog";
import { TELEMETRY_TEST_EVENT } from "@notra/ai/constants/telemetry-test";

test("a continuing gateway incident alerts once, rearms after silence and retries failed deliveries", async () => {
  let now = 0;
  const entries = new Map<string, [string, number]>();
  const set = mock(
    (
      key: string,
      value: string,
      options = { get: false, nx: false, ex: 0 }
    ) => {
      const entry = entries.get(key);
      const previous = entry && entry[1] > now ? entry[0] : null;
      if (options.nx && previous !== null) {
        return Promise.resolve(null);
      }
      entries.set(key, [value, now + options.ex]);
      return Promise.resolve(options.get ? previous : "OK");
    }
  );
  const del = mock((key: string) =>
    Promise.resolve(Number(entries.delete(key)))
  );
  mock.module("@notra/ai/utils/redis", () => ({ redis: { set, del } }));
  const fetch = spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(new Response("ok"))
  );
  const previousWebhook = process.env.GEO_SCAN_ALERT_WEBHOOK_URL;
  process.env.GEO_SCAN_ALERT_WEBHOOK_URL = "https://slack.example.test/webhook";
  try {
    const { alertGatewayLimit } = await import("./gateway-limit-alert");
    const event = {
      ...TELEMETRY_TEST_EVENT,
      gateway: "neon",
      status: 429,
      model: "fixture",
      callId: "call_first",
    };
    await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        alertGatewayLimit({ ...event, callId: `call_${index}` })
      )
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0]?.[2]).toEqual({
      get: true,
      ex: GATEWAY_LIMIT_ALERT.dedupeSeconds,
    });

    // Two hours of repeated failures must not produce periodic reminders.
    for (let index = 0; index < 24; index += 1) {
      now += 5 * 60;
      await alertGatewayLimit({
        ...event,
        model: "another-model",
        callId: `repeat_${index}`,
      });
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    now += GATEWAY_LIMIT_ALERT.dedupeSeconds - 1;
    await alertGatewayLimit(event);
    expect(fetch).toHaveBeenCalledTimes(1);
    now += GATEWAY_LIMIT_ALERT.dedupeSeconds + 1;
    await alertGatewayLimit(event);
    expect(fetch).toHaveBeenCalledTimes(2);

    await alertGatewayLimit({ ...event, gateway: "vercel" });
    await alertGatewayLimit({ ...event, status: 402 });
    expect(fetch).toHaveBeenCalledTimes(4);
    fetch.mockImplementationOnce(() =>
      Promise.resolve(new Response("unavailable", { status: 503 }))
    );
    await expect(
      alertGatewayLimit({ ...event, gateway: "openrouter" })
    ).rejects.toThrow("Slack alert returned HTTP 503");
    expect(del).toHaveBeenCalledTimes(1);
    await alertGatewayLimit({ ...event, gateway: "openrouter" });
    expect(fetch).toHaveBeenCalledTimes(6);
    const payload = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(payload.blocks[0].text.text).toContain(
      "60 minutes without another matching failure"
    );
    expect(payload.blocks[0].text.text).toContain("Full logs are retained");
  } finally {
    mock.restore();
    if (previousWebhook === undefined) {
      delete process.env.GEO_SCAN_ALERT_WEBHOOK_URL;
    } else {
      process.env.GEO_SCAN_ALERT_WEBHOOK_URL = previousWebhook;
    }
  }
});
