import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { analyticsIntegrations } from "../emulators/browser";
import { SITE_ID } from "../src/constants/fixtures";
import { compileFixtures } from "../src/utils/compiler";

test("parallel fixture builds keep their Vite caches inside their own work directories", async () => {
  const scratch = await realpath(
    await mkdtemp(join(tmpdir(), "notra-parallel-builds-"))
  );
  const directories = [join(scratch, "first"), join(scratch, "second")];
  try {
    const results = await Promise.allSettled(
      directories.map(async (directory, index) => {
        await mkdir(directory);
        const compiled = await compileFixtures(
          resolve(import.meta.dirname, "../../.."),
          directory,
          [
            {
              siteId: SITE_ID,
              deploymentId: "dep_live",
              publicOrigin: `http://live-${index}.localhost:4321`,
              preview: false,
              integrations: analyticsIntegrations(),
            },
            {
              siteId: SITE_ID,
              deploymentId: "dep_preview",
              publicOrigin: `http://preview-${index}.localhost:4321`,
              preview: true,
              integrations: analyticsIntegrations(),
            },
          ],
          []
        );
        expect(compiled.manifests).toHaveLength(2);
        for (const deployment of ["dep_live", "dep_preview"]) {
          expect(
            (
              await stat(
                join(directory, "work", deployment, "cache", "vite", "blog")
              )
            ).isDirectory()
          ).toBe(true);
        }
      })
    );
    // Wait for both compilers before cleaning either directory, even on failure.
    for (const result of results) {
      if (result.status === "rejected") {
        throw result.reason;
      }
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}, 120_000);
