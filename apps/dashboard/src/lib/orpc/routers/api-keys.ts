import { db } from "@notra/db/drizzle";
import { demoSandboxes } from "@notra/db/schema";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  type CreateApiKeyInput,
  createApiKeySchema,
  deleteAccountKeyInputSchema,
  deleteKeyInputSchema,
  updateAccountKeyInputSchema,
  updateKeyInputSchema,
} from "@notra/schemas/dashboard/api-keys";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import { toAccountApiKeyExternalId } from "@notra/utils/account-api-key";
import { getApiScopeId } from "@notra/utils/api-scopes";
import { isDemoMode } from "@notra/utils/demo-mode";
import type {
  KeyResponseData,
  V2ApisListKeysResponseBody,
} from "@unkey/api/models/components";
import { and, eq } from "drizzle-orm";

import { API_KEY_EXPIRATION_MS } from "@/constants/api-keys";
import { DEMO_DISABLED_MESSAGE } from "@/constants/demo";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { inferApiKeyExpiration } from "@/lib/api-keys/expiration";
import {
  expandLegacyApiKeyScopes,
  getApiKeyAccessMode,
  getApiKeyPermissionsForAccessMode,
  getUnknownApiKeyPermissions,
  summarizeApiKeyScopes,
} from "@/lib/api-keys/scopes";
import { unkey } from "@/lib/api-keys/unkey";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import { getTranslations } from "@/lib/i18n/server";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";

import {
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  serviceUnavailable,
} from "../utils/errors";

async function requireUnkeyConfig() {
  const apiId = process.env.UNKEY_API_ID;
  if (!(unkey && apiId)) {
    const tErrors = await getTranslations("common.errors");
    throw serviceUnavailable(tErrors("generic"));
  }

  return {
    apiId,
    client: unkey,
  };
}

async function assertNotDemoSandboxKey(organizationId: string, keyId: string) {
  if (!isDemoMode()) {
    return;
  }
  const sandbox = await db.query.demoSandboxes.findFirst({
    where: and(
      eq(demoSandboxes.organizationId, organizationId),
      eq(demoSandboxes.apiKeyId, keyId)
    ),
    columns: { anonymousId: true },
  });
  if (sandbox) {
    throw forbidden(DEMO_DISABLED_MESSAGE);
  }
}

type ListKeysResult =
  | V2ApisListKeysResponseBody
  | AsyncIterable<{ result: V2ApisListKeysResponseBody }>;

function isListKeysResponseBody(
  result: ListKeysResult
): result is V2ApisListKeysResponseBody {
  return "data" in result && Array.isArray(result.data);
}

async function listKeysByExternalId(
  client: NonNullable<typeof unkey>,
  apiId: string,
  externalId: string
) {
  const result = (await client.apis.listKeys({
    apiId,
    externalId,
  })) as ListKeysResult;

  if (isListKeysResponseBody(result)) {
    return result.data;
  }

  const keys: KeyResponseData[] = [];
  for await (const page of result) {
    keys.push(...page.result.data);
  }

  return keys;
}

async function assertKeyIdMatches(input: {
  keyIdParam: string;
  payload: { keyId: string };
}) {
  if (input.payload.keyId !== input.keyIdParam) {
    throw badRequest((await getTranslations("errors.actions"))("invalidInput"));
  }
}

async function requireKeyByExternalId(
  client: NonNullable<typeof unkey>,
  apiId: string,
  externalId: string,
  keyId: string
) {
  const keys = await listKeysByExternalId(client, apiId, externalId);
  const key = keys.find((item) => item.keyId === keyId);
  if (!key) {
    throw notFound("API key not found");
  }
  return key;
}

const WEBHOOKS_WRITE_SCOPE = getApiScopeId("webhooks", "write");

/**
 * Organization keys carry no issuer, so the API cannot re-check the member's
 * role later. Only owners and admins may hand out webhook management, matching
 * the dashboard's webhook mutations. Keeping an already granted scope is fine.
 */
function assertCanGrantWebhookWrite(
  role: string,
  permissions: readonly string[],
  currentPermissions: readonly string[] = []
) {
  if (role === "owner" || role === "admin") {
    return;
  }
  const grants =
    expandLegacyApiKeyScopes(permissions).includes(WEBHOOKS_WRITE_SCOPE);
  const alreadyGranted =
    expandLegacyApiKeyScopes(currentPermissions).includes(WEBHOOKS_WRITE_SCOPE);
  if (grants && !alreadyGranted) {
    throw forbidden(
      "Only organization owners and admins can grant webhook write access"
    );
  }
}

async function createUnkeyKey(
  client: NonNullable<typeof unkey>,
  apiId: string,
  {
    externalId,
    input,
    meta,
  }: {
    externalId: string;
    input: CreateApiKeyInput;
    meta: Record<string, unknown>;
  }
) {
  const expiresMs = API_KEY_EXPIRATION_MS[input.expiration];
  const permissions = getApiKeyPermissionsForAccessMode(
    input.accessMode,
    input.scopes
  );

  const created = await client.keys.createKey({
    apiId,
    expires: expiresMs ? Date.now() + expiresMs : undefined,
    externalId,
    meta: { accessMode: input.accessMode, ...meta },
    name: input.name,
    permissions,
    prefix: "ntra",
  });

  const fullKey = created.data?.key;
  const keyId = created.data?.keyId;
  if (!(fullKey && keyId)) {
    throw internalServerError("Failed to create API key");
  }

  return { fullKey, keyId, scopes: expandLegacyApiKeyScopes(permissions) };
}

function stringPermissions(key: KeyResponseData) {
  return Array.isArray(key.permissions)
    ? key.permissions.filter(
        (permission): permission is string => typeof permission === "string"
      )
    : [];
}

function toKeyListItem(key: KeyResponseData) {
  const meta = key.meta ?? {};
  const permissions = stringPermissions(key);

  const scopes = expandLegacyApiKeyScopes(permissions);
  const accessMode = getApiKeyAccessMode(permissions, meta.accessMode);

  return {
    accessMode,
    accountWide: meta.accountWide === true,
    createdAt: key.createdAt,
    createdBy: meta.createdBy ?? null,
    enabled: key.enabled,
    expires: key.expires ?? null,
    keyId: key.keyId,
    name: key.name ?? "Unnamed",
    permission: summarizeApiKeyScopes(scopes),
    permissions,
    start: key.start,
  };
}

function resolveUpdatePayload(
  key: KeyResponseData,
  payload: {
    accessMode?: string;
    scopes: readonly string[];
    expiration: string;
  }
) {
  const meta =
    key.meta && typeof key.meta === "object"
      ? (key.meta as Record<string, unknown>)
      : {};

  const currentExpiration = inferApiKeyExpiration(
    key.createdAt,
    key.expires ?? null
  );

  let expires: number | null;
  if (payload.expiration === currentExpiration) {
    expires = key.expires ?? null;
  } else if (payload.expiration === "never") {
    expires = null;
  } else {
    expires =
      Date.now() +
      (API_KEY_EXPIRATION_MS[
        payload.expiration as keyof typeof API_KEY_EXPIRATION_MS
      ] ?? 0);
  }

  const currentPermissions = stringPermissions(key);
  const accessMode =
    payload.accessMode ??
    getApiKeyAccessMode(currentPermissions, meta.accessMode);
  const unknownPermissions = getUnknownApiKeyPermissions(currentPermissions);
  const permissions = [
    ...getApiKeyPermissionsForAccessMode(
      accessMode as Parameters<typeof getApiKeyPermissionsForAccessMode>[0],
      payload.scopes
    ),
    ...unknownPermissions,
  ];
  const scopes = expandLegacyApiKeyScopes(permissions);

  return { accessMode, expires, meta, permissions, scopes };
}

export const apiKeysRouter = {
  list: authorizedProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const { apiId, client } = await requireUnkeyConfig();
      const keysData = await listKeysByExternalId(
        client,
        apiId,
        input.organizationId
      );

      return keysData.map(toKeyListItem);
    }),
  create: authorizedProcedure
    .input(organizationIdInputSchema.extend(createApiKeySchema.shape))
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertCanGrantWebhookWrite(
        context.auth.membership.role,
        getApiKeyPermissionsForAccessMode(input.accessMode, input.scopes)
      );
      await assertActiveSubscription(input.organizationId);

      const { apiId, client } = await requireUnkeyConfig();
      const { fullKey, keyId, scopes } = await createUnkeyKey(client, apiId, {
        externalId: input.organizationId,
        input,
        meta: { createdBy: context.user.name },
      });

      trackServerEvent({
        event: POSTHOG_EVENTS.API_KEY_CREATED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
        properties: {
          key_id: keyId,
          permission_preset: summarizeApiKeyScopes(scopes),
          scope_count: scopes.length,
          expiration: input.expiration,
        },
      });

      return {
        key: fullKey,
        keyId,
        name: input.name,
      };
    }),
  update: authorizedProcedure
    .input(updateKeyInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      await assertActiveSubscription(input.organizationId);

      const { apiId, client } = await requireUnkeyConfig();

      await assertKeyIdMatches(input);

      await assertNotDemoSandboxKey(input.organizationId, input.payload.keyId);

      const key = await requireKeyByExternalId(
        client,
        apiId,
        input.organizationId,
        input.payload.keyId
      );

      const { accessMode, expires, meta, permissions, scopes } =
        resolveUpdatePayload(key, {
          accessMode: input.payload.accessMode,
          expiration: input.payload.expiration,
          scopes: input.payload.scopes,
        });
      assertCanGrantWebhookWrite(
        context.auth.membership.role,
        permissions,
        stringPermissions(key)
      );

      await client.keys.updateKey({
        expires,
        keyId: input.payload.keyId,
        meta: {
          ...meta,
          accessMode,
        },
        name: input.payload.name,
        permissions,
      });

      trackServerEvent({
        event: POSTHOG_EVENTS.API_KEY_UPDATED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
        properties: {
          key_id: input.payload.keyId,
          permission_preset: summarizeApiKeyScopes(scopes),
          scope_count: scopes.length,
          expiration: input.payload.expiration,
          expiration_changed:
            input.payload.expiration !==
            inferApiKeyExpiration(key.createdAt, key.expires ?? null),
        },
      });

      return { success: true };
    }),
  delete: authorizedProcedure
    .input(deleteKeyInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { apiId, client } = await requireUnkeyConfig();

      await assertKeyIdMatches(input);

      await assertNotDemoSandboxKey(input.organizationId, input.payload.keyId);

      const key = await requireKeyByExternalId(
        client,
        apiId,
        input.organizationId,
        input.payload.keyId
      );

      await client.keys.deleteKey({ keyId: input.payload.keyId });

      trackServerEvent({
        event: POSTHOG_EVENTS.API_KEY_DELETED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
        properties: {
          key_id: input.payload.keyId,
        },
      });

      return { success: true };
    }),
  account: {
    list: authorizedProcedure.handler(async ({ context }) => {
      const { apiId, client } = await requireUnkeyConfig();
      const keysData = await listKeysByExternalId(
        client,
        apiId,
        toAccountApiKeyExternalId(context.user.id)
      );

      return keysData.map(toKeyListItem);
    }),
    create: authorizedProcedure
      .input(createApiKeySchema)
      .handler(async ({ context, input }) => {
        const { apiId, client } = await requireUnkeyConfig();
        const { fullKey, keyId, scopes } = await createUnkeyKey(client, apiId, {
          externalId: toAccountApiKeyExternalId(context.user.id),
          input,
          meta: { accountWide: true, createdBy: context.user.name },
        });

        trackServerEvent({
          event: POSTHOG_EVENTS.API_KEY_CREATED,
          headers: context.headers,
          userId: context.user.id,
          properties: {
            key_id: keyId,
            permission_preset: summarizeApiKeyScopes(scopes),
            scope_count: scopes.length,
            expiration: input.expiration,
            account_wide: true,
          },
        });

        return {
          key: fullKey,
          keyId,
          name: input.name,
        };
      }),
    update: authorizedProcedure
      .input(updateAccountKeyInputSchema)
      .handler(async ({ context, input }) => {
        const { apiId, client } = await requireUnkeyConfig();

        await assertKeyIdMatches(input);

        const key = await requireKeyByExternalId(
          client,
          apiId,
          toAccountApiKeyExternalId(context.user.id),
          input.payload.keyId
        );

        const { accessMode, expires, meta, permissions, scopes } =
          resolveUpdatePayload(key, {
            accessMode: input.payload.accessMode,
            expiration: input.payload.expiration,
            scopes: input.payload.scopes,
          });

        await client.keys.updateKey({
          expires,
          keyId: input.payload.keyId,
          meta: {
            ...meta,
            accountWide: true,
            accessMode,
          },
          name: input.payload.name,
          permissions,
        });

        trackServerEvent({
          event: POSTHOG_EVENTS.API_KEY_UPDATED,
          headers: context.headers,
          userId: context.user.id,
          properties: {
            key_id: input.payload.keyId,
            permission_preset: summarizeApiKeyScopes(scopes),
            scope_count: scopes.length,
            expiration: input.payload.expiration,
            expiration_changed:
              input.payload.expiration !==
              inferApiKeyExpiration(key.createdAt, key.expires ?? null),
            account_wide: true,
          },
        });

        return { success: true };
      }),
    delete: authorizedProcedure
      .input(deleteAccountKeyInputSchema)
      .handler(async ({ context, input }) => {
        const { apiId, client } = await requireUnkeyConfig();

        await assertKeyIdMatches(input);

        const key = await requireKeyByExternalId(
          client,
          apiId,
          toAccountApiKeyExternalId(context.user.id),
          input.payload.keyId
        );

        await client.keys.deleteKey({ keyId: input.payload.keyId });

        trackServerEvent({
          event: POSTHOG_EVENTS.API_KEY_DELETED,
          headers: context.headers,
          userId: context.user.id,
          properties: {
            key_id: input.payload.keyId,
            account_wide: true,
          },
        });

        return { success: true };
      }),
  },
};
