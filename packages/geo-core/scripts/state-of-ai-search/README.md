# State of AI Search collection

The landing page uses committed JSON, built from this standalone collector. There
is no scheduled collector in this repository; a dashboard GEO cron does not update
these reports.

## Providers

- **ChatGPT, Perplexity:** shared Olostep consumer-app parsers.
- **Gemini, Google AI Overview:** shared Context.dev browser/DOM capture adapters.
  All consumer captures use US location and English prompts; their underlying
  model is not reported or pinned.
- **Claude:** the pinned model in `shared.ts` through AI Gateway, using Context.dev
  web search (at most five searches per answer). This is an API measurement, not
  claude.ai. Only search results linked in the final answer count as citations.
- Context.dev consumer captures parse the actual answer DOM, not research answers
  synthesized by Context.dev. These must not be substituted for each other.
- SerpApi is no longer used. Olostep captures have no fabricated token billing.
  `SOAS_BUDGET` covers Gateway only; Context.dev and Olostep credits are separate.

Keys: `GEO_OLOSTEP_API_KEY_ENV` (or local alias `OLOSTEP_API_KEY`),
`CONTEXT_DEV_API_KEY`, `AI_GATEWAY_API_KEY`. Bun loads the root `.env` when run
from the repository root. Never use production keys for verification.

## Small, free dry run

```sh
SOAS_DRY_RUN=1 SOAS_EDITION=2026-11 SOAS_ONLY=postgres SOAS_LIMIT=1 SOAS_SAMPLES=1 \
  bun packages/geo-core/scripts/state-of-ai-search/collect.ts
```

This plans five answers, shows credential **presence only**, and performs no
network requests or output writes. It does not verify key validity, balances or
provider availability. For an isolated test use `SOAS_RAW_ROOT=/path/to/test-data`.
Use separate test credentials for any subsequent billable smoke test; remove
`SOAS_DRY_RUN=1` to actually submit the five answers.

## Next edition

Use a fresh `SOAS_EDITION=YYYY-MM`. Existing API samples cannot be resumed with
the new collection method. The default edition follows the current UTC month.
Run a full dry run first to see the planned item count; collection refuses more
than `SOAS_OLOSTEP_MAX_ITEMS=100` pending Olostep items or
`SOAS_CONTEXT_MAX_ITEMS=100` pending Context captures unless you explicitly raise
the corresponding cap.
Concurrency defaults to four (allowed: 1–16). `SOAS_ONLY`, `SOAS_ENGINES`,
`SOAS_START`, `SOAS_LIMIT` and `SOAS_SAMPLES` can narrow a run.

The current full plan is **4,920 answers: 2,400 Olostep captures, 1,320 Context
captures and 1,200 Claude API answers** (up to 6,000 additional Context.dev search requests). After checking provider
credits and approving that volume, the full collection command is:

```sh
SOAS_EDITION=2026-11 SOAS_OLOSTEP_MAX_ITEMS=2400 SOAS_CONTEXT_MAX_ITEMS=1320 \
  bun packages/geo-core/scripts/state-of-ai-search/collect.ts
```

The Gateway spend guard remains $400 by default; it is not a combined provider
budget. The full plan was only dry-run, not submitted.

Olostep batch IDs are checkpointed alongside answers (`*.json.olostep`), and
reruns poll those batches rather than resubmitting. A ten-minute wait deadline
leaves the batch resumable. A checkpoint without a batch ID means an ambiguous
submission: reconcile it with Olostep before manually removing that checkpoint.
All Olostep submissions are checkpointed first, then other providers run before
Olostep polling takes worker slots. Results are read per batch so their local
item IDs cannot overwrite each other.
Context captures similarly checkpoint submissions and successful answers in
`*.json.context`. A checkpoint without an answer needs manual review before a
new submission; captures are never automatically retried.
Do not run multiple collectors against the same edition/output directory.

After successful collection, build and validate with the **same edition/root**:

```sh
SOAS_EDITION=2026-11 bun packages/geo-core/scripts/state-of-ai-search/build.ts
SOAS_EDITION=2026-11 bun packages/geo-core/scripts/state-of-ai-search/validate.ts
```

Build writes website JSON; do not run it for a tiny smoke sample intended only for
verification. It preserves collected model IDs and rejects mixed methods/models
within an engine. Historical editions remain buildable. Treat the switch from
model APIs to consumer surfaces as a methodology break, not a model-controlled
month-over-month comparison.
