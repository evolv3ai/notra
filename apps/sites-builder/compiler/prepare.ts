import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, sep } from "node:path";

import { hasErrors } from "@notra/sites-compiler/utils/diagnostics";
import { isTextSourceFile } from "@notra/sites-compiler/utils/paths";
import { validateSite } from "@notra/sites-compiler/validate";
import { SITE_AREAS, SITE_ASSETS_DIR } from "@notra/sites-core/constants/sites";
import { SITE_IGNORE_FILENAME } from "@notra/sites-core/constants/source";
import { sortCustomScriptPaths } from "@notra/sites-core/utils/custom-scripts";
import { isSiteStylesheet } from "@notra/sites-core/utils/source-files";

import { collectSiteSource } from "./collect";
import type {
  PreparedSite,
  PrepareSiteParams,
  SiteFiles,
} from "./types/source";
import { listFiles, writeFileEnsured } from "./utils/fs";
import { prepareSiteFonts } from "./utils/site-fonts";

export async function readSiteFiles(siteRoot: string): Promise<SiteFiles> {
  const collected = await collectSiteSource(siteRoot);
  if (hasErrors(collected.diagnostics)) {
    return { collected, files: new Map() };
  }
  const texts = await Promise.all(
    collected.files.map((file) =>
      isTextSourceFile(file.path)
        ? readFile(join(siteRoot, file.path), "utf8")
        : null
    )
  );
  const files = new Map<string, string | null>(
    collected.files.map((file, index) => [file.path, texts[index] ?? null])
  );
  if (collected.ignoreContent !== null) {
    files.set(SITE_IGNORE_FILENAME, collected.ignoreContent);
  }
  return { collected, files };
}

export async function prepareSite(
  params: PrepareSiteParams
): Promise<PreparedSite> {
  const { collected, files } = await readSiteFiles(params.siteRoot);
  if (hasErrors(collected.diagnostics)) {
    return {
      validation: {
        ok: false,
        config: null,
        diagnostics: [],
        entries: [],
        outputs: new Map(),
      },
      collectDiagnostics: collected.diagnostics,
      publicFiles: [],
      customScripts: [],
    };
  }
  const validation = validateSite({
    files,
    defaultConfig: params.defaultConfig,
  });
  const publicFiles = collected.files
    .filter((file) => file.path.startsWith("public/"))
    .map((file) => file.path.slice("public".length));

  if (!(validation.ok && validation.config)) {
    return {
      validation,
      collectDiagnostics: collected.diagnostics,
      publicFiles,
      customScripts: [],
    };
  }

  if (params.incremental) {
    const siteDir = join(params.workDir, "site");
    const entriesDir = join(params.workDir, "entries");
    const expected = new Set([
      ...collected.files.map((file) => join(siteDir, file.path)),
      ...[...validation.outputs.keys()].map((path) => join(siteDir, path)),
      ...validation.entries.map((entry) =>
        join(entriesDir, entry.area, `${entry.slug}.${entry.format}`)
      ),
    ]);
    const staged = [
      ...(await listFiles(siteDir).catch(() => [])),
      ...(await listFiles(entriesDir).catch(() => [])),
    ];
    const generated = `${join(siteDir, "public", "_notra")}${sep}`;
    await Promise.all(
      staged
        .filter((path) => !expected.has(path) && !path.startsWith(generated))
        .map((path) => rm(path, { force: true }))
    );
    await Promise.all(
      [...expected].map(async (path) => {
        const existing = await stat(path).catch(() => null);
        if (existing?.isDirectory()) {
          await rm(path, { recursive: true, force: true });
        }
      })
    );
  } else {
    await rm(join(params.workDir, "site"), { recursive: true, force: true });
    await rm(join(params.workDir, "entries"), { recursive: true, force: true });
  }
  await Promise.all(
    SITE_AREAS.map((area) =>
      mkdir(join(params.workDir, "entries", area), { recursive: true })
    )
  );

  await Promise.all(
    collected.files.map(async (file) => {
      const target = join(params.workDir, "site", file.path);
      const transformed = validation.outputs.get(file.path);
      if (transformed !== undefined) {
        await writeFileEnsured(target, transformed);
        return;
      }
      if (params.incremental) {
        await writeFileEnsured(
          target,
          await readFile(join(params.siteRoot, file.path))
        );
      } else {
        await mkdir(dirname(target), { recursive: true });
        await cp(join(params.siteRoot, file.path), target);
      }
    })
  );
  await Promise.all(
    [...validation.outputs]
      .filter(([path]) => !files.has(path))
      .map(([path, source]) =>
        writeFileEnsured(join(params.workDir, "site", path), source)
      )
  );

  const customCss = collected.files
    .filter((file) => isSiteStylesheet(file.path))
    .map(
      (file) =>
        `@import ${JSON.stringify(join(params.workDir, "site", file.path))};`
    )
    .join("\n");
  await writeFileEnsured(join(params.workDir, "custom.css"), `${customCss}\n`);

  await mkdir(join(params.workDir, "site", "public", SITE_ASSETS_DIR), {
    recursive: true,
  });
  const customScripts = await Promise.all(
    sortCustomScriptPaths(collected.files.map((file) => file.path)).map(
      async (path) => {
        const source = await readFile(join(params.siteRoot, path));
        const name = path
          .replace(/\.js$/i, "")
          .replace(/[^A-Za-z0-9_-]+/g, "-");
        const fileName = `custom-${name}.${createHash("sha256").update(source).digest("hex").slice(0, 10)}.js`;
        await writeFileEnsured(
          join(params.workDir, "site", "public", SITE_ASSETS_DIR, fileName),
          source
        );
        return { path, fileName };
      }
    )
  );

  await Promise.all(
    validation.entries.map((entry) =>
      writeFileEnsured(
        join(
          params.workDir,
          "entries",
          entry.area,
          `${entry.slug}.${entry.format}`
        ),
        validation.outputs.get(entry.path) ?? files.get(entry.path) ?? ""
      )
    )
  );
  const fonts = await prepareSiteFonts(validation.config, params.workDir);
  validation.diagnostics.push(...fonts.diagnostics);
  return {
    validation,
    collectDiagnostics: collected.diagnostics,
    publicFiles: [...publicFiles, ...fonts.publicFiles],
    customScripts,
    fontStylesheet: fonts.stylesheet,
  };
}
