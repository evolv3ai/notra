# Model router

Privacy-aware routing between Neon AI Gateway, Vercel AI Gateway and OpenRouter, exposed to
the rest of the monorepo through `@notra/ai/gateway`:

```ts
import { gateway, assertRouteHasCredits } from "@notra/ai/gateway";

await assertRouteHasCredits({ organizationId });
const model = gateway("anthropic/claude-sonnet-5", { organizationId });
// pin a gateway when you rely on gateway-specific features:
const grounded = gateway("openai/gpt-5.4", { organizationId, gateway: "vercel" });
```

`gateway()` stays synchronous. It returns a lazy `LanguageModelV4`
(`RoutedLanguageModel`) that resolves its route on the first
`doGenerate`/`doStream`, so it composes with `wrapLanguageModel`, evlog and
devtools exactly like the old Vercel-only model.

## Policy

| situation                   | gateway                |
| --------------------------- | ---------------------- |
| pinned via `gateway` option | as pinned, no fallback |
| no organization context     | neon, subject to privacy |
| paid plan                   | neon, subject to privacy |
| free plan                   | neon, subject to privacy |

Neon is preferred for supported models when privacy allows it (`zdr: "none"`,
or the existing development-only bypass). Fallback order is Neon → OpenRouter →
Vercel, skipping the current gateway and any unavailable routes. Explicit
pins remain pinned. Missing Neon configuration does not disable other gateways.

Configure `NEON_AI_GATEWAY_API_KEY` (or Neon's standard
`NEON_AI_GATEWAY_TOKEN`) and `NEON_AI_GATEWAY_BASE_URL`. The URL is the branch
gateway host from Connect → AI Gateway; a trailing `/v1` is also accepted.
Only models with a `neon` entry in `MODEL_ROUTES` are routed to Neon; other
models fall back. Neon does not receive Vercel/OpenRouter routing or automatic
model-fallback options. Each model family uses Neon's native endpoint, because
chat completions rejects OpenAI function tools with reasoning, Claude
structured output, Gemini tool schemas and provider web search: OpenAI →
Responses (`/openai/v1`), Claude → Messages (`/anthropic/v1`, with top-level
`cache_control` like Vercel's auto caching), Gemini → `/gemini/v1beta`, and
everything else (gpt-oss, Grok, Kimi, GLM, Llama) → chat completions (`/v1`).
OpenAI calls default to `store: false` on Neon. Neon rejects
`service_tier: "flex"` (400), so the Vercel-only `gateway.serviceTier` option
is dropped there and the call runs at standard price. Served ids such as
`gpt-5.4-nano-2026-03-17` or `global.xai.grok-4.7` map back to the neutral id
so billing finds the price; Neon reports no cost, so steps are priced from
`MODEL_PRICING` (`neon/…` entries where Neon's list price differs).

Neon's default account limits are 200k tokens per minute and a $20 daily spend
cap (429 `REQUEST_LIMIT_EXCEEDED`). Any 429 falls back to OpenRouter, then Vercel,
for that call; the daily cap additionally skips Neon for
`DEFAULT_UNAVAILABLE_TTL_MS`.

## Provider-defined tools

Routing reads the provider-defined tools of each call (e.g.
`openai.web_search`) and skips gateways that cannot serve them for the model
(`fallbackReason: unsupported-tool`). Neon serves OpenAI web search on
Responses and Google search on Gemini (`NEON_ENDPOINT_TOOLS`); Vercel serves
all of them; OpenRouter none. Callers therefore do not pin gateways for
search: `gateway(model, { organizationId })` with `tools` is enough. Pin only
when the model itself depends on a gateway (Perplexity Sonar).

The plan is resolved once per organization through `resolvePlan`
(`@notra/ai/billing/plan` → Autumn) and cached for 60 s. Concurrent misses
share one lookup; failed lookups are retried after 5 s.
The policy is defined in `@notra/ai/constants/router` and applies to all
organizations immediately. Development omits ZDR flags unless a caller sets
one explicitly; other environments enforce ZDR.

## Privacy

Strict requests (`zdr: "required"`) enforce zero data retention and no training:

- OpenRouter: `provider: { zdr: true, data_collection: "deny" }`.
- Vercel: `gateway: { zeroDataRetention: true, disallowPromptTraining: true }`.
- Neon: not ZDR-capable. [Neon's retention policy](https://neon.com/docs/ai-gateway/data-retention)
  permits temporary input/output storage for abuse monitoring (up to 30 days).
  Strict requests skip Neon; `preferred` requests use a compliant route first.
  Explicit caller privacy restrictions are never silently discarded for Neon.

If no compliant route is available, strict requests fail closed.

Callers that accept best-effort privacy pass `zdr: "preferred"`. The router
tries a compliant route first. If providers reject the privacy requirements
and no compliant fallback exists, it retries with the ZDR default relaxed.
No-training is never relaxed, so a model without a provider that disallows
prompt training (such as Muse Spark's "No providers that disallow prompt
training" error) fails closed without that retry. The result is logged as `ai.router.zdr_bypassed`
with `zdrEnforced: false`.

Requests with `zdr: "none"` relax the ZDR default immediately and keep
no-training on. These modes work
outside development and do not depend on the development-only `allowNonZdr`
policy. Explicit caller no-training restrictions remain in effect.

Explicit positive privacy flags are translated across gateways before foreign
option blocks are stripped. A deny/no-training or ZDR requirement wins over
relaxed defaults and conflicting allow flags, including on runtime fallback.

OpenRouter receives `zdr: false` on relaxed calls to override the strict
provider and model defaults.

## Model catalog

`MODEL_ROUTES` (`@notra/ai/constants/model-routes`) is the one place to touch
when a model is added: its Neon id (and endpoint when it differs from the
family default), its OpenRouter id when it differs or `false` when OpenRouter
lacks it, `vercel: false` for retired models, and the short ids Vercel reports
back. `router/model-ids.ts` derives every lookup from it. Prices stay in
`MODEL_PRICING`. A model a gateway lacks is skipped
(`fallbackReason: unsupported-model`) instead of burning a request first.

## Upstream failures

`classifyUpstreamFailure()` decides whether a failed call may retry on
another gateway (each gateway at most once per call, plus a preferred-privacy retry): credit exhaustion (402), rejected credentials (401), a
missing ZDR host or no-training provider (`non-compliant`), an unknown model
(404) and transient upstream errors (5xx, 408/409/425/429, network
failures). Rejected credentials mark the whole gateway unavailable for
`DEFAULT_UNAVAILABLE_TTL_MS`, so later requests resolve straight to the
other gateway instead of failing one by one. A failure on the fallback call
is classified and marked the same way, and when no eligible route remains a
rejected credential surfaces as `GatewayUnavailableError` rather than the
raw upstream error. Validation errors, aborts and prompt-level client
errors still surface to the caller.

## Provider options

Call sites use `withRouterDefaults()` from `@notra/ai/provider-options`, which
writes a neutral `providerOptions.notraRouter` block (`caching`,
`fallbackModels`, `reasoning`). The router translates it per gateway and strips
the other gateway's block, so `gateway` options never reach OpenRouter and vice
versa. Vendor blocks (`anthropic`, `openai`) pass through; for OpenRouter the
Anthropic thinking / OpenAI reasoning settings are mapped to
`openrouter.reasoning`.

## Observability

- `ai.call.limit_hit` (warning) records HTTP 402/429 on every failed attempt,
  even when fallback succeeds or the gateway is pinned. Fields include `gateway`,
  `status`, model, `callId`, attempt count and request context. Stream errors
  with HTTP status codes use the same event. `limitType` and `limitReason`
  distinguish daily spend/token caps, credit balance and rate limits; an
  unidentified 429 remains `unknown`. Classification inspects the error but never
  emits raw error bodies, prompts, headers or credentials. Numeric request/token
  allowances and `Retry-After` guidance are included when supplied by the provider,
  including headers on wrapped SDK errors. Retry times are not confirmed resets;
  a rate-window reset is not used as a daily-cap reset. Missing cap amounts and
  reset times are explicitly unknown. Neon's "reached ... daily spend limit"
  response now also activates the existing daily-limit cooldown without disabling
  fallback.
- These events also notify the existing `GEO_SCAN_ALERT_WEBHOOK_URL` Slack
  destination when Redis is configured. Redis deduplicates alerts per environment,
  gateway, status and limit type across instances. Only the first failure posts a
  message; every matching failure atomically refreshes a one-hour quiet period.
  A new message is allowed only after an hour without that failure, rather than
  every five minutes during a continuing outage. Different gateways/statuses and
  limit types still alert independently, so a rate-limit alert does not hide a
  daily-cap alert. Full logs and model fallback are unaffected. Messages include
  the cause, reported timing and a recovery action, without claiming fallback succeeded.
  Alerts run in the background and are awaited by `flushLogs`.
  Failed deliveries release the deduplication key so the next limit hit can retry;
  delivery failures never affect model calls. No prompt or response body is sent.
- evlog events: `ai.router.route`, `ai.router.fallback`,
  `ai.router.fallback_unavailable`, `ai.router.no_compliant_route`,
  `ai.router.zdr_rejected`, `ai.router.zdr_bypassed`,
  `ai.router.auth_rejected`, `ai.router.plan_lookup_failed`,
  `ai.router.credits`, `ai.router.credits_check_failed`,
  `ai.router.generation_lookup_failed`.
- `providerMetadata.notraRouter` on every result / stream `finish` part:
  gateway, generation ID, requested + mapped model, plan, reason and fallback
  info. `summarizeRouteUsage(steps)` (`@notra/ai/utils/route-usage`) also
  resolves Vercel generation details to include the upstream provider and
  gateway-reported cost without blocking token streaming.

## Extraction

Organization and credit lookups use named `Effect.fn` operations with
`Effect.tryPromise`, so SDK failures stay in the typed error channel rather than
becoming defects. Existing Effect caches still deduplicate concurrent lookups
and retain the short failure TTL. Public methods remain Promise/AI-SDK APIs;
model generation and Web Streams do not need an additional Effect runtime.

`packages/ai/src/router/**` has no `process.env` reads; gateways, plan and
ZDR lookups and the logger are injected through `createModelRouter(config)`. The
Notra-specific glue (fixed policy, Autumn plan lookup, evlog logger, singleton)
lives in `packages/ai/src/constants/router.ts` and `packages/ai/src/gateway.ts`.

Live smoke test: `bun packages/ai/evals/router/live-check.ts` (uses the keys
from `.env`, fake plan resolver).

Neon does not expose a documented balance endpoint for inference credentials, so
its balance stays unknown; a 402 triggers fallback rather than a made-up balance.
