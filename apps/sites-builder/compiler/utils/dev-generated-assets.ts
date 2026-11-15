import { rm } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { SITE_AREAS, SITE_ASSETS_DIR } from "@notra/sites-core/constants/sites";

import { OG_IMAGES_DIR } from "../constants/og-images";
import { listFiles } from "./fs";

export async function cleanDevGeneratedAssets(
  workDir: string,
  publicFiles: readonly string[],
  customScripts: readonly string[]
): Promise<void> {
  const publicDir = join(workDir, "site", "public");
  const retained = new Set([
    ...publicFiles.map((path) => join(publicDir, path)),
    ...customScripts.map((name) => join(publicDir, SITE_ASSETS_DIR, name)),
  ]);
  const generated = await listFiles(join(publicDir, "_notra")).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  );
  await Promise.all(
    generated
      .filter((path) => {
        if (retained.has(path)) {
          return false;
        }
        const name = relative(publicDir, path).split(sep).join("/");
        return (
          (name.startsWith(`${SITE_ASSETS_DIR}/`) &&
            /^custom-[A-Za-z0-9_-]+\.[a-f0-9]{10}\.js$/.test(
              name.slice(SITE_ASSETS_DIR.length + 1)
            )) ||
          (name.startsWith(`${SITE_ASSETS_DIR}/fonts/`) &&
            /^[a-f0-9]{64}\//.test(
              name.slice(`${SITE_ASSETS_DIR}/fonts/`.length)
            )) ||
          SITE_AREAS.some(
            (area) =>
              name === `${OG_IMAGES_DIR}/${area}.png` ||
              (name.startsWith(`${OG_IMAGES_DIR}/${area}/`) &&
                name.endsWith(".png"))
          )
        );
      })
      .map((path) => rm(path, { force: true }))
  );
}
