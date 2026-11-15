# Notra Sites local development

The Notra CLI ships the same compiler and Astro theme as hosted Notra Sites in
its `sites/` folder, exported from this workspace. Local previews need no login
or API key. Node.js 22.12 or newer can run the CLI without Bun; Bun can also run it
directly.

From a site folder containing `blog.json`, `blog/`, or `changelog/`:

```bash
notra dev
notra dev --source ./hosted-site --port 4400
```

Without a global CLI installation:

```bash
npx notra@latest dev
bunx --bun notra@latest dev
```

The default address is `http://localhost:4321`. Blog and changelog are served
under `/blog` and `/changelog`; `/` redirects to the blog. Drafts are included,
and analytics integrations are disabled. Content, styling, components, and
configuration refresh when their source files change. Stop with Ctrl+C.

## Work on the renderer

```bash
cd apps/sites-builder
bun dev
bun compiler/cli.ts dev --source /path/to/site --port 4400
```

`bun dev` uses the demo fixture. The Worker in `apps/sites` is the production
delivery layer, not the content preview server.

## Ship it in the CLI

```bash
bun run export:cli /path/to/notra-cli
```

This bundles the compiler, copies it with the Astro theme into the CLI's
`sites/` folder, and syncs the renderer's runtime dependencies into the CLI's
`package.json`. Workspace-only compiler dependencies are bundled into
`sites/dist/cli.mjs`. See `release.md` for the release steps.

To run the Notra CLI against an unreleased renderer without exporting:

```bash
bun run bundle
NOTRA_SITES_RUNTIME=/absolute/path/to/apps/sites-builder/dist/cli.mjs notra dev
```
