# syntax=docker/dockerfile:1

FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY patches ./patches
COPY apps/agent/package.json ./apps/agent/package.json
COPY apps/ai-traffic-ingest/package.json ./apps/ai-traffic-ingest/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/console/package.json ./apps/console/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/docs/package.json ./apps/docs/package.json
COPY apps/evals/package.json ./apps/evals/package.json
COPY apps/onboarding-agent/package.json ./apps/onboarding-agent/package.json
COPY apps/sites/package.json ./apps/sites/package.json
COPY apps/sites-builder/package.json ./apps/sites-builder/package.json
COPY apps/ui/package.json ./apps/ui/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ai/package.json ./packages/ai/package.json
COPY packages/analytics/package.json ./packages/analytics/package.json
COPY packages/content-generation/package.json ./packages/content-generation/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/email/package.json ./packages/email/package.json
COPY packages/geo-core/package.json ./packages/geo-core/package.json
COPY packages/kiwi/package.json ./packages/kiwi/package.json
COPY packages/memory/package.json ./packages/memory/package.json
COPY packages/posthog/package.json ./packages/posthog/package.json
COPY packages/schemas/package.json ./packages/schemas/package.json
COPY packages/sites-compiler/package.json ./packages/sites-compiler/package.json
COPY packages/sites-core/package.json ./packages/sites-core/package.json
COPY packages/sites-server/package.json ./packages/sites-server/package.json
COPY packages/tools/package.json ./packages/tools/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY packages/webhooks/package.json ./packages/webhooks/package.json
COPY packages/workflows/package.json ./packages/workflows/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --ignore-scripts --filter api

FROM deps AS builder

COPY packages/ai ./packages/ai
COPY packages/analytics ./packages/analytics
COPY packages/content-generation ./packages/content-generation
COPY packages/typescript-config ./packages/typescript-config
COPY packages/db ./packages/db
COPY packages/geo-core ./packages/geo-core
COPY packages/memory ./packages/memory
COPY packages/posthog ./packages/posthog
COPY packages/schemas ./packages/schemas
COPY packages/sites-core ./packages/sites-core
COPY packages/utils ./packages/utils
COPY packages/webhooks ./packages/webhooks
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN bun run build

FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS runner

WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist

USER bun

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run","dist/index.mjs"]
