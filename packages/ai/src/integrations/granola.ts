import { db } from "@notra/db/drizzle";
import { granolaIntegrations } from "@notra/db/schema";
import {
  decryptToken,
  encryptToken,
} from "@notra/db/utils/integration-encryption";
import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { GRANOLA_API_BASE_URL } from "../constants/granola";
import type {
  CreateGranolaIntegrationParams,
  GranolaKeyVerificationResult,
  UpdateGranolaIntegrationParams,
} from "../types/integrations";
import type { GranolaToolContext } from "../types/tools";
import { hasOrganizationAccess } from "../utils/organization-access";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);
const createdByUserRelation = {
  createdByUser: {
    columns: { id: true, name: true, email: true, image: true },
  },
} as const;

export async function verifyGranolaApiKey(
  apiKey: string
): Promise<GranolaKeyVerificationResult> {
  try {
    const response = await fetch(`${GRANOLA_API_BASE_URL}/notes?page_size=1`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        error: "Granola rejected this API key. Check the key and its scopes.",
      };
    }

    return {
      valid: false,
      error: `Granola API returned an unexpected status (${response.status}). Try again later.`,
    };
  } catch {
    return {
      valid: false,
      error: "Could not reach the Granola API to verify the key.",
    };
  }
}

export async function createGranolaIntegration(
  params: CreateGranolaIntegrationParams
) {
  const { organizationId, userId, displayName, apiKey, workspaceName } = params;

  if (!(await hasOrganizationAccess(userId, organizationId))) {
    throw new Error("User does not have access to this organization.");
  }

  const [integration] = await db
    .insert(granolaIntegrations)
    .values({
      id: `gra_${nanoid()}`,
      organizationId,
      createdByUserId: userId,
      displayName,
      encryptedApiKey: encryptToken(apiKey),
      workspaceName: workspaceName ?? null,
    })
    .returning();

  return integration;
}

export async function getGranolaIntegrationById(integrationId: string) {
  const integration = await db.query.granolaIntegrations.findFirst({
    where: eq(granolaIntegrations.id, integrationId),
    with: createdByUserRelation,
  });

  return integration ?? null;
}

export async function getGranolaIntegrationsByOrganization(
  organizationId: string
) {
  return db.query.granolaIntegrations.findMany({
    where: eq(granolaIntegrations.organizationId, organizationId),
    with: createdByUserRelation,
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
}

export async function updateGranolaIntegration(
  integrationId: string,
  updates: UpdateGranolaIntegrationParams
) {
  const [updated] = await db
    .update(granolaIntegrations)
    .set(updates)
    .where(eq(granolaIntegrations.id, integrationId))
    .returning();

  return updated;
}

export async function deleteGranolaIntegration(integrationId: string) {
  await db
    .delete(granolaIntegrations)
    .where(eq(granolaIntegrations.id, integrationId));
}

export async function getGranolaToolContextByIntegrationId(
  integrationId: string,
  options: { organizationId: string }
): Promise<GranolaToolContext> {
  const [integration] = await db
    .select({
      id: granolaIntegrations.id,
      organizationId: granolaIntegrations.organizationId,
      encryptedApiKey: granolaIntegrations.encryptedApiKey,
      workspaceName: granolaIntegrations.workspaceName,
      enabled: granolaIntegrations.enabled,
    })
    .from(granolaIntegrations)
    .where(
      and(
        eq(granolaIntegrations.id, integrationId),
        eq(granolaIntegrations.organizationId, options.organizationId)
      )
    )
    .limit(1);

  if (!integration) {
    throw new Error(
      `Granola integration access denied. Unknown integrationId ${integrationId}.`
    );
  }

  if (!integration.enabled) {
    throw new Error(
      `Granola integration access denied for integrationId ${integrationId}. Integration is disabled.`
    );
  }

  return {
    integrationId: integration.id,
    organizationId: integration.organizationId,
    apiKey: decryptToken(integration.encryptedApiKey),
    workspaceName: integration.workspaceName,
  };
}
