import { describe, expect, test } from "bun:test";

import {
  siteUnpublishedTitle,
  splitVisibleChanges,
} from "./site-unpublished-summary";

describe("siteUnpublishedTitle", () => {
  test("counts sections when only Design changed", () => {
    expect(
      siteUnpublishedTitle({ sections: 2, files: 0, drafts: 1, branchFiles: 0 })
    ).toEqual({ key: "unpublishedTitle", count: 2 });
  });

  test("counts files when no Design section changed", () => {
    expect(
      siteUnpublishedTitle({ sections: 0, files: 2, drafts: 2, branchFiles: 0 })
    ).toEqual({ key: "unpublishedFilesTitle", count: 2 });
    expect(
      siteUnpublishedTitle({ sections: 0, files: 0, drafts: 0, branchFiles: 5 })
    ).toEqual({ key: "unpublishedFilesTitle", count: 5 });
  });

  test("uses the plain title when sections and files both changed", () => {
    expect(
      siteUnpublishedTitle({ sections: 1, files: 2, drafts: 3, branchFiles: 0 })
    ).toEqual({ key: "unpublishedMixedTitle", count: 0 });
    expect(
      siteUnpublishedTitle({ sections: 1, files: 0, drafts: 1, branchFiles: 4 })
    ).toEqual({ key: "unpublishedMixedTitle", count: 0 });
  });
});

describe("splitVisibleChanges", () => {
  test("names every change that fits", () => {
    expect(splitVisibleChanges(["a", "b", "c"], 0, 3)).toEqual({
      visible: ["a", "b", "c"],
      more: 0,
    });
  });

  test("collapses the rest into a count", () => {
    expect(splitVisibleChanges(["a", "b", "c", "d"], 0, 3)).toEqual({
      visible: ["a", "b"],
      more: 2,
    });
  });

  test("adds committed branch files to the count", () => {
    expect(splitVisibleChanges(["a"], 4, 3)).toEqual({
      visible: ["a"],
      more: 4,
    });
    expect(splitVisibleChanges(["a", "b", "c"], 2, 3)).toEqual({
      visible: ["a", "b"],
      more: 3,
    });
  });
});
