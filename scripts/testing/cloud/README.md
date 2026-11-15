# Isolated Box → R2 → Worker benchmark

Run from the repository root with Bun and an already authenticated Wrangler CLI:

```sh
bun --no-env-file test scripts/testing/cloud/account.test.ts scripts/testing/cloud/cleanup.test.ts
bun --no-env-file x tsc --noEmit --project scripts/testing/cloud/tsconfig.json
bun --env-file=/path/to/approved.env scripts/testing/cloud/run.ts --repeats 1

SITES_TOOLCHAIN_STANDALONE_TEST=1 bun --no-env-file test \
  apps/sites-builder/tests/box-toolchain.test.ts
```

For bucket-scoped credentials, use the separately prepared test bucket's ownership
ledger instead of requesting access to every dynamically created bucket:

```sh
bun --env-file=/path/to/approved.env scripts/testing/cloud/run.ts \
  --bucket-ledger /private/path/company-resource-ledger.json --repeats 1
```

The prepared-bucket ledger records its exact account, profile, name and provider
creation timestamp. All are checked before use and again before cleanup. The
runner preserves that bucket and deletes only its unique run-owned deployment,
state and Worker-host objects through S3; foreign namespaces are rejected before
deletion. Recovery uses the saved reference and checks those namespaces are empty.
The prepared bucket itself belongs to its allocation owner, not to this run.

New runs require an explicit `SITES_E2E_CLOUDFLARE_ACCOUNT_ID` and
`SITES_E2E_WRANGLER_PROFILE`, plus `SITES_E2E_R2_ACCESS_KEY_ID`,
`SITES_E2E_R2_SECRET_ACCESS_KEY`, and `UPSTASH_BOX_API_KEY` from the approved env.
For the company account, select `notra-company` explicitly. The runner never
falls back to the local/production `SITES_R2_ACCOUNT_ID` or its S3 credentials.
Other env entries are discarded before provider operations. Every Wrangler call
pins the named profile and account, including in scratch directories, because
directory-scoped auth bindings do not follow a new checkout or temporary folder.
A read-only R2 access check runs before any cloud allocation. The profile/account
are saved in the ownership ledger for recovery. Wrangler uses a private scratch
config and a restricted child-process environment; generated and recovered
preview secrets are included in CLI error redaction. No existing deployment config
or provider user-global env is changed. There are no database or LLM calls.

The benchmark creates unique `notra-sites-e2e-*` resources and records intent before
provisioning in `~/.capy/work/<run-id>/ledger.json`. It stages the native snapshot
toolchain through the same `stageBoxToolchain` helper as the native snapshot
creator: the builder CLI is bundled in scratch, and the Astro theme includes its
self-contained runtime sources without adding compiler sources or unused
workspace dependencies. No secret env files or credentials enter the toolchain archive.
A guest environment-name and workspace-file audit precede snapshotting.
The snapshot and a `0600` `snapshot.env` containing only its ID and Box credential
remain for the parent pipeline. Every Box is ephemeral medium, has a ten-minute
TTL, and is deleted and checked absent through the Box API. No keep-alive is used.

Production `runSandboxBuild` performs extraction, compilation, output packing,
download, telemetry, and lifecycle cleanup. Its HTTP allocation is guarded for
both native `Request` objects and URL/init calls so Box intent and IDs are durable,
names are test-owned, and TTL is clamped. The build target disables analytics.
No Worker traffic ingestion endpoint is configured.

The new bucket is checked with the supplied S3 key before any SDK write. A 401/403
never falls back to an existing bucket. Instead, the report states the required
Object Read & Write permission on the new bucket and uses safe Wrangler OAuth
uploads as a **limited alternative**. When the key is permitted, the production
`publishDeploymentFiles` path is exercised. JSON manifest, serving state and host
records are validated against current production schemas in both paths.

The original production Worker entry point is deployed with only the new bucket
binding and `workers_dev`. Its generated hostname is stored as a schema-valid
`custom` host; `HOSTING_DOMAIN` is an unrelated `.invalid` domain. This exercises
real Worker/R2 behavior but **does not validate DNS, Cloudflare custom-host
registration, alias routing, GitHub, Dashboard, or the full deployment job**.
The first observed HTML request and the subsequent request are timed separately;
these are not evidence of the provider's isolate cold-start state.

Scratch `report.json` records provisioning, build, publishing, HTTP and cleanup
durations, cgroup CPU/memory metrics, output archives, and remaining resources.
The price estimate uses measured build CPU and the linked medium active-CPU rate;
it excludes snapshot preparation, storage, R2, Worker, transfer and free-tier
effects. It is not invoice cost. A cleanup error makes the command fail even if
the HTTP checks passed.

The opt-in standalone test installs the staged dependencies locally, reproduces
a missing theme runtime source failure, and builds the restored Acme fixture. It
allocates no cloud resources. Current theme references to `sites-core` are
type-only, so its package is not staged.

Recover after interruption, or delete the retained snapshot after the parent
pipeline no longer needs it:

```sh
bun --env-file=/path/to/approved.env scripts/testing/cloud/run.ts \
  --recover "$HOME/.capy/work/<run-id>"

bun --env-file=/path/to/approved.env scripts/testing/cloud/run.ts \
  --recover "$HOME/.capy/work/<run-id>" --delete-snapshot
```

Recovery touches only exact ledger-owned allowlisted resources, checks their
absence through provider APIs, and preserves retained snapshots unless explicitly
asked to delete them. Keep `snapshot.env` private; never commit or attach it.
Legacy ledgers without a recorded profile require an explicit
`SITES_E2E_WRANGLER_PROFILE` for recovery; the original account is read from their
saved config, never substituted with the current company's account. A mismatch
between a recorded ledger account and saved config is rejected.
