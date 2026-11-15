# Console

Next.js companion/admin app on port 3003, imported from `usenotra/notra-console`
at `c868f26`. The dashboard and website remain TanStack Start apps.

- Use the root Bun workspace, lockfile, lint/format configuration, and Git hooks.
- Run tasks from the monorepo root with `bun run <task> --filter=console`.
- Configure shared secrets in the root `.env`; see `.env.example` here for the
  console's requirements. Never copy production credentials for verification.
- Keep `CONSOLE_APP_URL` and `CONSOLE_WORKOS_REDIRECT_URI` separate from the
  dashboard URLs. Register the console callback in WorkOS.
- Database migrations are owned by `packages/db`, never this app.
- Use `@notra/db` for all schema and database access, `@notra/ai` for MCP,
  encryption, uploads and skill seeding, and `@notra/ui` for UI primitives,
  styles, hooks and dialogs. Do not reintroduce app-local copies.
- Store listing review/curation lives in `@notra/ai/integrations/mcp-store-admin`;
  public catalog reads live in `@notra/ai/integrations/mcp-store`.
- System skills are published from `/[slug]/skills`. Publishing and pushing to
  workspaces live in `@notra/ai/skills/registry`; console reads live in
  `@notra/ai/skills/registry-admin`.
- Next-specific AuthKit actions and login/verification flow adapters remain in
  this app; their visual primitives come from `@notra/ui`.
- Read the installed `next/dist/docs/` guides before changing framework code.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
