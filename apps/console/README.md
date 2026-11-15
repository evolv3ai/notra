# Notra Console

Companion/admin app for integrations, organizations, GEO reports, and Sites.
Imported from `usenotra/notra-console` at `c868f26` (including Sites admin).
It remains a separate Next.js app; the dashboard and website use TanStack Start.

## Development

From the monorepo root, run `bun install`, configure the root `.env` using the
root example and this app's [environment reference](.env.example), then:

```bash
bun run dev --filter=console
```

The console runs at `http://localhost:3003`. Set `CONSOLE_APP_URL` to that origin
and `CONSOLE_WORKOS_REDIRECT_URI=http://localhost:3003/auth/callback`; register
the callback with WorkOS. Shared database and authentication credentials are
required for signed-in functionality. Never use production data for local tests.

Sign-in uses the shared Notra login UI with direct WorkOS password, social,
email verification and TOTP challenge/enrollment adapters. Do not send normal
sign-in through hosted AuthKit: this environment uses a separate external-OAuth
login bridge that does not preserve User Management authorization sessions.
Social sign-in returns to `/auth/social/callback`, as in the standalone console;
register that existing callback for the console origin. `/auth/sign-in` is only
a compatibility redirect to `/login`. Backup-code recovery and registration
remain in the dashboard.
Production requires the shared Upstash Redis configuration for sliding-window
rate limiting; missing configuration fails closed.

Sites admin calls the dashboard via `NOTRA_DASHBOARD_URL` and
`INTERNAL_WORKFLOW_SECRET`. Only loopback development requests are accepted
without that secret. R2 credentials are needed for stored Sites build logs.

## Checks

```bash
bun run check
bun run check-types --filter=console
bun run knip --filter=console
bun run build --filter=console
```

Run `bun run start` from `apps/console` to serve the production build on port
3003. Deployments must select `apps/console` as the app directory and install
from the workspace root. No deployment or credentials are provisioned by this import.

### Production cutover

Keep the existing Vercel project `notra-console` and its `console.usenotra.com`
domain. After configuring the shared infrastructure, connect it to
`usenotra/notra`, set the root directory to `apps/console`, enable access to
files outside the root directory, and use Node.js 24.x. The app's `vercel.json`
installs the Bun workspace dependencies and disables direct Git deployments;
production releases are owned by `.github/workflows/production-deploy.yml`.

Coordinate this source switch with merging the console into `main`. The release
script refuses to deploy the console from an incorrectly linked project. Its
one-time import recognizes only the known standalone repository and commit;
subsequent releases retain the normal forward-only commit checks.

The console and dashboard should use the same production database, Redis and
integration encryption key. Inspect and migrate any separate console data before
changing its database URL; code sharing does not merge databases. Keep the
console cookie name `wos-console-session` separate from the dashboard cookie.
Set `CONSOLE_WORKOS_REDIRECT_URI` explicitly, rather than relying on the
dashboard's redirect variable. Preview environments require their own test
database and registered WorkOS callback; do not copy production configuration
into previews.

## Shared code

The console imports the canonical database from `@notra/db`, MCP/OAuth,
encryption, uploads and skill seeding from `@notra/ai`, and components, dialogs,
hooks, motion tokens and styles from `@notra/ui`. Sites JSON types come from
`@notra/sites-core`; GEO report types derive from the shared database contract.
There are no app-local AI, database or registry UI copies.

Next-specific AuthKit actions and direct sign-in adapters stay local;
their visual primitives are shared. Store curation/review extends the common
MCP implementation without changing dashboard connection semantics.

Database migrations are exclusively managed by `packages/db` and
`bun run db:migrate`.

## Verification notes

Builds and the anonymous login smoke check work without live credentials. Real
WorkOS login and database-backed flows still require a local/test environment.
Database integration tests skip when no test database is configured.

Social sign-in validates a short-lived, server-stored state and PKCE verifier;
MFA is verified by WorkOS before a session is saved. Redirect destinations use
the shared same-origin validator. Chart
libraries remain static imports inside dynamically loaded chart components.
