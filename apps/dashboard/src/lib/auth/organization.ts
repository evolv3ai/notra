import { db } from "@notra/db/drizzle";
import { members } from "@notra/db/schema";
import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { retryTransientDbError } from "@/lib/db/retry";
import { getTranslations } from "@/lib/i18n/server";
import { getORPCRequestMemo } from "@/lib/orpc/context";
import type {
  AuthenticatedUser,
  AuthSession,
  OrganizationAuth,
  OrganizationAuthDependencies,
} from "@/types/auth/organization";
import { recordAuthorizedOrganization } from "@/utils/rpc-telemetry";

import { getServerSession } from "./session";

const organizationAuthDependencies: OrganizationAuthDependencies = {
  getServerSession,
  findMembership: async ({ organizationId, userId }) =>
    retryTransientDbError(() =>
      db.query.members.findFirst({
        where: and(
          eq(members.userId, userId),
          eq(members.organizationId, organizationId)
        ),
        columns: {
          id: true,
          role: true,
        },
      })
    ),
  hasDatabaseUrl: () => Boolean(process.env.DATABASE_URL),
};

export async function assertAuthenticated(
  { headers }: { headers: Headers },
  deps: Pick<
    OrganizationAuthDependencies,
    "getServerSession"
  > = organizationAuthDependencies
) {
  const memo = getORPCRequestMemo(headers);
  let lookup = memo?.sessionLookup;
  if (!lookup) {
    lookup = deps.getServerSession({ headers });
    if (memo) {
      memo.sessionLookup = lookup;
      lookup.catch(() => {
        memo.sessionLookup = undefined;
      });
    }
  }
  const { session, user } = (await lookup) as AuthSession;

  if (!(session && user)) {
    const tErrors = await getTranslations("errors.actions.organizations");
    throw new ORPCError("UNAUTHORIZED", {
      message: tErrors("signedOut"),
    });
  }

  if (memo) {
    memo.authenticatedUserId = user.id;
  }
  return { session, user };
}

async function findMembershipMemoized(
  deps: Pick<OrganizationAuthDependencies, "findMembership">,
  headers: Headers,
  params: { organizationId: string; userId: string }
) {
  const memo = getORPCRequestMemo(headers);
  if (!memo) {
    return await deps.findMembership(params);
  }

  const cacheKey = `${params.userId}:${params.organizationId}`;
  let lookup = memo.membershipByUserOrganization.get(cacheKey);
  if (!lookup) {
    lookup = deps.findMembership(params);
    memo.membershipByUserOrganization.set(cacheKey, lookup);
  }
  return await lookup;
}

export async function assertOrganizationAccessWithDeps(
  {
    headers,
    organizationId,
    user,
  }: {
    headers: Headers;
    organizationId: string;
    user?: AuthenticatedUser;
  },
  deps: OrganizationAuthDependencies = organizationAuthDependencies
) {
  if (!deps.hasDatabaseUrl()) {
    const tErrors = await getTranslations("common.errors");
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: tErrors("generic"),
    });
  }

  const safeOrganizationId = organizationIdSchema.safeParse(organizationId);
  if (!safeOrganizationId.success) {
    throw new ORPCError("BAD_REQUEST", {
      data: {
        issues: safeOrganizationId.error.issues,
      },
      message: (await getTranslations("errors.actions"))("invalidInput"),
    });
  }

  const authenticatedUser =
    user ?? (await assertAuthenticated({ headers }, deps)).user;

  const membership = await findMembershipMemoized(deps, headers, {
    userId: authenticatedUser.id,
    organizationId: safeOrganizationId.data,
  });

  if (!membership) {
    const tErrors = await getTranslations("errors.user");
    throw new ORPCError("FORBIDDEN", {
      message: tErrors("notMember"),
    });
  }

  recordAuthorizedOrganization(
    headers,
    safeOrganizationId.data,
    authenticatedUser.id
  );
  return {
    user: authenticatedUser,
    organizationId: safeOrganizationId.data,
    membership,
  };
}

export function assertOrganizationAccess(args: {
  headers: Headers;
  organizationId: string;
  user?: AuthenticatedUser;
}) {
  return assertOrganizationAccessWithDeps(args);
}

export async function withOrganizationAuth(
  request: Request,
  organizationId: string
): Promise<OrganizationAuth> {
  try {
    const context = await assertOrganizationAccess({
      headers: request.headers,
      organizationId,
    });

    return {
      success: true,
      context,
    };
  } catch (error) {
    if (error instanceof ORPCError) {
      return {
        success: false,
        response: Response.json(
          {
            error: error.message,
            ...(error.data ? { details: error.data } : {}),
          },
          { status: error.status }
        ),
      };
    }

    throw error;
  }
}
