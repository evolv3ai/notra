import { expect, test } from "bun:test";

import { resolveGeoAlertFormActions } from "../src/utils/geo-alert-form";

test("Slack defaults follow availability without overriding explicit choices", () => {
  const connected = {
    slackConnected: true,
    ownerCount: 1,
    webhookEndpointCount: 1,
  };
  expect(resolveGeoAlertFormActions({}, connected)).toEqual({
    slack: true,
    email: true,
    webhook: false,
  });
  expect(resolveGeoAlertFormActions({ slack: false }, connected).slack).toBe(
    false
  );
  expect(
    resolveGeoAlertFormActions(
      { slack: false, email: false, webhook: true },
      connected
    )
  ).toEqual({ slack: false, email: false, webhook: true });
});

test("loading or disconnecting destinations never destroys saved selections", () => {
  const selection = { slack: true, email: false, webhook: true };
  expect(resolveGeoAlertFormActions(selection)).toEqual({
    slack: false,
    email: false,
    webhook: false,
  });
  expect(
    resolveGeoAlertFormActions(selection, {
      slackConnected: false,
      ownerCount: 1,
      webhookEndpointCount: 0,
    })
  ).toEqual({ slack: false, email: false, webhook: false });
  expect(
    resolveGeoAlertFormActions(selection, {
      slackConnected: true,
      ownerCount: 1,
      webhookEndpointCount: 1,
    })
  ).toEqual(selection);
  expect(selection).toEqual({ slack: true, email: false, webhook: true });
});
