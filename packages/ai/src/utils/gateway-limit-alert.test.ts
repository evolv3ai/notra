import { expect, mock, spyOn, test } from "bun:test";

import { TELEMETRY_TEST_EVENT } from "@notra/ai/constants/telemetry-test";

test("Slack receives limit details and dedupes daily caps separately from rate limits without a real webhook", async () => {
  const claims = new Set<string>();
  const set = mock((key: string) => {
    const previous = claims.has(key) ? "sent" : null;
    claims.add(key);
    return Promise.resolve(previous);
  });
  const del = mock((key: string) => {
    claims.delete(key);
    return Promise.resolve(1);
  });
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
      limitType: "daily-spend",
      retryAfterSeconds: 3600,
      retryAt: "2026-10-23T19:00:00.000Z",
    };
    await alertGatewayLimit(event);
    await alertGatewayLimit(event);
    await alertGatewayLimit({ ...event, limitType: "rate-limit" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(claims.size).toBe(2);
    const payload = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    const text = payload.blocks[0].text.text;
    expect(text).toContain("Limit: Daily spend limit");
    expect(text).toContain("Reset: exact time not reported");
    expect(text).toContain("Retry-After: 3600s");
    expect(text).toContain("not a confirmed reset");
    expect(text).toContain("does not confirm recovery");
    fetch.mockImplementationOnce(() =>
      Promise.resolve(new Response("unavailable", { status: 503 }))
    );
    await expect(
      alertGatewayLimit({ ...event, gateway: "vercel" })
    ).rejects.toThrow("Slack alert returned HTTP 503");
    expect(del).toHaveBeenCalledTimes(1);
    await alertGatewayLimit({ ...event, gateway: "vercel" });
    expect(fetch).toHaveBeenCalledTimes(4);
  } finally {
    mock.restore();
    if (previousWebhook === undefined) {
      delete process.env.GEO_SCAN_ALERT_WEBHOOK_URL;
    } else {
      process.env.GEO_SCAN_ALERT_WEBHOOK_URL = previousWebhook;
    }
  }
});
