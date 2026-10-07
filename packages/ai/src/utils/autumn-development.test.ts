import { describe, expect, test } from "bun:test";

import { shouldBypassAutumnInDevelopment } from "./autumn-development";

describe("shouldBypassAutumnInDevelopment", () => {
  test("bypasses in development without a key", () => {
    expect(
      shouldBypassAutumnInDevelopment("development", undefined, undefined)
    ).toBe(true);
  });

  test("never bypasses when a key is configured", () => {
    expect(shouldBypassAutumnInDevelopment("development", "am_sk", "true")).toBe(
      false
    );
  });

  test("keeps production gated without the self-hosted flag", () => {
    expect(
      shouldBypassAutumnInDevelopment("production", undefined, undefined)
    ).toBe(false);
  });

  test("bypasses self-hosted production without a key", () => {
    expect(shouldBypassAutumnInDevelopment("production", undefined, "true")).toBe(
      true
    );
  });

  test("ignores self-hosted values other than true", () => {
    expect(shouldBypassAutumnInDevelopment("production", undefined, "1")).toBe(
      false
    );
  });
});
