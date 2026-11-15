import { basename, join } from "node:path";

// Astro only compiles components from node_modules (the c15t banner) when the
// toolchain shares the checkout's top-level directory, so each run stages it
// in the repository instead of its temp directory.
export function fixtureToolchain(root: string, temp: string) {
  return join(root, "apps/sites-e2e/.toolchains", basename(temp));
}
