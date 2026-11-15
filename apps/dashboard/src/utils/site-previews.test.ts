import { expect, test } from "bun:test";

import { SITE_SECTIONS } from "@/constants/sites";
import type { SiteDeployment, SiteDetail, SitePreviewRow } from "@/types/sites";
import {
  deploymentMatchesFilters,
  deploymentMatchesSearch,
} from "@/utils/site-deployments";
import {
  siteDeploymentHref,
  sitePreviewDeploymentsHref,
} from "@/utils/site-links";
import {
  servedPreviewForDeployment,
  sitePreviewRows,
} from "@/utils/site-previews";

import { preview } from "../../tests/constants/site-previews";

test("preview links use the unified deployment filter and sidebar has no preview entry", () => {
  expect(sitePreviewDeploymentsHref("acme", "site")).toBe(
    "/acme/sites/site/deployments?environment=preview"
  );
  expect(siteDeploymentHref("acme", "site", "deployment")).toBe(
    "/acme/sites/site/deployments/deployment"
  );
  expect(SITE_SECTIONS.map((section) => section.path)).not.toContain(
    "/previews"
  );
});

test("live preview actions attach to the served deployment, never its newer build", () => {
  expect(
    servedPreviewForDeployment(
      { id: "served-old", kind: "preview", live: true },
      [preview]
    )
  ).toBe(preview);
  expect(
    servedPreviewForDeployment(
      { id: "new-build", kind: "preview", live: false },
      [preview]
    )
  ).toBeUndefined();
  expect(
    servedPreviewForDeployment(
      { id: "new-build", kind: "preview", live: true },
      [preview]
    )
  ).toBeUndefined();
  expect(
    servedPreviewForDeployment(
      { id: "served-old", kind: "production", live: true },
      [preview]
    )
  ).toBeUndefined();
  expect(
    servedPreviewForDeployment(
      { id: "served-old", kind: "preview", live: true },
      [{ ...preview, served: false }]
    )
  ).toBeUndefined();
});

test("active preview pointers survive a fetched history that no longer includes them", () => {
  const detail = {
    previews: [preview],
    deployments: [],
  } as unknown as SiteDetail;
  const rows = sitePreviewRows(detail);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.deploymentId).toBe("served-old");
  expect(rows[0]?.served).toBe(true);
  expect(rows[0]?.latestDeploymentId).toBe("served-old");
});

test("a failed preview update shows its own commit while keeping the older deployment live", () => {
  const deployment = {
    id: "new-build",
    kind: "preview",
    previewKey: preview.previewKey,
    status: "failed",
    commitSha: "newsha123",
    commitMessage: "Failed preview update",
    createdAt: new Date("2026-10-11T12:00:00Z"),
  } as SiteDeployment;
  const rows = sitePreviewRows({
    previews: [preview],
    deployments: [deployment],
  } as unknown as SiteDetail);
  expect(rows[0]).toMatchObject({
    served: true,
    deploymentId: "served-old",
    latestDeploymentId: "new-build",
    status: "failed",
    commitSha: deployment.commitSha,
    commitMessage: deployment.commitMessage,
    updatedAt: deployment.createdAt,
  });
});

test("environment filtering uses existing deployment records and includes uploading builds", () => {
  const deployment = { kind: "preview", status: "uploading" } as SiteDeployment;
  expect(
    deploymentMatchesFilters(deployment, { environment: "all", status: "all" })
  ).toBe(true);
  expect(
    deploymentMatchesFilters(deployment, {
      environment: "preview",
      status: "building",
    })
  ).toBe(true);
  expect(
    deploymentMatchesFilters(deployment, {
      environment: "production",
      status: "all",
    })
  ).toBe(false);
});

test("deployment search matches branch, commit text, SHA and preview keys", () => {
  const deployment = {
    branch: "Feature/Login",
    commitSha: "aabbcc123",
    commitMessage: "Fix sign in\nDetails",
    previewKey: "pr-42",
  };
  for (const query of ["feature", "SIGN IN", " aabbcc ", "pr-42", ""]) {
    expect(deploymentMatchesSearch(deployment, query)).toBe(true);
  }
  expect(deploymentMatchesSearch(deployment, "missing")).toBe(false);
  expect(
    deploymentMatchesSearch(
      { ...deployment, commitMessage: null, previewKey: null },
      "pr-42"
    )
  ).toBe(false);
});
