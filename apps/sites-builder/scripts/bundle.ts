import { readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { resolve } from "node:path";

// Bundles only workspace code. npm packages stay imports, resolved from this
// package's dependencies, which the CLI export and Box snapshot install.
const root = resolve(import.meta.dir, "..");
const { dependencies } = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8")
);
const builtins = new Set(builtinModules);
const externals = new Set<string>();

const result = await Bun.build({
  entrypoints: [resolve(root, "compiler/cli.ts")],
  outdir: resolve(root, "dist"),
  naming: "cli.mjs",
  target: "node",
  format: "esm",
  plugins: [
    {
      name: "external-packages",
      setup(build) {
        build.onResolve({ filter: /^[^./]/ }, ({ path }) => {
          if (path.startsWith("@notra/") || path.startsWith("node:")) {
            return;
          }
          const name = path
            .split("/")
            .slice(0, path.startsWith("@") ? 2 : 1)
            .join("/");
          if (!builtins.has(name)) {
            externals.add(name);
          }
          return { path, external: true };
        });
      },
    },
  ],
});
if (!result.success) {
  throw new AggregateError(result.logs, "bundle failed");
}
const missing = [...externals].filter((name) => !(name in dependencies));
if (missing.length > 0) {
  throw new Error(
    `dist/cli.mjs imports packages missing from dependencies: ${missing.join(", ")}`
  );
}
