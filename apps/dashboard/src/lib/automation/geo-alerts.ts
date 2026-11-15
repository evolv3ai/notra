import { postSlackNotification } from "@notra/ai/integrations/slack-workspace";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { contentTriggers, members, organizations } from "@notra/db/schema";
import { engineEmailLogoSrc } from "@notra/email/utils/engine-logo";
import { loadGeoScanDiff } from "@notra/geo-core/geo/programs";
import {
  GEO_ALERT_SOURCE_TYPE,
  geoAlertActionsSchema,
  geoAlertSourceConfigSchema,
} from "@notra/schemas/dashboard/automation/geo-alerts";
import { recordGeoAlert } from "@notra/webhooks/runtime/geo-alert";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_ALERT_AUTOMATION_PREVIEW_CHANGES,
  GEO_ALERT_SIGNAL_PATHS,
} from "@/constants/geo-alert-automations";
import { recordAutomationRun } from "@/lib/automation/runs";
import { sendGeoAlertEmail, getAppUrl } from "@/lib/email/send";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { appendWebhookLog } from "@/lib/webhooks/logging";
import type {
  GeoAlertAutomation,
  GeoAlertDeliveryResult,
  GeoAlertMatch,
  GeoAlertScanContext,
} from "@/types/automation/geo-alerts";
import {
  failedScanMatch,
  formatGeoAlertSlackText,
  matchGeoAlert,
} from "@/utils/geo-alerts";

type ContentTriggerRow = typeof contentTriggers.$inferSelect;

/** `null` when the row isn't a well-formed GEO alert. */
export function toGeoAlertAutomation(
  row: ContentTriggerRow
): GeoAlertAutomation | null {
  if (row.sourceType !== GEO_ALERT_SOURCE_TYPE) {
    return null;
  }
  const source = geoAlertSourceConfigSchema.safeParse(
    (row.sourceConfig as { geo?: unknown } | null)?.geo
  );
  const actions = geoAlertActionsSchema.safeParse(
    (row.outputConfig as { actions?: unknown } | null)?.actions
  );
  if (!(source.success && actions.success)) {
    return null;
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    sourceConfig: source.data,
    actions: actions.data,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listGeoAlertAutomations(organizationId: string) {
  const rows = await db.query.contentTriggers.findMany({
    where: and(
      eq(contentTriggers.organizationId, organizationId),
      eq(contentTriggers.sourceType, GEO_ALERT_SOURCE_TYPE)
    ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  return rows.flatMap((row) => {
    const automation = toGeoAlertAutomation(row);
    return automation ? [automation] : [];
  });
}

interface AlertRecipients {
  name: string;
  slug: string;
  emails: string[];
}

async function loadAlertRecipients(
  organizationId: string
): Promise<AlertRecipients | null> {
  const [org, owners] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { name: true, slug: true },
    }),
    db.query.members.findMany({
      where: and(
        eq(members.organizationId, organizationId),
        eq(members.role, "owner")
      ),
      with: { users: { columns: { email: true } } },
    }),
  ]);
  if (!org) {
    return null;
  }
  return {
    name: org.name,
    slug: org.slug,
    emails: owners.flatMap((owner) =>
      owner.users.email ? [owner.users.email] : []
    ),
  };
}

interface DeliverInput {
  automation: GeoAlertAutomation;
  match: GeoAlertMatch;
  recipients: AlertRecipients;
  projectId: string;
  scanId: string | null;
  /** Dedupes email and webhook publishes for the same alert. */
  alertKey: string;
}

async function settle<T>(task: () => Promise<T>, label: string) {
  try {
    return await task();
  } catch (error) {
    logError(`[GeoAlerts] ${label} failed`, error);
    return null;
  }
}

async function deliverGeoAlert({
  automation,
  match,
  recipients,
  projectId,
  scanId,
  alertKey,
}: DeliverInput): Promise<GeoAlertDeliveryResult> {
  const { actions } = automation;
  const url = `${getAppUrl()}/${recipients.slug}${GEO_ALERT_SIGNAL_PATHS[match.signal]}`;

  const [slack, email, webhook] = await Promise.all([
    actions.slack
      ? settle(
          () =>
            postSlackNotification(
              automation.organizationId,
              formatGeoAlertSlackText(match, automation.name, url)
            ),
          "Slack delivery"
        ).then(Boolean)
      : null,
    actions.email
      ? settle(async () => {
          const items = match.changes
            .slice(0, GEO_ALERT_AUTOMATION_PREVIEW_CHANGES)
            .map((change, index) => ({
              id: `${index}:${change.kind}`,
              title: change.prompt,
              changes: [
                {
                  id: change.kind,
                  detail: change.detail,
                  tone:
                    change.kind.endsWith("added") ||
                    change.kind === "gained_mention"
                      ? ("up" as const)
                      : ("down" as const),
                },
              ],
              engineLabel: change.engine,
              engineIconSrc: engineEmailLogoSrc(change.engineFamily),
            }));
          const results = await Promise.all(
            recipients.emails.map((recipientEmail) =>
              sendGeoAlertEmail({
                recipientEmail,
                alertKey,
                organizationName: recipients.name,
                organizationSlug: recipients.slug,
                automationName: automation.name,
                headline: match.title,
                summary: match.summary,
                items,
                remainingCount: Math.max(match.totalChanges - items.length, 0),
                dashboardLink: url,
              })
            )
          );
          for (const result of results) {
            if (result.error) {
              logError("[GeoAlerts] Email was not sent", result.error);
            }
          }
          return results.some((result) => !result.error);
        }, "Email delivery").then(Boolean)
      : null,
    actions.webhook
      ? settle(
          () =>
            recordGeoAlert({
              organizationId: automation.organizationId,
              sourceKey: `geo-alert:${alertKey}`,
              automationId: automation.id,
              automationName: automation.name,
              signal: match.signal,
              projectId,
              scanId,
              title: match.title,
              summary: match.summary,
              url,
              changes: match.changes.map(
                ({ prompt, engineId, kind, competitors }) => ({
                  prompt,
                  engine: engineId,
                  kind,
                  competitors,
                })
              ),
            }),
          "Webhook publish"
        ).then((id) => id !== null)
      : null,
  ]);

  return { slack, email, webhook };
}

function deliverySucceeded(result: GeoAlertDeliveryResult) {
  return Object.values(result).some((value) => value === true);
}

async function logAlert(
  automation: GeoAlertAutomation,
  match: GeoAlertMatch,
  result: GeoAlertDeliveryResult,
  run: { alertKey: string; referenceId: string; startedAt: Date; test: boolean }
) {
  const succeeded = deliverySucceeded(result);
  const errorMessage = succeeded ? null : "No destination accepted the alert";
  await Promise.all([
    settle(
      () =>
        recordAutomationRun({
          id: run.alertKey,
          organizationId: automation.organizationId,
          automationId: automation.id,
          manual: run.test,
          status: succeeded ? "success" : "failed",
          title: match.title,
          errorMessage,
          startedAt: run.startedAt,
        }),
      "Run history"
    ),
    settle(
      () =>
        appendWebhookLog({
          organizationId: automation.organizationId,
          integrationId: automation.id,
          integrationType: "geo",
          title: `Alert “${automation.name}”: ${match.title}`,
          status: succeeded ? "success" : "failed",
          statusCode: null,
          referenceId: run.referenceId,
          payload: { signal: match.signal, delivery: result },
          ...(errorMessage ? { errorMessage } : {}),
        }),
      "Activity log"
    ),
  ]);
}

async function loadEnabledAlerts(organizationId: string, projectId: string) {
  const automations = await listGeoAlertAutomations(organizationId);
  return automations.filter(
    (automation) =>
      automation.enabled &&
      (automation.sourceConfig.projectId === null ||
        automation.sourceConfig.projectId === projectId)
  );
}

/**
 * Runs every enabled GEO alert automation against a finished scan. Each
 * automation fires at most once per scan: emails and webhooks dedupe on the
 * automation and scan IDs.
 */
export async function evaluateGeoAlerts(
  context: GeoAlertScanContext
): Promise<{ fired: number }> {
  const automations = await loadEnabledAlerts(
    context.organizationId,
    context.projectId
  );
  const candidates = automations.filter((automation) =>
    context.status === "failed"
      ? automation.sourceConfig.signal === "scan_failed"
      : automation.sourceConfig.signal !== "scan_failed"
  );
  if (candidates.length === 0) {
    return { fired: 0 };
  }

  let matches: { automation: GeoAlertAutomation; match: GeoAlertMatch }[];
  if (context.status === "failed") {
    const match = failedScanMatch(context.companyName, context.failureReason);
    matches = candidates.map((automation) => ({ automation, match }));
  } else {
    const diff = await Effect.runPromise(
      loadGeoScanDiff({
        organizationId: context.organizationId,
        projectId: context.projectId,
      }).pipe(Effect.provide(geoCoreDashboardLayer))
    );
    // A newer scan already finished; it gets its own evaluation.
    if (diff.currentScanId !== context.scanId) {
      return { fired: 0 };
    }
    matches = candidates.flatMap((automation) => {
      const match = matchGeoAlert(
        automation.sourceConfig,
        diff,
        context.companyName
      );
      return match ? [{ automation, match }] : [];
    });
  }
  if (matches.length === 0) {
    return { fired: 0 };
  }

  const recipients = await loadAlertRecipients(context.organizationId);
  if (!recipients) {
    return { fired: 0 };
  }

  await Promise.all(
    matches.map(async ({ automation, match }) => {
      const startedAt = new Date();
      const alertKey = `${automation.id}:${context.scanId}`;
      const result = await deliverGeoAlert({
        automation,
        match,
        recipients,
        projectId: context.projectId,
        scanId: context.scanId,
        alertKey,
      });
      await logAlert(automation, match, result, {
        alertKey,
        referenceId: context.scanId,
        startedAt,
        test: false,
      });
    })
  );
  return { fired: matches.length };
}

/** Sends a sample alert through the automation's destinations right now. */
export async function sendGeoAlertTest(
  automation: GeoAlertAutomation,
  projectId: string
): Promise<GeoAlertDeliveryResult> {
  const recipients = await loadAlertRecipients(automation.organizationId);
  if (!recipients) {
    return { slack: null, email: null, webhook: null };
  }
  const startedAt = new Date();
  const testId = crypto.randomUUID();
  const alertKey = `${automation.id}:test:${testId}`;
  const match: GeoAlertMatch = {
    signal: automation.sourceConfig.signal,
    title: `Test alert: ${automation.name}`,
    summary:
      "This is a test from Notra. Real alerts list the prompts that changed after a GEO scan.",
    changes: [],
    totalChanges: 0,
  };
  const result = await deliverGeoAlert({
    automation,
    match,
    recipients,
    projectId,
    scanId: null,
    alertKey,
  });
  await logAlert(automation, match, result, {
    alertKey,
    referenceId: `test:${testId}`,
    startedAt,
    test: true,
  });
  return result;
}
