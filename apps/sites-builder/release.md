# Shipping the Sites renderer

The renderer ships inside the public `notra` CLI package
([usenotra/notra-cli](https://github.com/usenotra/notra-cli)) in its `sites/`
folder. There is no separate npm package. `notra dev` runs `sites/dist/cli.mjs`
with the same Node or Bun that started the CLI.

`.github/workflows/sites-renderer.yml` verifies every renderer change here:
the Sites tests run, including `tests/packaged-dev.test.ts`, which exports the
renderer the way the CLI ships it and runs it installed on Node and Bun.

## Releasing a renderer change

1. Merge the change to `main` here.
2. From a `notra-cli` checkout on a new branch, export the renderer:

   ```bash
   bun run --cwd /path/to/notra/apps/sites-builder export:cli "$PWD"
   bun install
   ```

   This replaces `sites/`, adds `sites` to the CLI's `files`, and adds the
   renderer's dependencies to its `package.json`. `sites/manifest.json`
   records which ones the export added and their ranges, so a later export can
   replace them. The export stops if the CLI changed one of those ranges, or
   declares a shared dependency with a different range.
3. Open a CLI PR with the result and bump its version to release it.
