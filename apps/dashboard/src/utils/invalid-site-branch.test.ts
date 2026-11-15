import { expect, test } from "bun:test";

import { isInvalidSiteBranchError } from "./invalid-site-branch";

test("only a branch-not-found response triggers branch recovery", () => {
  expect(
    isInvalidSiteBranchError({
      code: "BAD_REQUEST",
      message: "Branch not found",
    })
  ).toBe(true);
  expect(
    isInvalidSiteBranchError({ code: "NOT_FOUND", message: "Branch not found" })
  ).toBe(true);
  expect(
    isInvalidSiteBranchError({ status: 404, message: "Branch not found" })
  ).toBe(true);
  for (const message of [
    "Repository tree is truncated",
    "Invalid .notraignore",
    "Site not found",
  ]) {
    expect(isInvalidSiteBranchError({ code: "BAD_REQUEST", message })).toBe(
      false
    );
    expect(isInvalidSiteBranchError({ code: "NOT_FOUND", message })).toBe(
      false
    );
    expect(isInvalidSiteBranchError({ status: 404, message })).toBe(false);
  }
  expect(isInvalidSiteBranchError(null)).toBe(false);
});
