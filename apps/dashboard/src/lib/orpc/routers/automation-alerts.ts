import { db } from "@notra/db/drizzle";
import {
  contentTriggers,
  members,
  projects,
  slackIntegrations,
  webhookEndpoints,
} from "@notra/db/schema";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import {
  type ConfigureGeoAlertBody,
  createGeoAlertInputSchema,
  GEO_ALERT_DEFAULT_THRESHOLDS,
  GEO_ALERT_OUTPUT_TYPE,
  GEO_ALERT_SOURCE_TYPE,
  geoAlertTriggerInputSchema,
  updateGeoAlertInputSchema,
} from "@notra/schemas/dashboard/automation/geo-alerts";
import {
  and,
  arrayContains,
  asc,
  count,
  eq,
  isNotNull,
  isNull,
  ne,
} from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { trackServerEvent } from "@/lib/analytics/posthog-server";
import {
  listGeoAlertAutomations,
  sendGeoAlertTest,
  toGeoAlertAutomation,
} from "@/lib/automation/geo-alerts";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";

import { badRequest, conflict, notFound } from "../utils/errors";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

const GEO_ALERT_WEBHOOK_EVENT = "geo.alert.triggered";

/**
 * One alert per signal, project and effective threshold; destinations can
 * change. An omitted threshold hashes like its default, the value it fires on.
 */
function geoAlertDedupeHash(body: ConfigureGeoAlertBody) {
  const { signal, projectId, threshold } = body.sourceConfig;
  const defaultThreshold = GEO_ALERT_DEFAULT_THRESHOLDS[signal];
  const effectiveThreshold =
    defaultThreshold === undefined ? "none" : (threshold ?? defaultThreshold);
  return `geo:${signal}:${projectId ?? "*"}:${effectiveThreshold}`;
}

function geoAlertRow(body: ConfigureGeoAlertBody) {
  return {
    name: body.name,
    sourceType: GEO_ALERT_SOURCE_TYPE,
    sourceConfig: { geo: body.sourceConfig },
    targets: { repositoryIds: [] },
    outputType: GEO_ALERT_OUTPUT_TYPE,
    outputConfig: { actions: body.actions },
    dedupeHash: geoAlertDedupeHash(body),
    enabled: body.enabled,
    autoPublish: false,
  };
}

async function assertProjectInOrganization(
  organizationId: string,
  projectId: string | null
) {
  if (!projectId) {
    return;
  }
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
    columns: { id: true },
  });
  if (!project) {
    throw badRequest("Project not found");
  }
}

async function assertUniqueAlert(
  organizationId: string,
  dedupeHash: string,
  excludeId?: string
) {
  const existing = await db.query.contentTriggers.findFirst({
    where: and(
      eq(contentTriggers.organizationId, organizationId),
      eq(contentTriggers.dedupeHash, dedupeHash),
      excludeId ? ne(contentTriggers.id, excludeId) : undefined
    ),
    columns: { id: true },
  });
  if (existing) {
    throw conflict("An alert for this signal already exists", {
      code: "DUPLICATE_TRIGGER",
    });
  }
}

async function findAlert(organizationId: string, triggerId: string) {
  const row = await db.query.contentTriggers.findFirst({
    where: and(
      eq(contentTriggers.id, triggerId),
      eq(contentTriggers.organizationId, organizationId),
      eq(contentTriggers.sourceType, GEO_ALERT_SOURCE_TYPE)
    ),
  });
  const automation = row ? toGeoAlertAutomation(row) : null;
  if (!automation) {
    throw notFound("Alert not found");
  }
  return automation;
}

export const automationAlertsRouter = {
  list: baseProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => ({
      alerts: await listGeoAlertAutomations(input.organizationId),
    })),
  /** Where alerts can go right now, so the form can explain empty channels. */
  destinations: baseProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const [slack, owners, endpoints] = await Promise.all([
        db
          .select({ value: count() })
          .from(slackIntegrations)
          .where(
            and(
              eq(slackIntegrations.organizationId, input.organizationId),
              eq(slackIntegrations.enabled, true),
              isNotNull(slackIntegrations.notificationChannelId)
            )
          ),
        db
          .select({ value: count() })
          .from(members)
          .where(
            and(
              eq(members.organizationId, input.organizationId),
              eq(members.role, "owner")
            )
          ),
        db
          .select({ value: count() })
          .from(webhookEndpoints)
          .where(
            and(
              eq(webhookEndpoints.organizationId, input.organizationId),
              eq(webhookEndpoints.enabled, true),
              isNull(webhookEndpoints.deletedAt),
              arrayContains(webhookEndpoints.events, [GEO_ALERT_WEBHOOK_EVENT])
            )
          ),
      ]);
      return {
        slackConnected: (slack[0]?.value ?? 0) > 0,
        ownerCount: owners[0]?.value ?? 0,
        webhookEndpointCount: endpoints[0]?.value ?? 0,
      };
    }),
  create: baseProcedure
    .input(createGeoAlertInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const { organizationId, ...body } = input;
      await assertActiveSubscription(organizationId);
      await assertProjectInOrganization(
        organizationId,
        body.sourceConfig.projectId
      );
      const values = geoAlertRow(body);
      await assertUniqueAlert(organizationId, values.dedupeHash);
      const [row] = await db
        .insert(contentTriggers)
        .values({ id: nanoid(), organizationId, ...values })
        .returning();
      const alert = row ? toGeoAlertAutomation(row) : null;
      if (!alert) {
        throw badRequest("Alert could not be created");
      }
      return { alert };
    }),
  update: baseProcedure
    .input(updateGeoAlertInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const { organizationId, triggerId, ...body } = input;
      await assertActiveSubscription(organizationId);
      await findAlert(organizationId, triggerId);
      await assertProjectInOrganization(
        organizationId,
        body.sourceConfig.projectId
      );
      const values = geoAlertRow(body);
      await assertUniqueAlert(organizationId, values.dedupeHash, triggerId);
      const [row] = await db
        .update(contentTriggers)
        .set({ ...values, updatedAt: new Date() })
        .where(
          and(
            eq(contentTriggers.id, triggerId),
            eq(contentTriggers.organizationId, organizationId)
          )
        )
        .returning();
      const alert = row ? toGeoAlertAutomation(row) : null;
      if (!alert) {
        throw notFound("Alert not found");
      }
      return { alert };
    }),
  delete: baseProcedure
    .input(geoAlertTriggerInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const [deleted] = await db
        .delete(contentTriggers)
        .where(
          and(
            eq(contentTriggers.id, input.triggerId),
            eq(contentTriggers.organizationId, input.organizationId),
            eq(contentTriggers.sourceType, GEO_ALERT_SOURCE_TYPE)
          )
        )
        .returning({
          id: contentTriggers.id,
          sourceConfig: contentTriggers.sourceConfig,
          enabled: contentTriggers.enabled,
        });
      if (deleted) {
        trackServerEvent({
          event: POSTHOG_EVENTS.GEO_ALERT_DELETED,
          headers: context.headers,
          userId: context.auth.user.id,
          organizationId: input.organizationId,
          properties: {
            trigger_id: deleted.id,
            signal: (deleted.sourceConfig as { geo?: { signal?: string } }).geo
              ?.signal,
            enabled: deleted.enabled,
          },
        });
      }
      return { success: true };
    }),
  sendTest: baseProcedure
    .input(geoAlertTriggerInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const alert = await findAlert(input.organizationId, input.triggerId);
      const projectId =
        alert.sourceConfig.projectId ??
        (
          await db.query.projects.findFirst({
            where: eq(projects.organizationId, input.organizationId),
            orderBy: [asc(projects.createdAt)],
            columns: { id: true },
          })
        )?.id;
      if (!projectId) {
        throw badRequest("Set up GEO before sending a test alert");
      }
      return { delivery: await sendGeoAlertTest(alert, projectId) };
    }),
};
