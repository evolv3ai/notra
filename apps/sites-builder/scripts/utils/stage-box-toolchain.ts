import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { listFiles } from "../../compiler/utils/fs";
import { TOOLCHAIN_ENTRIES } from "../constants/box-snapshot";

export async function stageBoxToolchain(stage: string) {
  const root = resolve(import.meta.dirname, "../..");
  mkdirSync(join(stage, "dist"), { recursive: true });
  for (const entry of TOOLCHAIN_ENTRIES) {
    cpSync(join(root, entry), join(stage, entry), { recursive: true });
  }
  execFileSync(
    "bun",
    [
      "--no-env-file",
      "build",
      join(root, "compiler/cli.ts"),
      "--target=node",
      "--format=esm",
      `--outfile=${join(stage, "dist/cli.mjs")}`,
      "--external",
      "astro",
      "--external",
      "satori",
      "--external",
      "@resvg/resvg-js",
    ],
    {
      cwd: root,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      stdio: "pipe",
    }
  );
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  writeFileSync(
    join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: "notra-sites-toolchain",
        private: true,
        type: "module",
        dependencies: pkg.dependencies,
      },
      null,
      2
    )}\n`
  );
  const hash = createHash("sha256");
  for (const file of (await listFiles(stage)).sort()) {
    hash.update(relative(stage, file));
    hash.update(readFileSync(file));
  }
  const version = hash.digest("hex").slice(0, 12);
  writeFileSync(join(stage, "VERSION"), `${version}\n`);
  return version;
}
