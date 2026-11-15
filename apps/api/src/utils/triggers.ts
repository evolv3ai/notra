import { contentTriggers, githubIntegrations } from "@notra/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";

import { deleteQstashWithRetry, qstashLayer } from "../lib/qstash";
import type { DbClient } from "../types/db";
import { logError } from "./logging";
import { runServiceEffect } from "./run-service-effect";

type DisabledTrigger = { id: string; name: string; sourceType: string };

type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export async function getTriggersForBrandIdentity(
  db: DbClient,
  organizationId: string,
  brandIdentityId: string
) {
  const allTriggers = await db.query.contentTriggers.findMany({
    where: eq(contentTriggers.organizationId, organizationId),
    columns: {
      id: true,
      name: true,
      sourceType: true,
      outputConfig: true,
      qstashScheduleId: true,
    },
  });

  return allTriggers.filter((trigger) => {
    const config = trigger.outputConfig as {
      brandVoiceId?: string;
    } | null;

    return config?.brandVoiceId === brandIdentityId;
  });
}

export async function getTriggersForIntegration(
  db: DbClient,
  organizationId: string,
  integrationId: string
) {
  const allTriggers = await db.query.contentTriggers.findMany({
    where: eq(contentTriggers.organizationId, organizationId),
    columns: {
      id: true,
      name: true,
      sourceType: true,
      targets: true,
      qstashScheduleId: true,
    },
  });

  return allTriggers.filter((trigger) => {
    const targets = trigger.targets as
      | {
          repositoryIds?: string[];
        }
      | undefined;

    if (!targets?.repositoryIds?.length) {
      return false;
    }

    return targets.repositoryIds.some(
      (targetId) =>
        targetId === integrationId || targetId === `linear:${integrationId}`
    );
  });
}

export async function disableTriggersAndDelete(
  db: DbClient,
  organizationId: string,
  affectedTriggers: readonly { id: string }[],
  deleteOwner: (tx: DbTransaction) => Promise<unknown>
) {
  await db.transaction(async (tx) => {
    if (affectedTriggers.length > 0) {
      await tx
        .update(contentTriggers)
        .set({
          enabled: false,
          qstashScheduleId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(contentTriggers.organizationId, organizationId),
            inArray(
              contentTriggers.id,
              affectedTriggers.map((trigger) => trigger.id)
            )
          )
        );
    }

    await deleteOwner(tx);
  });
}

export async function deleteQstashScheduleWithRetry(
  runtimeEnv: { QSTASH_TOKEN?: string; WORKFLOW_BASE_URL?: string },
  scheduleId: string
) {
  return runServiceEffect(
    deleteQstashWithRetry(scheduleId).pipe(
      Effect.provide(qstashLayer(runtimeEnv))
    )
  );
}

export async function deleteQstashSchedulesForTriggers(
  runtimeEnv: { QSTASH_TOKEN?: string; WORKFLOW_BASE_URL?: string },
  affectedTriggers: readonly { qstashScheduleId: string | null }[]
) {
  for (const trigger of affectedTriggers) {
    if (!trigger.qstashScheduleId) {
      continue;
    }

    try {
      await deleteQstashScheduleWithRetry(runtimeEnv, trigger.qstashScheduleId);
    } catch (error) {
      logError(
        `Failed to delete qstash schedule ${trigger.qstashScheduleId}`,
        error
      );
    }
  }
}

export function serializeDisabledTriggers(
  affectedTriggers: readonly DisabledTrigger[]
) {
  return {
    disabledSchedules: affectedTriggers
      .filter((trigger) => trigger.sourceType === "cron")
      .map((trigger) => ({ id: trigger.id, name: trigger.name })),
    disabledEvents: affectedTriggers
      .filter((trigger) => trigger.sourceType !== "cron")
      .map((trigger) => ({ id: trigger.id, name: trigger.name })),
  };
}

export async function ensureTriggerTargetsExist(
  db: DbClient,
  organizationId: string,
  repositoryIds: string[],
  message: string
) {
  if (repositoryIds.length === 0) {
    return null;
  }

  const integrations = await db.query.githubIntegrations.findMany({
    where: and(
      eq(githubIntegrations.organizationId, organizationId),
      inArray(githubIntegrations.id, repositoryIds)
    ),
    columns: { id: true },
  });

  const existingIds = new Set(
    integrations.map((integration) => integration.id)
  );
  const hasMissingTarget = repositoryIds.some((id) => !existingIds.has(id));

  return hasMissingTarget ? { error: message } : null;
}

export async function getRepositoryLabels(
  db: DbClient,
  repositoryIds: string[]
): Promise<Record<string, string>> {
  if (repositoryIds.length === 0) {
    return {};
  }

  const repositories = await db
    .select({
      id: githubIntegrations.id,
      owner: githubIntegrations.owner,
      repo: githubIntegrations.repo,
      defaultBranch: githubIntegrations.defaultBranch,
    })
    .from(githubIntegrations)
    .where(inArray(githubIntegrations.id, repositoryIds));

  return Object.fromEntries(
    repositories
      .filter((repository) => repository.owner && repository.repo)
      .map((repository) => [
        repository.id,
        repository.defaultBranch?.trim()
          ? `${repository.owner}/${repository.repo} · ${repository.defaultBranch.trim()}`
          : `${repository.owner}/${repository.repo}`,
      ])
  );
}
