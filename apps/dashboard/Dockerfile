# syntax=docker/dockerfile:1

FROM oven/bun:1.4.4-slim AS bun

FROM node:24.11.1-bookworm-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /app

FROM base AS builder
# Dependency manifests first, so source edits reuse the installed layer.
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
COPY apps/sites-builder/package.json ./apps/sites-builder/package.json
COPY apps/sites-e2e/package.json ./apps/sites-e2e/package.json
COPY apps/sites/package.json ./apps/sites/package.json
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
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --ignore-scripts --filter 'dashboard...' --filter turbo
COPY . .

ARG NOTRA_DEMO_MODE
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_NOTRA_DEMO_MODE
ARG NEXT_PUBLIC_UNLIMITED_ORGANIZATIONS
ARG WORKFLOW_BASE_URL
ARG UNKEY_SECRETS_ID=notra-build-env
ENV NITRO_PRESET=node-server
RUN --mount=type=secret,id=${UNKEY_SECRETS_ID},target=/run/secrets/.env \
    set -a && if [ -f /run/secrets/.env ]; then . /run/secrets/.env; fi && set +a \
    && bunx turbo run build --filter=dashboard

FROM builder AS migrator
RUN mkdir -p /migrate \
  && bun build packages/db/src/scripts/migrate.ts --target=node \
    --external pg-native --outfile=/migrate/migrate.mjs \
  && cp -r packages/db/migrations /migrate/migrations \
  && printf '#!/bin/sh\nset -e\nexec node /migrate/migrate.mjs /migrate/migrations\n' > /migrate/run.sh \
  && chmod +x /migrate/run.sh

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV WORKFLOW_LOCAL_DATA_DIR=/tmp/notra-workflows
COPY --from=builder /app/apps/dashboard/.output /app/apps/dashboard/.output
COPY --from=migrator /migrate /migrate
WORKDIR /app/apps/dashboard
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
