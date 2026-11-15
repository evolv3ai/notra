#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { renameSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { hasErrors } from "@notra/sites-compiler/utils/diagnostics";
import { validateSite } from "@notra/sites-compiler/validate";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteRedirectRule } from "@notra/sites-core/types/deployment";
import {
  listMountedAreas,
  normalizeSiteMounts,
} from "@notra/sites-core/utils/mounts";
import { siteRedirectRules } from "@notra/sites-core/utils/redirects";

import { buildSite, readBuildTarget, writeBuildParams } from "./build";
import { USAGE } from "./constants/cli";
import {
  findFreePort,
  findUnusedPort,
  paramsForArea,
  startDevProxy,
  stopAstroDev,
} from "./dev-server";
import { writeOgImages } from "./og-images";
import { prepareSite, readSiteFiles } from "./prepare";
import type { DevAreaServer, RunningDevArea } from "./types/dev-server";
import { startDevAreas } from "./utils/dev-areas";
import { createDevRefresh } from "./utils/dev-refresh";
import { localDefaultConfig } from "./utils/local-options";

const TOOLCHAIN_ROOT = fileURLToPath(new URL("..", import.meta.url));

function formatDiagnostic(diagnostic: SiteDiagnostic): string {
  const location = diagnostic.file
    ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ""}` : ""}`
    : "site";
  return `${diagnostic.severity === "error" ? "✖" : "⚠"} ${location}  ${diagnostic.message}`;
}

function printDiagnostics(diagnostics: SiteDiagnostic[]) {
  for (const diagnostic of diagnostics) {
    process.stderr.write(`${formatDiagnostic(diagnostic)}\n`);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const { values } = parseArgs({
    args: rest,
    options: {
      source: { type: "string", default: "." },
      target: { type: "string" },
      out: { type: "string" },
      area: { type: "string" },
      port: { type: "string", default: "4321" },
      json: { type: "boolean", default: false },
      "result-file": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const siteRoot = resolve(values.source ?? ".");

  if (command === "validate") {
    const target = values.target
      ? await readBuildTarget(values.target)
      : undefined;
    if (target) {
      normalizeSiteMounts(target.mounts);
    }
    const { collected, files } = await readSiteFiles(siteRoot);
    const result = validateSite({
      files,
      defaultConfig: localDefaultConfig(siteRoot, target),
    });
    const diagnostics = [...collected.diagnostics, ...result.diagnostics];
    const ok = !hasErrors(diagnostics);
    if (values.json) {
      process.stdout.write(
        `${JSON.stringify({ ok, diagnostics, entries: result.entries }, null, 2)}\n`
      );
    } else {
      printDiagnostics(diagnostics);
      process.stderr.write(
        ok
          ? `✔ ${result.entries.length} entries, ${files.size} files look good\n`
          : "Validation failed\n"
      );
    }
    process.exit(ok ? 0 : 1);
  }

  if (command === "build") {
    if (!(values.target && values.out)) {
      throw new Error("build needs --target and --out");
    }
    const target = await readBuildTarget(values.target);
    const result = await buildSite({
      toolchainRoot: TOOLCHAIN_ROOT,
      siteRoot,
      target,
      outDir: resolve(values.out),
    });
    if (values["result-file"]) {
      await writeFile(values["result-file"], JSON.stringify(result));
    }
    if (values.json) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      printDiagnostics(result.diagnostics);
      process.stderr.write(
        result.ok
          ? `✔ Built ${result.areas.map((area) => `${area.area} at ${area.mount} (${area.durationMs} ms)`).join(", ")}: ${result.fileCount} files, ${(result.totalBytes / 1024).toFixed(0)} KB\n`
          : "Build failed\n"
      );
    }
    process.exit(result.ok ? 0 : 1);
  }

  if (command === "dev") {
    const target = values.target
      ? await readBuildTarget(values.target)
      : undefined;
    const mounts = normalizeSiteMounts(
      target?.mounts ?? { blog: "/blog", changelog: "/changelog" }
    );
    const defaultConfig = localDefaultConfig(siteRoot, target);
    const requestedPort = Number(values.port ?? "4321");
    if (
      !Number.isInteger(requestedPort) ||
      requestedPort < 1 ||
      requestedPort > 65533
    ) {
      throw new Error("--port must be an integer between 1 and 65533");
    }
    const port = await findUnusedPort(requestedPort);
    if (port !== requestedPort) {
      process.stderr.write(
        `Port ${requestedPort} is in use, using ${port} instead.\n`
      );
    }
    if (values.area && values.area !== "blog" && values.area !== "changelog") {
      throw new Error("--area must be blog or changelog");
    }
    const workDir = await realpath(
      await mkdtemp(join(tmpdir(), "notra-sites-dev-"))
    );
    const mounted = listMountedAreas(mounts);
    const areas: DevAreaServer[] = [];
    let nextPort = port + 1;
    try {
      for (const entry of mounted) {
        const areaPort = await findFreePort(nextPort);
        nextPort = areaPort + 1;
        areas.push({
          ...entry,
          port: areaPort,
          paramsPath: join(workDir, `params.dev.${entry.area}.json`),
        });
      }
    } catch (error) {
      await rm(workDir, { recursive: true, force: true });
      throw error;
    }
    const selected =
      areas.find((entry) => entry.area === values.area) ?? areas[0];
    if (!selected) {
      process.exit(1);
    }
    const ordered = [selected, ...areas.filter((area) => area !== selected)];
    const documentSession = randomBytes(18).toString("base64url");
    let documentGeneration = 0;
    let running: RunningDevArea[] = [];
    let siteErrors: SiteDiagnostic[] = [];
    let redirects: SiteRedirectRule[] = [];
    const stopAreas = async () => {
      const stopping = running;
      running = [];
      await Promise.all(stopping.map(stopAstroDev));
    };
    const refresh = createDevRefresh({
      params: {
        area: selected.area,
        mount: selected.mount,
        publicOrigin: `http://localhost:${port}`,
        hostingDomain: target?.hostingDomain,
        siteId: "local",
        deploymentId: "local",
        noindex: true,
        includeDrafts: true,
        branding: target?.branding ?? true,
        workDir,
        mounts,
      },
      prepare: () =>
        prepareSite({
          siteRoot,
          workDir,
          incremental: true,
          defaultConfig,
        }),
      writeOgImages,
      printDiagnostics: (diagnostics) => {
        siteErrors = diagnostics.filter(
          (diagnostic) => diagnostic.severity === "error"
        );
        printDiagnostics(diagnostics);
      },
      reportError: (error) => process.stderr.write(`${String(error)}\n`),
      publish: async (params, isCurrent) => {
        for (const area of areas) {
          const temporaryPath = `${area.paramsPath}.tmp`;
          await writeBuildParams(temporaryPath, paramsForArea(params, area));
          if (!isCurrent()) {
            return false;
          }
          renameSync(temporaryPath, area.paramsPath);
        }
        redirects = siteRedirectRules(params.config.redirects);
        return true;
      },
      runAstro: async (astroCommand) => {
        await stopAreas();
        if (astroCommand === "stop") {
          return 0;
        }
        documentGeneration += 1;
        for (const area of areas) {
          area.documentToken = `${documentSession}.${documentGeneration}`;
        }
        running = (await startDevAreas(TOOLCHAIN_ROOT, areas)) ?? [];
        return running.length === areas.length ? 0 : 1;
      },
    });
    let watchedRefresh: Promise<boolean> | undefined;
    let proxy: Server | undefined;
    let watcher: FSWatcher | undefined;
    let stopping: Promise<void> | undefined;
    const stop = () => {
      stopping ??= (async () => {
        watcher?.close();
        proxy?.close();
        await refresh.shutdown();
        await rm(workDir, { recursive: true, force: true });
      })();
      return stopping;
    };
    let interrupted = false;
    const onSignal = () => {
      interrupted = true;
      stop()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          process.stderr.write(`${String(error)}\n`);
          process.exit(1);
        });
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    process.on("SIGHUP", onSignal);
    try {
      watcher = watch(siteRoot, { recursive: true }, () => {
        const requested = refresh.refresh(150);
        if (requested !== watchedRefresh) {
          watchedRefresh = requested;
          requested.catch((error: unknown) =>
            process.stderr.write(`${String(error)}\n`)
          );
        }
      });
      proxy = await startDevProxy(
        port,
        mounts,
        ordered,
        async () => {
          await watchedRefresh;
        },
        () => siteErrors,
        () => redirects
      );
      if (interrupted) {
        proxy.close();
        await stop();
        process.exit(0);
      }
      watchedRefresh = refresh.refresh();
      const started = await watchedRefresh;
      if (interrupted) {
        await stop();
        process.exit(0);
      }
      const urls = areas
        .map((area) => `${area.area} at http://localhost:${port}${area.mount}`)
        .join(" and ");
      // Errors at startup keep the server up: the next save that fixes them
      // starts the preview, like any later edit.
      process.stderr.write(
        started
          ? `Previewing ${urls}\n`
          : `Fix the errors above to preview ${urls}. Waiting for changes...\n`
      );
      await new Promise(() => undefined);
    } catch (error) {
      await stop();
      throw error;
    }
  }

  process.stderr.write(`${USAGE}\n`);
  process.exit(command ? 1 : 0);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
