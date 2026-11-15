import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Copies the bundled renderer into a Notra CLI checkout as `sites/` and adds
// its runtime dependencies to the CLI's package.json. Run `bundle` first.
const cliRoot = process.argv[2];
if (!cliRoot) {
  throw new Error("usage: bun scripts/export-cli.ts <path to notra-cli>");
}
const root = resolve(import.meta.dir, "..");
const cli = resolve(cliRoot);
const destination = resolve(cli, "sites");
const manifestPath = resolve(destination, "manifest.json");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const renderer: Record<string, string> = pkg.dependencies;
const cliPackagePath = resolve(cli, "package.json");
const cliPkg = JSON.parse(await readFile(cliPackagePath, "utf8"));

// Only dependencies an earlier export added are the exporter's to replace, and
// only while the CLI still has the range that export wrote. Ones the CLI
// declares itself must already match the renderer's range.
const previous: Record<string, string> = await readFile(
  manifestPath,
  "utf8"
).then(
  (text) => JSON.parse(text).added,
  (error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
);
const dependencies: Record<string, string> = { ...cliPkg.dependencies };
const edited = Object.entries(previous).filter(
  ([name, range]) => name in dependencies && dependencies[name] !== range
);
if (edited.length > 0) {
  throw new Error(
    `notra-cli changed dependencies the last export added: ${edited
      .map(
        ([name, range]) => `${name} (${dependencies[name]}, exported ${range})`
      )
      .join(", ")}. Change them in apps/sites-builder instead.`
  );
}
for (const name of Object.keys(previous)) {
  delete dependencies[name];
}
const conflicts = Object.entries(renderer).filter(
  ([name, range]) => name in dependencies && dependencies[name] !== range
);
if (conflicts.length > 0) {
  throw new Error(
    `notra-cli declares different ranges than the renderer: ${conflicts
      .map(([name, range]) => `${name} (${dependencies[name]} vs ${range})`)
      .join(", ")}`
  );
}
const added = Object.fromEntries(
  Object.entries(renderer)
    .filter(([name]) => !(name in dependencies))
    .sort(([a], [b]) => a.localeCompare(b))
);
Object.assign(dependencies, renderer);
cliPkg.dependencies = Object.fromEntries(
  Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))
);
if (Array.isArray(cliPkg.files) && !cliPkg.files.includes("sites")) {
  cliPkg.files.push("sites");
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await Promise.all([
  ...["astro.config.mjs", "src", "dist"].map((entry) =>
    cp(resolve(root, entry), resolve(destination, entry), { recursive: true })
  ),
  cp(resolve(root, "../../LICENSE"), resolve(destination, "LICENSE")),
]);
await writeFile(
  manifestPath,
  `${JSON.stringify({ version: pkg.version, added }, null, 2)}\n`
);
await writeFile(cliPackagePath, `${JSON.stringify(cliPkg, null, 2)}\n`);
