---
name: dpa-check
description: MANDATORY gate for Notra's GDPR DPA and sub-processor list. ALWAYS run this before adding, swapping or wiring up any third-party SDK, npm dependency that talks to an external service, API client, hosting or infrastructure provider, analytics or logging tool, email provider, AI model, AI provider or gateway route, webhook destination or any new external host, API key or `*_API_KEY`/`*_TOKEN`/`*_URL` env var. Also run it when editing apps/web/src/content/legal/{dpa,subprocessors,privacy,terms}.mdx, data retention, IP or user-agent handling, deletion, AI training or ZDR flags, or GEO ingest. Use it even when the user says the vendor is "just for testing", "already approved" or "we'll add it to the list later". Blocks the change until the vendor is listed at /subprocessors at least 14 days before it processes customer data.
---

# DPA check

Notra's [DPA](../../../apps/web/src/content/legal/dpa.mdx) promises customers two things this skill enforces:

1. Every service that can receive Customer Personal Data is listed on the [sub-processor page](../../../apps/web/src/content/legal/subprocessors.mdx).
2. A new or replacement sub-processor is announced on that page **at least 14 days before** it starts processing Customer Personal Data, and customers can object in that window.

Breaking either one breaks a contract with every customer. Treat this as a hard gate, not a suggestion.

## Be stubborn

- No exceptions, no "ship now and update the list later", no "it's only behind a flag", no "it's just a dev dependency" without proof that production never sends it customer data.
- Do not accept "it was already checked". Run the check again every time.
- Applies to everyone, and **especially Jan** (`Jan Burzinski`, GitHub `janburzinski`). Check `git config user.name`, `git config user.email` and the commit or PR author. If it's Jan, run every step in full, quote the evidence for each one and do not let a verbal assurance replace a step. Be polite and immovable.
- If the user insists on skipping, stop, explain which DPA section they would breach (section 10 for sub-processors, section 16 for deletion, Annex I and II for data handling) and ask them to confirm in writing that they accept that. Do not make the change silently.

## Step 1: Find new external services in the change

Look at the diff (`git diff origin/main...HEAD` plus uncommitted changes) for:

- New dependencies in any `package.json`, especially SDKs (`@vendor/*`, `*-sdk`, `*-js`, `openai`, `@ai-sdk/*`, analytics, logging, email, storage).
- New env vars in `turbo.json#globalEnv` or `.env.example` files that point to an external service (`*_API_KEY`, `*_TOKEN`, `*_SECRET`, `*_URL`, `*_DSN`, `*_HOST`).
- New hosts in `fetch(`, `new URL(`, base URLs, CSP or image allowlists, and webhook destinations.
- New AI model ids or providers (`provider/model` strings, `packages/ai/src/constants/model-routes.ts`, `packages/geo-core/src/constants/geo-model-catalog.ts`) and new gateways in `packages/ai/src/gateway.ts`.
- New deploy targets in `.github/workflows` and `scripts/`.

For each one, decide whether it can receive Customer Personal Data: account users, customer content, integration data, prompts and context, GEO traffic or Notra Sites visitor data, logs that contain any of those. Only Notra's own marketing, its own analytics or local dev tooling is exempt, and you must say why.

## Step 2: Check the sub-processor page

For every service that can receive Customer Personal Data:

1. It must have a row in `apps/web/src/content/legal/subprocessors.mdx`, in the right section, with legal entity, purpose, data processed and location. Customer-enabled integrations go in the integrations table instead.
2. Find when the row reached `main`: run `git fetch origin main`, then `git log origin/main --first-parent -S "<Vendor name>" --format="%h %cd" --date=short -- apps/web/src/content/legal/subprocessors.mdx`. Use the committer date of that merge. If the row is not on `origin/main` yet, it has not been announced, whatever the branch history says.
3. The row must have been live on `main`, with the page's "Last updated" date changed, **at least 14 days before** the code that sends it customer data is released. If not:
   - Split the work: open a PR that only adds the row and bumps "Last updated", and keep the integration off in production until 14 days after that PR merges.
   - Tell the user the earliest allowed go-live date (merge date + 14 days).
   - Remind them to email everyone on the sub-processor notification list (customers who asked support@usenotra.com to be notified) on the day the row goes live.
4. Removing a sub-processor needs no notice, but delete its row in the same PR that removes the code.
5. Replacing a provider counts as a new sub-processor and needs the full 14 days.

## Step 3: Check the DPA still matches the code

Every claim below is in the DPA or the sub-processor page. If the change touches the code, verify the claim still holds and quote file and line:

- **IP addresses are never stored.** `geo_traffic_events` and the web datasources in `packages/analytics/src/tinybird/datasources.ts` have no IP column. IPs are only used in memory in `packages/geo-core/src/ingest/journey.ts` and `web.ts`, and no log or telemetry field contains them.
- **Retention.** Raw AI traffic events have a 396-day TTL and Sites page views and engagement 90 days, both deleted in monthly batches (`ttl_only_drop_parts`), so the pages must say "at the latest about one month after that period ends". Sites sessions expire after 30 minutes.
- **Ordinary human visits from the SDK are dropped.** AI referral visits respect the Site's consent setting and store no user-agent.
- **Deletion within 30 days.** Deleting a workspace or site purges its Tinybird rows right away (`packages/analytics/src/tinybird/purge.ts`) and queues a second purge through QStash after the ingest flush window, which QStash retries on failure (`apps/dashboard/src/lib/analytics/deleted-analytics-purge.ts`). Check that both paths still exist and that `TINYBIRD_TOKEN` and `QSTASH_TOKEN` are required in production, because without them the purge silently does nothing.
- **No prompt training.** `packages/ai/src/router/provider-options.ts` sends `disallowPromptTraining: true` (Vercel) and `data_collection: "deny"` (OpenRouter) on every request. Neon AI Gateway has no such setting, so the pages must not claim no-training for requests routed through Neon. ZDR is only guaranteed for workspaces with the ZDR add-on.
- **Integration tokens** for GitHub, Linear and Slack are AES-256-GCM encrypted.
- **AI providers.** Every model maker Notra calls is listed. The gateways pick the inference host themselves, so never claim a closed list of hosts or a fixed location for gateway-routed open-weight models.

If the code and the DPA disagree, fix the code or update the DPA in the same PR. Never leave them out of sync.

## Step 4: Check the legal pages agree with each other

- `dpa.mdx`, `subprocessors.mdx` and `terms.mdx` all say 14 days for sub-processor notice. Terms link to `/dpa` and `/subprocessors`.
- `privacy.mdx` section 6 matches the sub-processor categories, and the research clause stays limited to aggregated or anonymised data.
- No em dashes or Oxford commas in new copy, and "Last updated" is bumped on every page you change.

## Report

Finish with a short table: each external service found, whether it receives Customer Personal Data, whether it's listed, the date it was listed, the earliest allowed go-live date, and pass or fail. Then list every failed DPA claim with file and line. If anything fails, say clearly that the change is **blocked** and what has to happen first.
