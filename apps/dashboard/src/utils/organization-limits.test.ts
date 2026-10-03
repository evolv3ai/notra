import { afterEach, describe, expect, test } from "bun:test";

import { canCreateAdditionalOrganizations } from "./organization-limits";

const FLAG = "NEXT_PUBLIC_UNLIMITED_ORGANIZATIONS";
const originalValue = process.env[FLAG];

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env[FLAG];
  } else {
    process.env[FLAG] = originalValue;
  }
});

describe("canCreateAdditionalOrganizations", () => {
  test("allows paid plans without the flag", () => {
    delete process.env[FLAG];
    expect(canCreateAdditionalOrganizations(true)).toBe(true);
  });

  test("blocks unpaid plans without the flag", () => {
    delete process.env[FLAG];
    expect(canCreateAdditionalOrganizations(false)).toBe(false);
  });

  test("allows unpaid plans when the flag is true", () => {
    process.env[FLAG] = "true";
    expect(canCreateAdditionalOrganizations(false)).toBe(true);
  });

  test("ignores values other than true", () => {
    process.env[FLAG] = "1";
    expect(canCreateAdditionalOrganizations(false)).toBe(false);
  });
});
