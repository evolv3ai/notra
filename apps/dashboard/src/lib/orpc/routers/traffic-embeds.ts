import {
  createTrafficEmbedInputSchema,
  listTrafficEmbedsInputSchema,
  trafficEmbedInputSchema,
  updateTrafficEmbedInputSchema,
} from "@notra/schemas/dashboard/traffic-embed";

import {
  createTrafficEmbed,
  listTrafficEmbeds,
  revokeTrafficEmbed,
  updateTrafficEmbed,
} from "@/lib/geo/traffic-embeds";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import {
  assertNotDemo,
  badRequest,
  conflict,
  notFound,
} from "@/lib/orpc/utils/errors";
import { normalizeTrafficEmbedOrigin } from "@/utils/traffic-embed";

const EMBED_NOT_FOUND_MESSAGE = "Embed not found";

function normalizeOrigins(values: readonly string[]): string[] {
  const results = values.map(normalizeTrafficEmbedOrigin);
  const invalid = results.flatMap((result) =>
    result.ok ? [] : [result.value]
  );
  if (invalid.length > 0) {
    throw badRequest(`Invalid domain: ${invalid.join(", ")}`, { invalid });
  }
  return [
    ...new Set(results.flatMap((result) => (result.ok ? [result.origin] : []))),
  ];
}

export const trafficEmbedsRouter = {
  list: authorizedProcedure
    .input(listTrafficEmbedsInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => ({
      embeds: await listTrafficEmbeds(
        context.auth.organizationId,
        input.projectId ?? null
      ),
    })),

  create: authorizedProcedure
    .input(createTrafficEmbedInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const embed = await createTrafficEmbed({
        organizationId: context.auth.organizationId,
        projectId: input.projectId ?? null,
        userId: context.user.id,
        name: input.name,
        host: input.host || null,
        allowedOrigins: normalizeOrigins(input.allowedOrigins),
      });
      if (embed === "limit") {
        throw conflict("Embed limit reached. Remove an embed to add another.");
      }
      if (!embed) {
        throw notFound("Project not found");
      }
      return { embed };
    }),

  update: authorizedProcedure
    .input(updateTrafficEmbedInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const embed = await updateTrafficEmbed({
        organizationId: context.auth.organizationId,
        embedId: input.embedId,
        name: input.name,
        allowedOrigins: normalizeOrigins(input.allowedOrigins),
      });
      if (!embed) {
        throw notFound(EMBED_NOT_FOUND_MESSAGE);
      }
      return { embed };
    }),

  revoke: authorizedProcedure
    .input(trafficEmbedInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const revoked = await revokeTrafficEmbed(
        context.auth.organizationId,
        input.embedId
      );
      if (!revoked) {
        throw notFound(EMBED_NOT_FOUND_MESSAGE);
      }
      return { ok: true as const };
    }),
};
