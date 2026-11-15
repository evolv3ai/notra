import { expect, test } from "bun:test";

import { SITE_EDIT_BRANCH_PREFIX } from "@notra/sites-core/constants/sites";

import type {
  SiteBranchPrimaryActionProps,
  SiteBranchStatus,
} from "@/types/site-branches";

import { siteBranchPrimaryState } from "./site-branch-primary-state";

test("zero file drafts still permits review/merge only with an eligible PR", () => {
  const status: SiteBranchStatus = {
    branch: `${SITE_EDIT_BRANCH_PREFIX}test`,
    canPublishDirect: false,
    canEdit: true,
    canMerge: false,
    protected: false,
    hasFeatureBranches: true,
    changedFiles: 0,
    pullRequest: null,
  };
  const props: SiteBranchPrimaryActionProps = {
    feature: true,
    status,
    busy: false,
    invalid: false,
    draftCount: 0,
    unsaved: false,
    onCreate: () => {},
    onPublish: () => {},
    onReview: () => {},
    onFlush: () => {},
  };
  expect(siteBranchPrimaryState(props).disabled).toBe(true);
  status.pullRequest = {
    id: "synthetic",
    number: 1,
    url: "https://example.test/pr/1",
    state: "OPEN",
    isDraft: true,
    merged: false,
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    reviewDecision: null,
    headRefOid: "sha",
  };
  expect(siteBranchPrimaryState(props)).toMatchObject({
    action: "requestReview",
    disabled: false,
  });
  status.pullRequest.isDraft = false;
  expect(siteBranchPrimaryState(props).disabled).toBe(true);
  status.canMerge = true;
  expect(siteBranchPrimaryState(props)).toMatchObject({
    action: "merge",
    disabled: false,
  });
  expect(siteBranchPrimaryState({ ...props, invalid: true }).disabled).toBe(
    true
  );
});

test("review stays available for branch changes without a pull request", () => {
  const status: SiteBranchStatus = {
    branch: `${SITE_EDIT_BRANCH_PREFIX}test`,
    canPublishDirect: false,
    canEdit: true,
    canMerge: false,
    protected: false,
    hasFeatureBranches: true,
    changedFiles: 2,
    pullRequest: null,
  };
  const props: SiteBranchPrimaryActionProps = {
    feature: true,
    status,
    busy: false,
    invalid: false,
    draftCount: 0,
    unsaved: false,
    onCreate: () => {},
    onPublish: () => {},
    onReview: () => {},
    onFlush: () => {},
  };
  expect(siteBranchPrimaryState(props)).toMatchObject({
    action: "requestReview",
    disabled: false,
  });
  expect(
    siteBranchPrimaryState({
      ...props,
      status: { ...status, changedFiles: 0 },
      draftCount: 1,
    })
  ).toMatchObject({ action: "requestReview", disabled: false });
});
