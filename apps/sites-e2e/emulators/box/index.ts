import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { stageBoxToolchain } from "../../../sites-builder/scripts/utils/stage-box-toolchain";
import { EmulatorError, startEmulator } from "../core/service";
import type {
  BoxEmulatorOptions,
  BoxFaultInjection,
  EmulatedBox,
} from "./types";

const WORKDIR = "/workspace/home";
const OUTPUT_LIMIT = 1024 * 1024;

// Box guests have coreutils `timeout`; macOS does not.
const TIMEOUT_SHIM = `#!/usr/bin/env node
const { spawn } = require("node:child_process");
const [seconds, command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: "inherit" });
const timer = setTimeout(() => { child.kill("SIGKILL"); process.exit(124); }, Number(seconds) * 1000);
child.on("exit", (code) => { clearTimeout(timer); process.exit(code ?? 1); });
`;

// The Upstash Box API, backed by local directories: a snapshot is this
// checkout's staged builder toolchain (what create-box-snapshot uploads),
// a box is a directory standing in for /workspace/home, and exec runs the
// command there with only PATH and HOME. Network isolation is not emulated.
export async function startBoxEmulator(options: BoxEmulatorOptions) {
  const root = resolve(options.directory, "box");
  const boxes = new Map<string, EmulatedBox>();
  const snapshots = new Map<string, string>();
  const failNext: BoxFaultInjection = options.failNext ?? { create: 0 };
  const shims = join(root, "bin");
  await mkdir(shims, { recursive: true });
  if (spawnSync("sh", ["-c", "command -v timeout"]).status !== 0) {
    await writeFile(join(shims, "timeout"), TIMEOUT_SHIM);
    await chmod(join(shims, "timeout"), 0o755);
  }

  const builder = resolve(import.meta.dirname, "../../../sites-builder");
  const snapshotDirectory = join(root, "snapshot", "toolchain");
  const version = await stageBoxToolchain(snapshotDirectory);
  // The real snapshot runs `npm install --omit=dev`; the checkout's install
  // provides the same packages.
  await symlink(
    join(builder, "node_modules"),
    join(snapshotDirectory, "node_modules"),
    "dir"
  );
  const snapshotId = `emulated-toolchain-${version}`;
  snapshots.set(snapshotId, snapshotDirectory);

  const authorize = (request: Request) => {
    if (request.headers.get("x-box-api-key") !== options.apiKey) {
      throw new EmulatorError(401, "Invalid API key");
    }
  };
  const boxOf = (request: Request, id: string | undefined) => {
    authorize(request);
    const box = boxes.get(id ?? "");
    if (!box || box.deleted) {
      throw new EmulatorError(404, `Box ${id} not found`);
    }
    return box;
  };
  const local = (box: EmulatedBox, path: string) => {
    if (path !== WORKDIR && !path.startsWith(`${WORKDIR}/`)) {
      throw new EmulatorError(400, `Path outside ${WORKDIR}: ${path}`);
    }
    const mapped = join(box.home, path.slice(WORKDIR.length));
    if (relative(box.home, mapped).startsWith("..")) {
      throw new EmulatorError(400, `Path escapes the box: ${path}`);
    }
    return mapped;
  };

  const server = await startEmulator("box", [
    {
      method: "POST",
      path: "/v2/box/from-snapshot",
      handle: async (request) => {
        authorize(request);
        const body = (await request.json()) as {
          snapshot_id?: string;
          name?: string;
          ttl?: number;
          network_policy?: { mode?: string };
        };
        const toolchain = snapshots.get(body.snapshot_id ?? "");
        if (!toolchain) {
          return Response.json(
            { error: "snapshot not found" },
            { status: 404 }
          );
        }
        if (failNext.create > 0) {
          failNext.create -= 1;
          const status = failNext.status ?? 503;
          return Response.json(
            {
              error:
                status >= 500
                  ? "Box capacity exhausted"
                  : "Box request rejected",
            },
            { status }
          );
        }
        const id = `box_${randomUUID().slice(0, 12)}`;
        const home = join(root, "boxes", id, "home");
        await mkdir(home, { recursive: true });
        await cp(toolchain, join(home, "toolchain"), {
          recursive: true,
          verbatimSymlinks: true,
        });
        boxes.set(id, {
          id,
          name: body.name ?? id,
          snapshotId: body.snapshot_id ?? "",
          networkPolicy: body.network_policy?.mode ?? "allow-all",
          home,
          deleted: false,
          commands: 0,
        });
        return Response.json({ id, name: body.name, status: "running" });
      },
    },
    {
      method: "POST",
      path: "/v2/box/:id/files/upload",
      handle: async (request, params) => {
        const box = boxOf(request, params.id);
        const form = await request.formData();
        const paths = form.getAll("paths").map(String);
        const files = form.getAll("files");
        if (paths.length !== files.length) {
          throw new EmulatorError(400, "paths and files differ in length");
        }
        for (const [index, path] of paths.entries()) {
          const file = files[index];
          if (!(file instanceof Blob)) {
            throw new EmulatorError(400, `files[${index}] is not a file`);
          }
          const target = local(box, path);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, new Uint8Array(await file.arrayBuffer()));
        }
        return Response.json({ uploaded: paths.length });
      },
    },
    {
      method: "POST",
      path: "/v2/box/:id/exec",
      handle: async (request, params) => {
        const box = boxOf(request, params.id);
        const { command } = (await request.json()) as { command?: string[] };
        const [program, ...args] = (command ?? []).map((part) =>
          part.replaceAll(WORKDIR, box.home)
        );
        if (!program) {
          throw new EmulatorError(400, "command is required");
        }
        box.commands += 1;
        const result = await new Promise<{ output: string; code: number }>(
          (resolveRun) => {
            let output = "";
            const child = spawn(program, args, {
              cwd: box.home,
              env: {
                PATH: `${shims}:${process.env.PATH ?? ""}`,
                HOME: box.home,
                ASTRO_TELEMETRY_DISABLED: "1",
              },
              stdio: ["ignore", "pipe", "pipe"],
            });
            const collect = (chunk: Buffer) => {
              if (output.length < OUTPUT_LIMIT) {
                output += chunk.toString();
              }
            };
            child.stdout.on("data", collect);
            child.stderr.on("data", collect);
            child.on("error", (error) =>
              resolveRun({ output: String(error), code: 127 })
            );
            child.on("close", (code) =>
              resolveRun({ output, code: code ?? 1 })
            );
          }
        );
        return Response.json({
          output: result.output,
          error: "",
          exit_code: result.code,
        });
      },
    },
    {
      method: "GET",
      path: "/v2/box/:id/files/read",
      handle: async (request, params, url) => {
        const box = boxOf(request, params.id);
        try {
          const content = await readFile(
            local(box, url.searchParams.get("path") ?? ""),
            "utf8"
          );
          return Response.json({ content });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return Response.json({ error: "file not found" }, { status: 404 });
          }
          throw error;
        }
      },
    },
    {
      method: "GET",
      path: "/v2/box/:id/files/download",
      handle: async (request, params, url) => {
        const box = boxOf(request, params.id);
        const path = local(box, url.searchParams.get("folder") ?? "");
        const info = await stat(path).catch(() => null);
        if (!info) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        if (!info.isFile()) {
          throw new EmulatorError(501, "Folder downloads are not emulated");
        }
        return new Response(await readFile(path), {
          headers: { "content-type": "application/octet-stream" },
        });
      },
    },
    {
      method: "DELETE",
      path: "/v2/box/:id",
      handle: async (request, params) => {
        const box = boxOf(request, params.id);
        box.deleted = true;
        await rm(dirname(box.home), { recursive: true, force: true });
        return Response.json({ deleted: true });
      },
    },
  ]);
  return {
    ...server,
    boxes,
    failNext,
    snapshotId,
    toolchainVersion: version,
    env: {
      SITES_BOX_API_URL: server.url,
      UPSTASH_BOX_API_KEY: options.apiKey,
      SITES_BUILDER_SNAPSHOT_ID: snapshotId,
    },
  };
}
