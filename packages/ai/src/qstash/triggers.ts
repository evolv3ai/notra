import { isDemoMode } from "@notra/utils/demo-mode";
import {
  Client as QStashClient,
  QstashError as QStashSdkError,
} from "@upstash/qstash";

import { QSTASH_DESTINATION_REJECTION_PATTERN } from "../constants/qstash";
import { CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS } from "../constants/schedule-interval";
import { QstashScheduleSetupError } from "../schemas/qstash";
import type {
  CreateQstashRouteScheduleProps,
  PublishQstashRouteMessageProps,
} from "../types/qstash";
import { toUtcDateString } from "../utils/schedule-interval";
import { getConfiguredAppUrl, getConfiguredWorkflowUrl } from "../utils/url";

interface CreateQstashScheduleProps {
  triggerId: string;
  cron: string;
  scheduleId?: string;
}

export interface TriggerCronConfig {
  frequency: "daily" | "weekly" | "monthly" | "custom";
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  /** Every N days, for `custom`. */
  intervalDays?: number;
  /** UTC `YYYY-MM-DD` the custom interval counts from. */
  anchorDate?: string;
}

function getQstashToken() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new QstashScheduleSetupError({ reason: "missing_token" });
  }
  return token;
}

function toScheduleCreateError(error: unknown) {
  if (
    error instanceof QStashSdkError &&
    QSTASH_DESTINATION_REJECTION_PATTERN.test(error.message)
  ) {
    return new QstashScheduleSetupError({
      reason: "invalid_destination",
      cause: error,
    });
  }
  return error;
}

export function getBaseUrl() {
  return getConfiguredWorkflowUrl() ?? getConfiguredAppUrl();
}

/**
 * The absolute URL QStash calls for a dashboard route. Schedules and messages
 * are addressed with it and the receiving route verifies the signature
 * against it, so the two always agree (`WORKFLOW_BASE_URL` wins over the app
 * URL on both sides).
 */
export function qstashRouteUrl(path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new QstashScheduleSetupError({ reason: "missing_app_url" });
  }
  return `${baseUrl}${path}`;
}

/**
 * Every URL a delivery for `path` may have been addressed to. Schedules created
 * before the producer switched to `qstashRouteUrl` still target the app URL, so
 * receivers accept both bases.
 */
export function qstashRouteUrlCandidates(path: string) {
  const baseUrls = [getConfiguredWorkflowUrl(), getConfiguredAppUrl()].filter(
    (url): url is string => Boolean(url)
  );
  return [...new Set(baseUrls)].map((baseUrl) => `${baseUrl}${path}`);
}

function getQStashClient() {
  return new QStashClient({ token: getQstashToken() });
}

export function buildCronExpression(config?: TriggerCronConfig) {
  const normalizedConfig = normalizeCronConfig(config);

  if (!normalizedConfig) {
    return null;
  }

  const minute = normalizedConfig.minute;
  const hour = normalizedConfig.hour;

  if (normalizedConfig.frequency === "weekly") {
    const dayOfWeek =
      "dayOfWeek" in normalizedConfig ? normalizedConfig.dayOfWeek : 1;
    return `${minute} ${hour} * * ${dayOfWeek}`;
  }

  if (normalizedConfig.frequency === "monthly") {
    const dayOfMonth =
      "dayOfMonth" in normalizedConfig ? normalizedConfig.dayOfMonth : 1;
    return `${minute} ${hour} ${dayOfMonth} * *`;
  }

  return `${minute} ${hour} * * *`;
}

export function normalizeCronConfig(config?: TriggerCronConfig) {
  if (!config) {
    return undefined;
  }

  const base = {
    frequency: config.frequency,
    hour: config.hour ?? 0,
    minute: config.minute ?? 0,
  } as const;

  if (config.frequency === "weekly") {
    return {
      ...base,
      dayOfWeek: config.dayOfWeek ?? 1,
    };
  }

  if (config.frequency === "monthly") {
    return {
      ...base,
      dayOfMonth: config.dayOfMonth ?? 1,
    };
  }

  if (config.frequency === "custom") {
    return {
      ...base,
      intervalDays:
        config.intervalDays ?? CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS,
      anchorDate: config.anchorDate ?? toUtcDateString(new Date()),
    };
  }

  return base;
}

export async function createQstashSchedule({
  triggerId,
  cron,
  scheduleId,
}: CreateQstashScheduleProps) {
  if (isDemoMode()) {
    return scheduleId ?? `demo-schedule-${triggerId}`;
  }
  return createQstashRouteSchedule({
    path: "/api/workflows/schedule",
    cron,
    body: { triggerId },
    scheduleId,
  });
}

export async function createQstashRouteSchedule({
  path,
  cron,
  body,
  scheduleId,
}: CreateQstashRouteScheduleProps) {
  if (isDemoMode()) {
    return scheduleId ?? `demo-schedule-${crypto.randomUUID()}`;
  }
  const client = getQStashClient();
  const destination = qstashRouteUrl(path);

  const result = await client.schedules
    .create({
      ...(scheduleId && { scheduleId }),
      destination,
      cron,
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    })
    .catch((error: unknown) => {
      throw toScheduleCreateError(error);
    });

  const resolvedScheduleId = result.scheduleId ?? scheduleId;

  if (!resolvedScheduleId) {
    throw new Error("QStash schedule id was not returned");
  }

  return resolvedScheduleId;
}

/**
 * Sends one message to a dashboard route, held by QStash until `notBefore`.
 * Addressed like the schedule triggers, so the API (which only knows the
 * dashboard as `WORKFLOW_BASE_URL`) can send it too; the route verifies the
 * signature against the same base.
 */
export async function publishQstashRouteMessage({
  path,
  body,
  notBefore,
  deduplicationId,
}: PublishQstashRouteMessageProps) {
  const client = getQStashClient();
  await client.publishJSON({
    url: qstashRouteUrl(path),
    body,
    notBefore: Math.ceil(notBefore.getTime() / 1000),
    deduplicationId,
  });
}

export async function deleteQstashSchedule(scheduleId: string) {
  if (isDemoMode()) {
    return;
  }
  const client = getQStashClient();
  await client.schedules.delete(scheduleId);
}
