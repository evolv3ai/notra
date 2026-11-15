import assert from "node:assert/strict";
import { test } from "node:test";

import { GatewayRateLimitError } from "@ai-sdk/gateway";
import { APICallError } from "@ai-sdk/provider";
import { TELEMETRY_TEST_EVENT } from "@notra/ai/constants/telemetry-test";
import { httpError } from "@notra/ai/router/test-helpers";

import { readGatewayLimitDetails } from "./gateway-limit-details";
import { gatewayLimitMessage } from "./gateway-limit-message";

test("Neon's daily spend response reports retry guidance without inventing a daily reset or exposing raw errors", () => {
  const now = Date.parse("2026-10-23T18:00:00Z");
  const error = new APICallError({
    message: "Unable to process request",
    url: "https://neon.example.test/openai/v1/responses",
    requestBodyValues: { input: "private-prompt" },
    statusCode: 429,
    responseBody: JSON.stringify({
      error_code: "REQUEST_LIMIT_EXCEEDED",
      message:
        "You've reached your AI Gateway daily spend limit. You can retry after it resets.",
      private: "private-provider-error",
    }),
    responseHeaders: {
      "Retry-After": "3600",
      "x-ratelimit-reset": String(now / 1000 + 30),
      authorization: "Bearer private-credential",
    },
  });
  const details = readGatewayLimitDetails(error, now);
  assert.equal(details?.limitType, "daily-spend");
  assert.equal(details.retryAfterSeconds, 3600);
  assert.equal(details.retryAt, "2026-10-23T19:00:00.000Z");
  assert.equal(details.rateLimitResetAt, undefined);
  const text = gatewayLimitMessage(
    { ...TELEMETRY_TEST_EVENT, ...details, gateway: "neon", status: 429 },
    "production"
  );
  assert.match(text, /Limit: Daily spend limit/);
  assert.match(text, /Reason: .*daily spend limit/);
  assert.match(text, /Reset: exact time not reported/);
  assert.match(text, /retry at 2026-10-23T19:00:00.000Z/);
  assert.match(text, /not a confirmed reset/);
  assert.match(text, /does not confirm recovery/);
  assert.doesNotMatch(JSON.stringify(details) + text, /private-/);
});

test("wrapped gateway rate limits retain numeric allowances, reset and HTTP-date retry headers", () => {
  const now = Date.parse("2026-10-23T18:00:00Z");
  const error = new GatewayRateLimitError({
    cause: new APICallError({
      message: "Rate limit exceeded",
      url: "https://gateway.example.test",
      requestBodyValues: {},
      statusCode: 429,
      responseHeaders: {
        "retry-after": "Fri, 23 Oct 2026 18:01:00 GMT",
        "x-ratelimit-reset": String(now / 1000 + 60),
        "x-ratelimit-limit-requests": "100",
        "x-ratelimit-limit-tokens": "20000",
      },
    }),
  });
  const details = readGatewayLimitDetails(error, now);
  assert.equal(details?.limitType, "rate-limit");
  assert.equal(details.retryAfterSeconds, 60);
  assert.equal(details.rateLimitResetAt, "2026-10-23T18:01:00.000Z");
  assert.equal(details.requestLimit, 100);
  assert.equal(details.tokenLimit, 20000);
  const text = gatewayLimitMessage(
    { ...TELEMETRY_TEST_EVENT, ...details },
    "test"
  );
  assert.match(text, /Reset: 2026-10-23T18:01:00.000Z/);
  assert.match(text, /Request rate allowance: 100/);
});

test("credits, daily tokens and unknown 429s are distinct and missing metadata stays unknown", () => {
  for (const [status, message, expected] of [
    [402, "A positive credit balance is required", "credit-balance"],
    [429, "ai gateway daily token limit exceeded", "daily-tokens"],
    [429, "ai gateway account token rate limit exceeded", "rate-limit"],
    [429, "upstream failed", "unknown"],
  ] as const) {
    const details = readGatewayLimitDetails(httpError(status, message));
    assert.equal(details?.limitType, expected);
    assert.equal(details.retryAt, undefined);
    const text = gatewayLimitMessage(
      { ...TELEMETRY_TEST_EVENT, ...details },
      "test"
    );
    assert.match(text, /Retry-After: not reported/);
    if (status === 402) {
      assert.match(text, /Reset: no timed reset reported/);
      assert.match(text, /Action: Add credits/);
    }
  }
  assert.equal(readGatewayLimitDetails(httpError(500)), undefined);
});

test("malformed, negative, excessive and expired retry/reset headers are ignored", () => {
  const now = Date.parse("2026-10-23T18:00:00Z");
  for (const value of [
    "bad-value",
    "-1",
    "Infinity",
    "999999999999999999",
    "Fri, 23 Oct 2026 17:00:00 GMT",
  ]) {
    const details = readGatewayLimitDetails(
      Object.assign(httpError(429), {
        responseHeaders: {
          "retry-after": value,
          "x-ratelimit-reset": value,
          "x-ratelimit-limit-tokens": value,
        },
      }),
      now
    );
    assert.equal(details?.retryAt, undefined);
    assert.equal(details?.rateLimitResetAt, undefined);
    assert.equal(details?.tokenLimit, undefined);
  }
});
