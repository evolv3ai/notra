import { expect, test } from "bun:test";

import {
  siteBranchNameSchema,
  siteBranchCreateInputSchema,
  siteBranchRenameInputSchema,
} from "../src/schemas/dashboard/sites";

test.each([
  "feature..bad",
  "-bad",
  "/bad",
  "bad/",
  "bad.",
  "bad.lock",
  "bad.lock/nested",
  "bad@{ref}",
  "bad\nname",
  "bad name",
  "bad//name",
  "bad/.hidden",
  "bad?name",
  "bad\\name",
  "@",
  "x".repeat(251),
])("reject invalid Git branch %j", (branch) => {
  expect(siteBranchNameSchema.safeParse(branch).success).toBe(false);
});
test.each([
  "main",
  "deploy/production",
  "notra/site-edit-docs",
  "notra/site-edit-2",
])("accept valid Git branch %s", (branch) => {
  expect(siteBranchNameSchema.safeParse(branch).success).toBe(true);
});
test("create and rename reject invalid titles before reaching GitHub", () => {
  const scope = {
    organizationId: "org",
    siteId: "site_test",
    branch: "notra/site-edit-test",
  };
  expect(
    siteBranchCreateInputSchema.safeParse({
      ...scope,
      title: "bad..name",
      bringChanges: false,
    }).success
  ).toBe(false);
  expect(
    siteBranchRenameInputSchema.safeParse({ ...scope, title: "bad.lock" })
      .success
  ).toBe(false);
});

test("branch titles support words separated by spaces before slug generation", () => {
  expect(
    siteBranchCreateInputSchema.safeParse({
      organizationId: "org",
      siteId: "site_test",
      title: "Browser bring",
      bringChanges: true,
    }).success
  ).toBe(true);
});
