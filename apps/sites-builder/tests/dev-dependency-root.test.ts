import { expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("the dev allow list resolves the session's actual npm dependency root", async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "notra-dev-dependencies-"))
  );
  try {
    const dependencies = join(
      root,
      "npm-cache",
      "_npx",
      "install",
      "node_modules"
    );
    const session = join(root, "session");
    await mkdir(dependencies, { recursive: true });
    await mkdir(session);
    const modules = join(session, "node_modules");
    await symlink(dependencies, modules, "junction");
    const params = join(session, "params.json");
    await writeFile(
      params,
      JSON.stringify({
        config: {},
        workDir: session,
        area: "blog",
        mount: "/blog",
        publicOrigin: "http://localhost:4321",
      })
    );
    const config = fileURLToPath(
      new URL("../astro.config.mjs", import.meta.url)
    );
    const child = Bun.spawn(
      [
        process.execPath,
        "--eval",
        `const { default: config } = await import(${JSON.stringify(config)}); console.log(JSON.stringify(config.vite.server.fs.allow));`,
      ],
      {
        env: {
          ...process.env,
          NOTRA_BUILD_PARAMS: params,
          NOTRA_DEV_MODULES: modules,
        },
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    expect(await errors).toBe("");
    expect(JSON.parse(await output)).toContain(dependencies);
    expect(JSON.parse(await output)).not.toContain(
      join(dependencies, "node_modules")
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
