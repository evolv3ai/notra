import { describe, expect, test } from "bun:test";

import { isPgUniqueViolation } from "../src/utils/pg-errors";

function pgError(code: string, constraint?: string) {
  return Object.assign(new Error("duplicate key value"), { code, constraint });
}

describe("isPgUniqueViolation", () => {
  test("matches a direct pg unique violation", () => {
    const error = pgError("23505", "posts_org_slug_uidx");
    expect(isPgUniqueViolation(error)).toBe(true);
    expect(isPgUniqueViolation(error, "posts_org_slug_uidx")).toBe(true);
  });

  test("walks a DrizzleQueryError-style cause chain", () => {
    const wrapped = new Error("Failed query: insert into posts", {
      cause: pgError("23505", "posts_org_slug_uidx"),
    });
    const outer = new Error("write failed", { cause: wrapped });
    expect(isPgUniqueViolation(outer, "posts_org_slug_uidx")).toBe(true);
  });

  test("rejects a different constraint, even if the message names it", () => {
    const error = new Error('violates "posts_org_slug_uidx"', {
      cause: pgError("23505", "brandSettings_org_name_uidx"),
    });
    expect(isPgUniqueViolation(error)).toBe(true);
    expect(isPgUniqueViolation(error, "posts_org_slug_uidx")).toBe(false);
  });

  test("rejects non-23505 errors and non-objects", () => {
    expect(isPgUniqueViolation(pgError("23503", "posts_org_slug_uidx"))).toBe(
      false
    );
    expect(isPgUniqueViolation(null)).toBe(false);
    expect(isPgUniqueViolation("23505")).toBe(false);
  });
});
