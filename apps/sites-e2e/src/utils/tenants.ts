import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  siteManifestSchema,
  siteServingStateSchema,
} from "@notra/sites-core/schemas/deployment";
import type { SiteManifestFile } from "@notra/sites-core/types/deployment";

import { contentTypeForPath } from "../../../../packages/sites-server/src/utils/content-types";
import {
  OTHER_CUSTOM_HOST,
  OTHER_HOST,
  OTHER_SITE_ID,
  OTHER_SITE_SLUG,
  STALE_ALIAS_HOST,
  SUSPENDED_HOST,
  SUSPENDED_SITE_ID,
} from "../constants/fixtures";

const DEPLOYMENT_ID = "dep_globex";

function htmlPage(heading: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${heading}</title></head><body><h1>${heading}</h1></body></html>`;
}

export function seedOtherTenant(
  objects: Map<string, Uint8Array>,
  options: {
    port: number;
    acmeFiles: SiteManifestFile[];
    borrowed: SiteManifestFile;
  }
) {
  const pages = new Map([
    ["/blog/index.html", htmlPage("Globex Blog")],
    ["/blog/hello-world/index.html", htmlPage("Globex launch notes")],
    [
      "/blog/hello-world/index.md",
      "# Globex launch notes\n\nGlobex's own twin.\n",
    ],
    ["/blog/carry-over/index.html", htmlPage("Globex carry-over")],
  ]);
  for (const path of pages.keys()) {
    if (path !== "/blog/carry-over/index.html") {
      assert.ok(
        options.acmeFiles.some((file) => file.path === path),
        `Acme also serves ${path}`
      );
    }
  }
  const files: SiteManifestFile[] = [];
  for (const [path, text] of pages) {
    const body = new TextEncoder().encode(text);
    objects.set(
      `deployments/${OTHER_SITE_ID}/${DEPLOYMENT_ID}/files${path}`,
      body
    );
    const borrowed = path === "/blog/carry-over/index.html";
    files.push({
      path,
      size: borrowed ? options.borrowed.size : body.byteLength,
      sha256: borrowed
        ? options.borrowed.sha256
        : createHash("sha256").update(body).digest("hex"),
      contentType: contentTypeForPath(path),
    });
  }
  const manifest = siteManifestSchema.parse({
    version: 1,
    siteId: OTHER_SITE_ID,
    deploymentId: DEPLOYMENT_ID,
    commitSha: "0".repeat(40),
    toolchainVersion: "e2e",
    target: {
      publicOrigin: `http://${OTHER_HOST}:${options.port}`,
      mounts: { blog: "/blog" },
      noindex: false,
    },
    configHash: "e2e",
    createdAt: new Date().toISOString(),
    totalBytes: files.reduce((total, file) => total + file.size, 0),
    files,
    redirects: [],
  });
  objects.set(
    `deployments/${OTHER_SITE_ID}/${DEPLOYMENT_ID}/manifest.json`,
    new TextEncoder().encode(JSON.stringify(manifest))
  );
  const state = siteServingStateSchema.parse({
    version: 1,
    siteId: OTHER_SITE_ID,
    slug: OTHER_SITE_SLUG,
    status: "active",
    production: {
      deploymentId: DEPLOYMENT_ID,
      generation: 1,
      activatedAt: new Date().toISOString(),
    },
    previews: {},
    updatedAt: new Date().toISOString(),
  });
  objects.set(
    `sites/${OTHER_SITE_ID}/state.json`,
    new TextEncoder().encode(JSON.stringify(state))
  );
  for (const [host, kind] of [
    [OTHER_HOST, "alias"],
    [OTHER_CUSTOM_HOST, "custom"],
    [STALE_ALIAS_HOST, "alias"],
  ] as const) {
    objects.set(
      `hosts/${host}.json`,
      new TextEncoder().encode(
        JSON.stringify({ version: 1, siteId: OTHER_SITE_ID, kind })
      )
    );
  }
  return new Map(
    [
      ["/blog", "/blog/index.html"],
      ["/blog/hello-world", "/blog/hello-world/index.html"],
      ["/blog/hello-world.md", "/blog/hello-world/index.md"],
      ["/blog/carry-over", "/blog/carry-over/index.html"],
    ].map(([path, file]) => [path, pages.get(file) ?? ""])
  );
}

/** A site Notra suspended for phishing; it still has a live deployment. */
export function seedSuspendedTenant(objects: Map<string, Uint8Array>) {
  const state = siteServingStateSchema.parse({
    version: 1,
    siteId: SUSPENDED_SITE_ID,
    slug: "suspended",
    status: "suspended",
    suspension: { category: "phishing" },
    production: {
      deploymentId: DEPLOYMENT_ID,
      generation: 1,
      activatedAt: new Date().toISOString(),
    },
    previews: {},
    updatedAt: new Date().toISOString(),
  });
  objects.set(
    `sites/${SUSPENDED_SITE_ID}/state.json`,
    new TextEncoder().encode(JSON.stringify(state))
  );
  objects.set(
    `hosts/${SUSPENDED_HOST}.json`,
    new TextEncoder().encode(
      JSON.stringify({ version: 1, siteId: SUSPENDED_SITE_ID, kind: "alias" })
    )
  );
}
