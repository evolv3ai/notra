import { assertAdmin } from "@/lib/auth/admin";
import { setUserBanned } from "@/lib/moderation/ban";
import {
  listRecentAbuseActions,
  searchOrganizations,
  searchUsers,
} from "@/lib/moderation/queries";
import { baseProcedure } from "@/lib/orpc/base";
import { callSiteAdmin } from "@/lib/sites/dashboard";
import {
  moderationSearchInputSchema,
  organizationSuspendInputSchema,
  userBanInputSchema,
} from "@/schemas/moderation";
import type { SiteAdminSuspendResponse } from "@/types/moderation";

export const moderationRouter = {
  organizations: baseProcedure
    .input(moderationSearchInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return searchOrganizations(input.search);
    }),

  users: baseProcedure
    .input(moderationSearchInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return searchUsers(input.search);
    }),

  history: baseProcedure.handler(async ({ context }) => {
    await assertAdmin({ headers: context.headers });
    return listRecentAbuseActions();
  }),

  setOrganizationSuspended: baseProcedure
    .input(organizationSuspendInputSchema)
    .handler(async ({ context, input }) => {
      const { user } = await assertAdmin({ headers: context.headers });
      return (await callSiteAdmin({
        action: "setOrganizationSuspended",
        organizationId: input.organizationId,
        actorId: user.id,
        suspended: input.suspended,
        reason: input.reason,
        category: input.category,
      })) as SiteAdminSuspendResponse;
    }),

  setUserBanned: baseProcedure
    .input(userBanInputSchema)
    .handler(async ({ context, input }) => {
      const { user } = await assertAdmin({ headers: context.headers });
      return setUserBanned(input, user.id);
    }),
};
