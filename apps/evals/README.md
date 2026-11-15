# evals

Model comparison harness for the content pipeline, with an OpenTUI interface.

```sh
bun run evals            # TUI (falls back to demo without AI_GATEWAY_API_KEY)
bun run evals --demo     # simulated models, no API calls
bun run evals run content-draft --models anthropic/claude-sonnet-5,openai/gpt-6-sol
bun run evals list       # suites
bun run evals runs       # saved runs
bun run evals pick       # cheapest model per stage from the saved runs
bun run evals box autopilot-planner --models a,b --repeats 2   # same run inside an Upstash Box
```

Reads the repo root `.env` (only `AI_GATEWAY_API_KEY` is needed). Runs are saved to `apps/evals/.runs/<id>.json` while they run, so a crash keeps partial results and errors can be retried from the results view.

## Suites

| Suite | Mirrors | Scored on |
|---|---|---|
| `content-draft` | background-gen writing step, gathering replayed | decision, hard rules, Jev judge |
| `content-unslop` | background-gen unslop pass | slop removed, facts kept, grounding |
| `content-agent` | full `runBackgroundGen` loop | everything above + tool use |
| `collection-title` | `jobs/collection-title.ts` | format rules, brand spelling, Jev |
| `chat-router` | `orchestration/router.ts` (Jev vs LLM) | complexity, tools, reasoning, route |
| `feedback-classifier` | `jobs/feedback-classifier.ts` (Jev vs LLM) | kind, sentiment |
| `autopilot-planner` | `jobs/autopilot-planner.ts` + `evaluateAutopilotGate`, multi-run | linking, action, gate, rules, stability, memory |

The content suites import the real dispatcher prompt, skills, user prompt and tool definitions from `@notra/ai`. Only the tools' `execute` functions are swapped for fixture data (`src/fixtures/content-scenarios.ts`), so nothing touches the DB, GitHub or Redis.

`autopilot-planner` swaps only the planner model. Each case is a scenario of one to three Autopilot runs (`src/fixtures/autopilot-scenarios.ts`): the real `planAutopilotRun` links observations into topics, prod Jev rates the proposed action, the real gate decides, and an open or suggested action becomes in-flight work for the next run, as in the dashboard. State moves between runs only through an in-memory `@notra/memory` store written as actor `autopilot-run`, so the access rules and size limits apply. A case passes when linking, action, gate and rules are all right; slug reuse and the size of `planner.md` only move the score.

Jev (`typesafe-ai/jev-1.14.0`) is the judge for generated text: typed questions, calibrated probabilities, ~300 ms per case.

## Picking models

`p` on the home screen (or `bun run evals pick`) builds a plan from the saved runs: for every stage it takes the latest run per model and recommends the cheapest model that scores within the tolerance of the best one (default 2 pts, `←→`), has at least 5 scored cases (or all of a smaller suite) and fails no more than 10% of calls. Baseline is the model prod uses today, imported from `@notra/ai/constants`.

Set real calls per month with `+/-` to see $/month and the saving; `content-draft` and `content-unslop` run inside the content agent's call, so their spend is left out of the total. Untested catalog models that would be cheaper (average tokens × gateway price) are listed under the table. `v` starts a verification run (prod, pick, frontier and the two cheapest untested models, 2 repeats each) so a pick never rests on one noisy run. Settings are kept in `.cache/picker.json`.

## Running in an Upstash Box

`bun run evals box <suite>` takes the same options as `run` and needs `UPSTASH_BOX_API_KEY` (plus `AI_GATEWAY_API_KEY` unless `--demo`; `UPSTASH_BOX_BASE_URL` is optional). It bundles `src/box-entry.ts` into one Node file with `bun build`, creates an ephemeral box, uploads only that bundle and an `args.json`, runs it headless, streams the progress and copies the run JSON into `.runs/`. The box is deleted when the run ends, fails or is cancelled with Ctrl-C, and its 3 h TTL deletes it if that delete never lands.

The bundle instead of a clone or upload of the repo: nothing has to be installed, so the box needs no GitHub or npm access, no Effect bootstrap and no repo files, and it starts in seconds. The network policy allows only `ai-gateway.vercel.sh` (model calls, Jev, prices and cost lookups); demo runs get `deny-all`. The only secret in the box is `AI_GATEWAY_API_KEY`, passed as an environment variable; no `.env` file is uploaded or read.
